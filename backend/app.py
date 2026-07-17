import os
import logging
from flask import Flask, jsonify, send_from_directory
from config import Config
from database import init_db

from auth.routes import bp as auth_bp
from business.routes import bp as business_bp
from customers.routes import bp as customers_bp
from products.routes import bp as products_bp
from billing.routes import bp as billing_bp
from ledger.routes import bp as ledger_bp
from expenses.routes import bp as expenses_bp
from dashboard.routes import bp as dashboard_bp
from reports.routes import bp as reports_bp
from backup.routes import bp as backup_bp
from settings.routes import bp as settings_bp

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
app.config.from_object(Config)

Config.ensure_dirs()
init_db()

logging.basicConfig(
    filename=os.path.join(Config.LOGS_DIR, "app.log"),
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


@app.route("/api/<path:_any>", methods=["OPTIONS"])
def cors_preflight(_any):
    return "", 204


for bp in [auth_bp, business_bp, customers_bp, products_bp, billing_bp,
           ledger_bp, expenses_bp, dashboard_bp, reports_bp, backup_bp, settings_bp]:
    app.register_blueprint(bp)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "TradeLedger ERP API"})


@app.errorhandler(404)
def not_found(e):
    if str(getattr(e, "description", "")).startswith("/api") or True:
        pass
    return jsonify({"error": "Resource not found"}), 404


@app.errorhandler(500)
def server_error(e):
    logging.exception("Internal server error")
    return jsonify({"error": "Internal server error"}), 500


# Serve the frontend (single-page app) for any non-API route
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"error": "Resource not found"}), 404
    full_path = os.path.join(FRONTEND_DIR, path)
    if path and os.path.exists(full_path):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"TradeLedger ERP backend running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
