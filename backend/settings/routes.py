from flask import Blueprint, request, jsonify
from database import db_cursor
from auth_utils import jwt_required

bp = Blueprint("settings", __name__, url_prefix="/api/settings")

DEFAULTS = {
    "default_bag_weight": "50",
    "theme": "dark",
    "printer": "",
    "backup_location": "backups/",
}


@bp.route("", methods=["GET"])
@jwt_required
def get_settings():
    with db_cursor() as cur:
        cur.execute("SELECT key, value FROM settings")
        rows = {r["key"]: r["value"] for r in cur.fetchall()}
    merged = {**DEFAULTS, **rows}
    return jsonify(merged)


@bp.route("", methods=["PUT"])
@jwt_required
def update_settings():
    data = request.get_json(force=True) or {}
    with db_cursor(commit=True) as cur:
        for key, value in data.items():
            cur.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, str(value)),
            )
    return jsonify({"message": "Settings updated"})
