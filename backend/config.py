import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Config:
    SECRET_KEY = os.environ.get("TRADELEDGER_SECRET_KEY", "dev-secret-change-this-in-production")
    DATABASE_PATH = os.path.join(BASE_DIR, "database", "tradeledger.db")
    BILLS_DIR = os.path.join(BASE_DIR, "bills")
    REPORTS_DIR = os.path.join(BASE_DIR, "reports")
    BACKUPS_DIR = os.path.join(BASE_DIR, "backups")
    UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
    LOGS_DIR = os.path.join(BASE_DIR, "logs")
    JWT_EXP_HOURS = 12
    JWT_ALGORITHM = "HS256"

    @staticmethod
    def ensure_dirs():
        for d in [Config.BILLS_DIR, Config.REPORTS_DIR, Config.BACKUPS_DIR,
                  Config.UPLOADS_DIR, Config.LOGS_DIR, os.path.dirname(Config.DATABASE_PATH)]:
            os.makedirs(d, exist_ok=True)
