from flask import Blueprint, request, jsonify
from database import db_cursor
from auth_utils import jwt_required

bp = Blueprint("products", __name__, url_prefix="/api/products")


@bp.route("", methods=["GET"])
@jwt_required
def list_products():
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    query = "SELECT * FROM products WHERE 1=1"
    params = []
    if search:
        query += " AND name LIKE ?"
        params.append(f"%{search}%")
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY name"
    with db_cursor() as cur:
        cur.execute(query, params)
        products = [dict(r) for r in cur.fetchall()]
    return jsonify(products)


@bp.route("/<int:product_id>", methods=["GET"])
@jwt_required
def get_product(product_id):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM products WHERE id = ?", (product_id,))
        row = cur.fetchone()
    if not row:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(dict(row))


@bp.route("", methods=["POST"])
@jwt_required
def create_product():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Product name is required"}), 400
    with db_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO products (name, bag_weight, default_purchase_rate, default_selling_rate, status) "
            "VALUES (?, ?, ?, ?, ?)",
            (name, float(data.get("bag_weight") or 50), float(data.get("default_purchase_rate") or 0),
             float(data.get("default_selling_rate") or 0), data.get("status", "active")),
        )
        product_id = cur.lastrowid
    return jsonify({"message": "Product created", "id": product_id}), 201


@bp.route("/<int:product_id>", methods=["PUT"])
@jwt_required
def update_product(product_id):
    data = request.get_json(force=True) or {}
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM products WHERE id = ?", (product_id,))
        if not cur.fetchone():
            return jsonify({"error": "Product not found"}), 404
        cur.execute(
            "UPDATE products SET name = ?, bag_weight = ?, default_purchase_rate = ?, "
            "default_selling_rate = ?, status = ? WHERE id = ?",
            (data.get("name"), float(data.get("bag_weight") or 50),
             float(data.get("default_purchase_rate") or 0), float(data.get("default_selling_rate") or 0),
             data.get("status", "active"), product_id),
        )
    return jsonify({"message": "Product updated"})


@bp.route("/<int:product_id>", methods=["DELETE"])
@jwt_required
def delete_product(product_id):
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM bills WHERE product_id = ? LIMIT 1", (product_id,))
        if cur.fetchone():
            return jsonify({"error": "Cannot delete a product used in existing bills"}), 400
        cur.execute("DELETE FROM products WHERE id = ?", (product_id,))
    return jsonify({"message": "Product deleted"})
