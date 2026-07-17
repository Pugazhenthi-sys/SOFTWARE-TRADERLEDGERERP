import datetime
from flask import Blueprint, jsonify
from database import db_cursor
from auth_utils import jwt_required

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


def _today():
    return datetime.date.today().isoformat()


def _month_start():
    return datetime.date.today().replace(day=1).isoformat()


@bp.route("/summary", methods=["GET"])
@jwt_required
def summary():
    today = _today()
    month_start = _month_start()
    with db_cursor() as cur:
        cur.execute("SELECT COALESCE(SUM(sales_amount),0) s, COALESCE(SUM(net_profit),0) p FROM bills WHERE bill_date = ?", (today,))
        today_row = cur.fetchone()

        cur.execute("SELECT COALESCE(SUM(sales_amount),0) s, COALESCE(SUM(net_profit),0) p FROM bills WHERE bill_date >= ?", (month_start,))
        month_row = cur.fetchone()

        cur.execute("SELECT COUNT(*) c FROM customers")
        total_customers = cur.fetchone()["c"]

        cur.execute("SELECT COUNT(*) c FROM bills")
        total_bills = cur.fetchone()["c"]

        cur.execute("SELECT COALESCE(SUM(amount),0) s FROM expenses WHERE expense_date >= ?", (month_start,))
        total_expenses = cur.fetchone()["s"]

        cur.execute("SELECT id, opening_balance FROM customers")
        outstanding = 0
        for c in cur.fetchall():
            cur.execute(
                "SELECT balance_after FROM transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1",
                (c["id"],),
            )
            row = cur.fetchone()
            outstanding += row["balance_after"] if row else c["opening_balance"]

    return jsonify({
        "today_sales": today_row["s"], "today_profit": today_row["p"],
        "monthly_sales": month_row["s"], "monthly_profit": month_row["p"],
        "outstanding_balance": round(outstanding, 2),
        "total_customers": total_customers, "total_bills": total_bills,
        "total_expenses_this_month": total_expenses,
    })


@bp.route("/charts", methods=["GET"])
@jwt_required
def charts():
    with db_cursor() as cur:
        cur.execute("""
            SELECT bill_date, SUM(sales_amount) as sales FROM bills
            WHERE bill_date >= date('now', '-29 days')
            GROUP BY bill_date ORDER BY bill_date
        """)
        daily_sales = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT strftime('%Y-%m', bill_date) as month, SUM(net_profit) as profit FROM bills
            WHERE bill_date >= date('now', '-11 months')
            GROUP BY month ORDER BY month
        """)
        monthly_profit = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT customers.name, COUNT(bills.id) as bill_count, COALESCE(SUM(bills.sales_amount),0) as total_sales
            FROM customers LEFT JOIN bills ON bills.customer_id = customers.id
            GROUP BY customers.id ORDER BY total_sales DESC LIMIT 10
        """)
        customer_stats = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT products.name, COALESCE(SUM(bills.sales_amount),0) as total_sales
            FROM products LEFT JOIN bills ON bills.product_id = products.id
            GROUP BY products.id ORDER BY total_sales DESC
        """)
        brand_sales = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT category, COALESCE(SUM(amount),0) as total FROM expenses
            GROUP BY category ORDER BY total DESC
        """)
        expense_analysis = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT id, name, opening_balance FROM customers")
        outstanding_rows = []
        for c in cur.fetchall():
            cur.execute(
                "SELECT balance_after FROM transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1",
                (c["id"],),
            )
            row = cur.fetchone()
            bal = row["balance_after"] if row else c["opening_balance"]
            if bal > 0:
                outstanding_rows.append({"name": c["name"], "balance": bal})
        outstanding_rows.sort(key=lambda x: x["balance"], reverse=True)

    return jsonify({
        "daily_sales": daily_sales,
        "monthly_profit": monthly_profit,
        "customer_statistics": customer_stats,
        "brand_wise_sales": brand_sales,
        "expense_analysis": expense_analysis,
        "outstanding_collection": outstanding_rows[:10],
    })


@bp.route("/recent-activity", methods=["GET"])
@jwt_required
def recent_activity():
    with db_cursor() as cur:
        cur.execute("""
            SELECT bills.id, bills.bill_number, bills.bill_date, bills.sales_amount, customers.name as customer_name
            FROM bills JOIN customers ON customers.id = bills.customer_id
            ORDER BY bills.id DESC LIMIT 5
        """)
        recent_bills = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT transactions.id, transactions.txn_date, transactions.amount, customers.name as customer_name
            FROM transactions JOIN customers ON customers.id = transactions.customer_id
            WHERE txn_type = 'payment' ORDER BY transactions.id DESC LIMIT 5
        """)
        recent_payments = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT id, category, amount, expense_date, note FROM expenses ORDER BY id DESC LIMIT 5")
        recent_expenses = [dict(r) for r in cur.fetchall()]

    return jsonify({"bills": recent_bills, "payments": recent_payments, "expenses": recent_expenses})


@bp.route("/analytics", methods=["GET"])
@jwt_required
def analytics():
    with db_cursor() as cur:
        cur.execute("""
            SELECT customers.name, SUM(bills.sales_amount) as total_sales, SUM(bills.net_profit) as total_profit
            FROM bills JOIN customers ON customers.id = bills.customer_id
            GROUP BY customers.id ORDER BY total_profit DESC LIMIT 10
        """)
        top_customers_by_profit = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT customers.name, SUM(bills.sales_amount) as total_sales
            FROM bills JOIN customers ON customers.id = bills.customer_id
            GROUP BY customers.id ORDER BY total_sales DESC LIMIT 10
        """)
        top_customers_by_sales = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT products.name,
                   AVG(bills.selling_rate) as avg_selling_rate,
                   AVG(bills.purchase_rate) as avg_purchase_rate,
                   CASE WHEN SUM(bills.sales_amount) > 0
                        THEN ROUND(SUM(bills.net_profit) * 100.0 / SUM(bills.sales_amount), 2)
                        ELSE 0 END as profit_margin_pct,
                   SUM(bills.sales_amount) as total_sales
            FROM bills JOIN products ON products.id = bills.product_id
            GROUP BY products.id ORDER BY total_sales DESC
        """)
        product_performance = [dict(r) for r in cur.fetchall()]

    return jsonify({
        "top_customers_by_profit": top_customers_by_profit,
        "top_customers_by_sales": top_customers_by_sales,
        "product_performance": product_performance,
    })
