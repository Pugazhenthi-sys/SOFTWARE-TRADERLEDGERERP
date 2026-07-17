import jwt
import datetime
from functools import wraps
from flask import request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config


def hash_password(password):
    return generate_password_hash(password)


def verify_password(password, password_hash):
    return check_password_hash(password_hash, password)


def create_token(user_id, name, email, role):
    payload = {
        "sub": user_id,
        "name": name,
        "email": email,
        "role": role,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=Config.JWT_EXP_HOURS),
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm=Config.JWT_ALGORITHM)


def decode_token(token):
    return jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.JWT_ALGORITHM])


def _extract_token():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1]
    return None


def jwt_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({"error": "Missing authentication token"}), 401
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired, please log in again"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid authentication token"}), 401
        g.user = payload
        return fn(*args, **kwargs)
    return wrapper


def owner_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not hasattr(g, "user") or g.user.get("role") != "owner":
            return jsonify({"error": "This action requires owner access"}), 403
        return fn(*args, **kwargs)
    return wrapper
