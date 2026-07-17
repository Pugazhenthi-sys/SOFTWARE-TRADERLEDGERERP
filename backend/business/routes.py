from flask import Blueprint, request, jsonify
from database import db_cursor
from auth_utils import jwt_required

bp = Blueprint("business", __name__, url_prefix="/api/business-profile")

FIELDS = ["business_name", "business_type", "gst_number", "mobile_number", "email",
          "address", "bank_name", "account_number", "ifsc", "branch", "logo_path", "signature_path"]


@bp.route("", methods=["GET"])
@jwt_required
def get_profile():
    with db_cursor() as cur:
        cur.execute("SELECT * FROM business_profile ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
    return jsonify(dict(row) if row else {})


@bp.route("", methods=["PUT", "POST"])
@jwt_required
def save_profile():
    data = request.get_json(force=True) or {}
    values = {f: data.get(f, "") for f in FIELDS}

    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM business_profile ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        if row:
            set_clause = ", ".join([f"{f} = ?" for f in FIELDS])
            cur.execute(
                f"UPDATE business_profile SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
                (*values.values(), row["id"]),
            )
            profile_id = row["id"]
        else:
            cols = ", ".join(FIELDS)
            qmarks = ", ".join(["?"] * len(FIELDS))
            cur.execute(f"INSERT INTO business_profile ({cols}) VALUES ({qmarks})", tuple(values.values()))
            profile_id = cur.lastrowid

    return jsonify({"message": "Business profile saved", "id": profile_id})
