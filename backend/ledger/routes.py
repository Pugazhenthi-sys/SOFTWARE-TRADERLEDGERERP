from flask import Blueprint, request, jsonify
from database import db_cursor
from auth_utils import jwt_required

bp = Blueprint("ledger", __name__, url_prefix="/api/ledger")


@bp.route("/transactions", methods=["GET"])
@jwt_required
def all_transactions():
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    query = """
        SELECT transactions.*, customers.name as customer_name
        FROM transactions
        JOIN customers ON customers.id = transactions.customer_id
        WHERE 1=1
    """
    params = []
    if start_date:
        query += " AND txn_date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND txn_date <= ?"
        params.append(end_date)
    query += " ORDER BY txn_date DESC, transactions.id DESC LIMIT 500"
    with db_cursor() as cur:
        cur.execute(query, params)
        rows = [dict(r) for r in cur.fetchall()]
    return jsonify(rows)


@bp.route("/outstanding", methods=["GET"])
@jwt_required
def outstanding_summary():
    with db_cursor() as cur:
        cur.execute("SELECT id, name, opening_balance FROM customers ORDER BY name")
        customers = cur.fetchall()
        result = []
        total_outstanding = 0
        for c in customers:
            cur.execute(
                "SELECT balance_after FROM transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1",
                (c["id"],),
            )
            row = cur.fetchone()
            balance = row["balance_after"] if row else c["opening_balance"]
            if balance != 0:
                result.append({"customer_id": c["id"], "customer_name": c["name"], "balance": balance})
                total_outstanding += balance
        result.sort(key=lambda x: x["balance"], reverse=True)
    return jsonify({"customers": result, "total_outstanding": round(total_outstanding, 2)})
