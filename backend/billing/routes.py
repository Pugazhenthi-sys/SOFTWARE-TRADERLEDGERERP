import os
import datetime
from flask import Blueprint, request, jsonify, send_file
from database import db_cursor
from auth_utils import jwt_required
from config import Config
from billing.documents import generate_bill_pdf, generate_bill_excel

bp = Blueprint("billing", __name__, url_prefix="/api/bills")


def _customer_balance(cur, customer_id, opening_balance):
    cur.execute(
        "SELECT balance_after FROM transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1",
        (customer_id,),
    )
    row = cur.fetchone()
    return row["balance_after"] if row else opening_balance


def _next_bill_number(cur):
    cur.execute("SELECT COUNT(*) as c FROM bills")
    count = cur.fetchone()["c"]
    return f"TL-{count + 1:06d}"


def _calculate(tons, selling_rate, purchase_rate, duty_per_kg, bag_weight, previous_balance):
    quantity_kg = tons * 1000
    bags = round(quantity_kg / bag_weight) if bag_weight else 0
    sales_amount = round(quantity_kg * selling_rate, 2)
    purchase_amount = round(quantity_kg * purchase_rate, 2)
    duty_amount = round(quantity_kg * duty_per_kg, 2)
    gross_profit = round(sales_amount - purchase_amount, 2)
    net_profit = round(gross_profit - duty_amount, 2)
    final_balance = round(previous_balance + sales_amount, 2)
    return {
        "quantity_kg": quantity_kg, "bags": bags, "sales_amount": sales_amount,
        "purchase_amount": purchase_amount, "duty_amount": duty_amount,
        "gross_profit": gross_profit, "net_profit": net_profit,
        "previous_balance": previous_balance, "final_balance": final_balance,
    }


@bp.route("", methods=["GET"])
@jwt_required
def list_bills():
    search = request.args.get("search", "").strip()
    customer_id = request.args.get("customer_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    query = """
        SELECT bills.*, customers.name as customer_name, products.name as product_name
        FROM bills
        JOIN customers ON customers.id = bills.customer_id
        JOIN products ON products.id = bills.product_id
        WHERE 1=1
    """
    params = []
    if search:
        query += " AND (bills.bill_number LIKE ? OR customers.name LIKE ?)"
        params += [f"%{search}%", f"%{search}%"]
    if customer_id:
        query += " AND bills.customer_id = ?"
        params.append(customer_id)
    if start_date:
        query += " AND bills.bill_date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND bills.bill_date <= ?"
        params.append(end_date)
    query += " ORDER BY bills.bill_date DESC, bills.id DESC"

    with db_cursor() as cur:
        cur.execute(query, params)
        bills = [dict(r) for r in cur.fetchall()]
    return jsonify(bills)


@bp.route("/<int:bill_id>", methods=["GET"])
@jwt_required
def get_bill(bill_id):
    with db_cursor() as cur:
        cur.execute("""
            SELECT bills.*, customers.name as customer_name, customers.mobile as customer_mobile,
                   customers.address as customer_address, products.name as product_name,
                   products.bag_weight as bag_weight
            FROM bills
            JOIN customers ON customers.id = bills.customer_id
            JOIN products ON products.id = bills.product_id
            WHERE bills.id = ?
        """, (bill_id,))
        row = cur.fetchone()
    if not row:
        return jsonify({"error": "Bill not found"}), 404
    return jsonify(dict(row))


@bp.route("", methods=["POST"])
@jwt_required
def create_bill():
    data = request.get_json(force=True) or {}
    required = ["customer_id", "product_id", "bill_date", "tons", "selling_rate", "purchase_rate"]
    missing = [f for f in required if data.get(f) in (None, "")]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    with db_cursor(commit=True) as cur:
        cur.execute("SELECT * FROM customers WHERE id = ?", (data["customer_id"],))
        customer = cur.fetchone()
        if not customer:
            return jsonify({"error": "Customer not found"}), 404
        cur.execute("SELECT * FROM products WHERE id = ?", (data["product_id"],))
        product = cur.fetchone()
        if not product:
            return jsonify({"error": "Product not found"}), 404

        previous_balance = _customer_balance(cur, customer["id"], customer["opening_balance"])
        calc = _calculate(
            float(data["tons"]), float(data["selling_rate"]), float(data["purchase_rate"]),
            float(data.get("duty_per_kg") or 0), product["bag_weight"], previous_balance,
        )
        bill_number = _next_bill_number(cur)

        cur.execute("""
            INSERT INTO bills (bill_number, customer_id, product_id, bill_date, tons, selling_rate,
                purchase_rate, duty_per_kg, vehicle_number, remarks, quantity_kg, bags, sales_amount,
                purchase_amount, duty_amount, gross_profit, net_profit, previous_balance, final_balance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            bill_number, customer["id"], product["id"], data["bill_date"], float(data["tons"]),
            float(data["selling_rate"]), float(data["purchase_rate"]), float(data.get("duty_per_kg") or 0),
            data.get("vehicle_number", ""), data.get("remarks", ""), calc["quantity_kg"], calc["bags"],
            calc["sales_amount"], calc["purchase_amount"], calc["duty_amount"], calc["gross_profit"],
            calc["net_profit"], calc["previous_balance"], calc["final_balance"],
        ))
        bill_id = cur.lastrowid

        cur.execute("""
            INSERT INTO transactions (customer_id, bill_id, txn_type, amount, balance_after, note, txn_date)
            VALUES (?, ?, 'bill', ?, ?, ?, ?)
        """, (customer["id"], bill_id, calc["sales_amount"], calc["final_balance"],
              f"Bill {bill_number}", data["bill_date"]))

    return jsonify({"message": "Bill created", "id": bill_id, "bill_number": bill_number, **calc}), 201


@bp.route("/<int:bill_id>", methods=["PUT"])
@jwt_required
def update_bill(bill_id):
    data = request.get_json(force=True) or {}
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT * FROM bills WHERE id = ?", (bill_id,))
        bill = cur.fetchone()
        if not bill:
            return jsonify({"error": "Bill not found"}), 404

        cur.execute("SELECT * FROM products WHERE id = ?", (data.get("product_id", bill["product_id"]),))
        product = cur.fetchone()

        cur.execute(
            "SELECT balance_after FROM transactions WHERE customer_id = ? AND id < "
            "(SELECT MIN(id) FROM transactions WHERE bill_id = ?) ORDER BY id DESC LIMIT 1",
            (bill["customer_id"], bill_id),
        )
        prev_row = cur.fetchone()
        cur.execute("SELECT opening_balance FROM customers WHERE id = ?", (bill["customer_id"],))
        opening = cur.fetchone()["opening_balance"]
        previous_balance = prev_row["balance_after"] if prev_row else opening

        tons = float(data.get("tons", bill["tons"]))
        selling_rate = float(data.get("selling_rate", bill["selling_rate"]))
        purchase_rate = float(data.get("purchase_rate", bill["purchase_rate"]))
        duty_per_kg = float(data.get("duty_per_kg", bill["duty_per_kg"]))
        calc = _calculate(tons, selling_rate, purchase_rate, duty_per_kg, product["bag_weight"], previous_balance)

        cur.execute("""
            UPDATE bills SET bill_date=?, tons=?, selling_rate=?, purchase_rate=?, duty_per_kg=?,
                vehicle_number=?, remarks=?, quantity_kg=?, bags=?, sales_amount=?, purchase_amount=?,
                duty_amount=?, gross_profit=?, net_profit=?, previous_balance=?, final_balance=?
            WHERE id = ?
        """, (
            data.get("bill_date", bill["bill_date"]), tons, selling_rate, purchase_rate, duty_per_kg,
            data.get("vehicle_number", bill["vehicle_number"]), data.get("remarks", bill["remarks"]),
            calc["quantity_kg"], calc["bags"], calc["sales_amount"], calc["purchase_amount"],
            calc["duty_amount"], calc["gross_profit"], calc["net_profit"], calc["previous_balance"],
            calc["final_balance"], bill_id,
        ))
        cur.execute(
            "UPDATE transactions SET amount = ?, balance_after = ?, txn_date = ? WHERE bill_id = ?",
            (calc["sales_amount"], calc["final_balance"], data.get("bill_date", bill["bill_date"]), bill_id),
        )
    return jsonify({"message": "Bill updated", **calc})


@bp.route("/<int:bill_id>", methods=["DELETE"])
@jwt_required
def delete_bill(bill_id):
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM bills WHERE id = ?", (bill_id,))
        if not cur.fetchone():
            return jsonify({"error": "Bill not found"}), 404
        cur.execute("DELETE FROM transactions WHERE bill_id = ?", (bill_id,))
        cur.execute("DELETE FROM bills WHERE id = ?", (bill_id,))
    return jsonify({"message": "Bill deleted"})


@bp.route("/<int:bill_id>/pdf", methods=["GET"])
@jwt_required
def bill_pdf(bill_id):
    bill = _full_bill(bill_id)
    if not bill:
        return jsonify({"error": "Bill not found"}), 404
    path = generate_bill_pdf(bill)
    return send_file(path, as_attachment=True, download_name=f"{bill['bill_number']}.pdf")


@bp.route("/<int:bill_id>/excel", methods=["GET"])
@jwt_required
def bill_excel(bill_id):
    bill = _full_bill(bill_id)
    if not bill:
        return jsonify({"error": "Bill not found"}), 404
    path = generate_bill_excel(bill)
    return send_file(path, as_attachment=True, download_name=f"{bill['bill_number']}.xlsx")


def _full_bill(bill_id):
    with db_cursor() as cur:
        cur.execute("""
            SELECT bills.*, customers.name as customer_name, customers.mobile as customer_mobile,
                   customers.address as customer_address, products.name as product_name
            FROM bills
            JOIN customers ON customers.id = bills.customer_id
            JOIN products ON products.id = bills.product_id
            WHERE bills.id = ?
        """, (bill_id,))
        row = cur.fetchone()
        if not row:
            return None
        bill = dict(row)
        cur.execute("SELECT * FROM business_profile ORDER BY id DESC LIMIT 1")
        profile = cur.fetchone()
        bill["business"] = dict(profile) if profile else {}
    return bill
