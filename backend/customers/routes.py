from flask import Blueprint, request, jsonify
from database import db_cursor
from auth_utils import jwt_required

bp = Blueprint("customers", __name__, url_prefix="/api/customers")


def _customer_balance(cur, customer_id, opening_balance):
    cur.execute(
        "SELECT balance_after FROM transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1",
        (customer_id,),
    )
    row = cur.fetchone()
    return row["balance_after"] if row else opening_balance


@bp.route("", methods=["GET"])
@jwt_required
def list_customers():
    search = request.args.get("search", "").strip()
    with db_cursor() as cur:
        if search:
            cur.execute(
                "SELECT * FROM customers WHERE name LIKE ? OR mobile LIKE ? ORDER BY name",
                (f"%{search}%", f"%{search}%"),
            )
        else:
            cur.execute("SELECT * FROM customers ORDER BY name")
        customers = [dict(r) for r in cur.fetchall()]
        for c in customers:
            c["outstanding_balance"] = _customer_balance(cur, c["id"], c["opening_balance"])
    return jsonify(customers)


@bp.route("/<int:customer_id>", methods=["GET"])
@jwt_required
def get_customer(customer_id):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Customer not found"}), 404
        customer = dict(row)
        customer["outstanding_balance"] = _customer_balance(cur, customer_id, customer["opening_balance"])
    return jsonify(customer)


@bp.route("", methods=["POST"])
@jwt_required
def create_customer():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Customer name is required"}), 400

    opening_balance = float(data.get("opening_balance") or 0)
    with db_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO customers (name, mobile, address, gst_number, opening_balance) VALUES (?, ?, ?, ?, ?)",
            (name, data.get("mobile", ""), data.get("address", ""), data.get("gst_number", ""), opening_balance),
        )
        customer_id = cur.lastrowid
        if opening_balance:
            cur.execute(
                "INSERT INTO transactions (customer_id, txn_type, amount, balance_after, note, txn_date) "
                "VALUES (?, 'adjustment', ?, ?, 'Opening balance', date('now'))",
                (customer_id, opening_balance, opening_balance),
            )
    return jsonify({"message": "Customer created", "id": customer_id}), 201


@bp.route("/<int:customer_id>", methods=["PUT"])
@jwt_required
def update_customer(customer_id):
    data = request.get_json(force=True) or {}
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM customers WHERE id = ?", (customer_id,))
        if not cur.fetchone():
            return jsonify({"error": "Customer not found"}), 404
        cur.execute(
            "UPDATE customers SET name = ?, mobile = ?, address = ?, gst_number = ? WHERE id = ?",
            (data.get("name"), data.get("mobile", ""), data.get("address", ""),
             data.get("gst_number", ""), customer_id),
        )
    return jsonify({"message": "Customer updated"})


@bp.route("/<int:customer_id>", methods=["DELETE"])
@jwt_required
def delete_customer(customer_id):
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM bills WHERE customer_id = ? LIMIT 1", (customer_id,))
        if cur.fetchone():
            return jsonify({"error": "Cannot delete a customer with existing bills"}), 400
        cur.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    return jsonify({"message": "Customer deleted"})


@bp.route("/<int:customer_id>/ledger", methods=["GET"])
@jwt_required
def customer_ledger(customer_id):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
        customer = cur.fetchone()
        if not customer:
            return jsonify({"error": "Customer not found"}), 404
        cur.execute(
            "SELECT * FROM transactions WHERE customer_id = ? ORDER BY txn_date, id",
            (customer_id,),
        )
        txns = [dict(r) for r in cur.fetchall()]
    return jsonify({"customer": dict(customer), "transactions": txns})


@bp.route("/<int:customer_id>/payments", methods=["POST"])
@jwt_required
def add_payment(customer_id):
    data = request.get_json(force=True) or {}
    amount = float(data.get("amount") or 0)
    if amount <= 0:
        return jsonify({"error": "Payment amount must be greater than zero"}), 400

    with db_cursor(commit=True) as cur:
        cur.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
        customer = cur.fetchone()
        if not customer:
            return jsonify({"error": "Customer not found"}), 404
        current_balance = _customer_balance(cur, customer_id, customer["opening_balance"])
        new_balance = current_balance - amount
        cur.execute(
            "INSERT INTO transactions (customer_id, txn_type, amount, balance_after, note, txn_date) "
            "VALUES (?, 'payment', ?, ?, ?, ?)",
            (customer_id, -amount, new_balance, data.get("note", "Payment received"),
             data.get("date") or __import__("datetime").date.today().isoformat()),
        )
    return jsonify({"message": "Payment recorded", "new_balance": new_balance}), 201
