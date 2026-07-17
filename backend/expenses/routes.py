from flask import Blueprint, request, jsonify
from database import db_cursor
from auth_utils import jwt_required

bp = Blueprint("expenses", __name__, url_prefix="/api/expenses")

CATEGORIES = ["Labour", "Diesel", "Electricity", "Rent", "Maintenance", "Miscellaneous"]


@bp.route("/categories", methods=["GET"])
@jwt_required
def categories():
    return jsonify(CATEGORIES)


@bp.route("", methods=["GET"])
@jwt_required
def list_expenses():
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    category = request.args.get("category")
    query = "SELECT * FROM expenses WHERE 1=1"
    params = []
    if start_date:
        query += " AND expense_date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND expense_date <= ?"
        params.append(end_date)
    if category:
        query += " AND category = ?"
        params.append(category)
    query += " ORDER BY expense_date DESC, id DESC"
    with db_cursor() as cur:
        cur.execute(query, params)
        expenses = [dict(r) for r in cur.fetchall()]
    return jsonify(expenses)


@bp.route("", methods=["POST"])
@jwt_required
def create_expense():
    data = request.get_json(force=True) or {}
    amount = float(data.get("amount") or 0)
    category = data.get("category") or "Miscellaneous"
    expense_date = data.get("expense_date")
    if amount <= 0 or not expense_date:
        return jsonify({"error": "Amount and expense date are required"}), 400
    with db_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO expenses (category, amount, expense_date, note) VALUES (?, ?, ?, ?)",
            (category, amount, expense_date, data.get("note", "")),
        )
        expense_id = cur.lastrowid
    return jsonify({"message": "Expense recorded", "id": expense_id}), 201


@bp.route("/<int:expense_id>", methods=["PUT"])
@jwt_required
def update_expense(expense_id):
    data = request.get_json(force=True) or {}
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM expenses WHERE id = ?", (expense_id,))
        if not cur.fetchone():
            return jsonify({"error": "Expense not found"}), 404
        cur.execute(
            "UPDATE expenses SET category = ?, amount = ?, expense_date = ?, note = ? WHERE id = ?",
            (data.get("category"), float(data.get("amount") or 0), data.get("expense_date"),
             data.get("note", ""), expense_id),
        )
    return jsonify({"message": "Expense updated"})


@bp.route("/<int:expense_id>", methods=["DELETE"])
@jwt_required
def delete_expense(expense_id):
    with db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    return jsonify({"message": "Expense deleted"})


@bp.route("/summary", methods=["GET"])
@jwt_required
def expense_summary():
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    query = "SELECT category, SUM(amount) as total FROM expenses WHERE 1=1"
    params = []
    if start_date:
        query += " AND expense_date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND expense_date <= ?"
        params.append(end_date)
    query += " GROUP BY category ORDER BY total DESC"
    with db_cursor() as cur:
        cur.execute(query, params)
        result = [dict(r) for r in cur.fetchall()]
    return jsonify(result)
