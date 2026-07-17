from flask import Blueprint, request, jsonify, g
from database import db_cursor
from auth_utils import hash_password, verify_password, create_token, jwt_required

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = data.get("role") or "staff"

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required"}), 400
    if role not in ("owner", "staff"):
        role = "staff"
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM users")
        is_first_user = cur.fetchone() is None
        if is_first_user:
            role = "owner"  # first registered user becomes the owner

        cur.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cur.fetchone():
            return jsonify({"error": "An account with this email already exists"}), 409

        cur.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (name, email, hash_password(password), role),
        )
        user_id = cur.lastrowid

    token = create_token(user_id, name, email, role)
    return jsonify({"token": token, "user": {"id": user_id, "name": name, "email": email, "role": role}}), 201


@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    with db_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cur.fetchone()

    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_token(user["id"], user["name"], user["email"], user["role"])
    return jsonify({
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}
    })


@bp.route("/me", methods=["GET"])
@jwt_required
def me():
    return jsonify({"user": {
        "id": g.user["sub"], "name": g.user["name"], "email": g.user["email"], "role": g.user["role"]
    }})


@bp.route("/logout", methods=["POST"])
@jwt_required
def logout():
    # Stateless JWT - client discards the token. Endpoint exists for a clean API contract.
    return jsonify({"message": "Logged out successfully"})
