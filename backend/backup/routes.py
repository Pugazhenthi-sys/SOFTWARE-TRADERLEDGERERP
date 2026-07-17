import os
import zipfile
import datetime
import shutil
from flask import Blueprint, jsonify, send_file, request
from database import db_cursor
from auth_utils import jwt_required, owner_required
from config import Config

bp = Blueprint("backup", __name__, url_prefix="/api/backup")


@bp.route("", methods=["POST"])
@jwt_required
@owner_required
def create_backup():
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.zip"
    path = os.path.join(Config.BACKUPS_DIR, filename)

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        if os.path.exists(Config.DATABASE_PATH):
            zf.write(Config.DATABASE_PATH, arcname="database/tradeledger.db")
        for folder, arc_prefix in [(Config.BILLS_DIR, "bills"), (Config.UPLOADS_DIR, "uploads")]:
            for root, _, files in os.walk(folder):
                for f in files:
                    full_path = os.path.join(root, f)
                    arcname = os.path.join(arc_prefix, os.path.relpath(full_path, folder))
                    zf.write(full_path, arcname=arcname)

    with db_cursor(commit=True) as cur:
        cur.execute("INSERT INTO backup_logs (filename) VALUES (?)", (filename,))

    return jsonify({"message": "Backup created", "filename": filename})


@bp.route("", methods=["GET"])
@jwt_required
def list_backups():
    with db_cursor() as cur:
        cur.execute("SELECT * FROM backup_logs ORDER BY id DESC")
        logs = [dict(r) for r in cur.fetchall()]
    return jsonify(logs)


@bp.route("/<filename>/download", methods=["GET"])
@jwt_required
def download_backup(filename):
    path = os.path.join(Config.BACKUPS_DIR, filename)
    if not os.path.exists(path):
        return jsonify({"error": "Backup file not found"}), 404
    return send_file(path, as_attachment=True, download_name=filename)


@bp.route("/restore", methods=["POST"])
@jwt_required
@owner_required
def restore_backup():
    filename = (request.get_json(force=True) or {}).get("filename")
    if not filename:
        return jsonify({"error": "Backup filename is required"}), 400
    path = os.path.join(Config.BACKUPS_DIR, filename)
    if not os.path.exists(path):
        return jsonify({"error": "Backup file not found"}), 404

    with zipfile.ZipFile(path, "r") as zf:
        temp_dir = os.path.join(Config.BACKUPS_DIR, "_restore_tmp")
        os.makedirs(temp_dir, exist_ok=True)
        zf.extractall(temp_dir)
        restored_db = os.path.join(temp_dir, "database", "tradeledger.db")
        if os.path.exists(restored_db):
            shutil.copy(restored_db, Config.DATABASE_PATH)
        for sub, dest in [("bills", Config.BILLS_DIR), ("uploads", Config.UPLOADS_DIR)]:
            src = os.path.join(temp_dir, sub)
            if os.path.exists(src):
                for f in os.listdir(src):
                    shutil.copy(os.path.join(src, f), os.path.join(dest, f))
        shutil.rmtree(temp_dir, ignore_errors=True)

    return jsonify({"message": "Backup restored successfully"})
