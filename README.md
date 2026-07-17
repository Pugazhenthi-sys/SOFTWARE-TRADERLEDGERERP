# TradeLedger ERP

A web-based ERP for wholesale rice and grain traders — customers, products,
bill generation with auto-calculated profit/loss, ledger, expenses, reports
(PDF/Excel), dashboard analytics, and backups.

This is a **web app**: Flask REST API backend + a React frontend served by
the same server. Run it locally (or on any server) and use it from a browser
on your desktop, laptop, or phone on the same network.

---

## 1. Requirements

- Python 3.9+
- A modern browser (Chrome, Edge, Firefox). No Node.js or npm needed — the
  frontend is a single-page React app loaded via CDN, no build step required.

## 2. Setup

```bash
cd TradeLedgerERP/backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 3. Run

```bash
cd TradeLedgerERP/backend
python app.py
```

The server starts at **http://localhost:5000** and also serves the frontend
at the same address — just open that URL in your browser. There's nothing
else to start.

To access it from another device on your network (e.g. a phone), find your
computer's local IP (e.g. `192.168.1.20`) and open `http://192.168.1.20:5000`.

## 4. First use

1. Open the app → **Register** the first account (this becomes the Owner).
2. Log in.
3. Go to **Settings → Business Profile** and fill in your business details
   (name, GST, bank info, logo) — this appears on generated bills.
4. Add your **Products** (e.g. Ponni, IR64, ADT, SMP) with bag weight and
   default rates.
5. Add your **Customers**.
6. Start creating **Bills** — tons, rate, duty are entered; quantity, bags,
   profit and running balance are calculated automatically, and a PDF/Excel
   copy is generated.

## 5. Project layout

```
TradeLedgerERP/
├── backend/          Flask REST API (auth, customers, products, billing,
│                      ledger, dashboard, reports, expenses, backup, settings)
│   └── app.py         entry point — run this
├── frontend/          Single-page React app (index.html + app.js)
├── database/          SQLite database file (auto-created on first run)
├── bills/             Generated bill PDFs/Excel files
├── reports/           Generated report exports
├── backups/           One-click backup zip files
├── uploads/           Logo/signature uploads
└── logs/              Application logs
```

## 6. Database

SQLite by default (`database/tradeledger.db`), created automatically on
first run — no setup needed. To move to MySQL/PostgreSQL later, only
`backend/database.py` and `backend/config.py` need to change; the route
modules use plain SQL through a small `db_cursor()` helper, not tied to
SQLite-specific syntax beyond the schema file.

## 7. Deploying it as a real "website" (beyond localhost)

To make this reachable at a real URL instead of just localhost:

- **Simplest**: run it on a small VPS (DigitalOcean, Hetzner, etc.) behind
  Nginx as a reverse proxy, with `gunicorn` instead of the Flask dev server:
  `pip install gunicorn && gunicorn -w 4 -b 0.0.0.0:5000 app:app`
- Put SQLite on a persistent disk, or switch `DATABASE_URL` in `config.py`
  to a managed Postgres/MySQL instance for multi-user concurrent access.
- Put it behind HTTPS (Let's Encrypt via Nginx/Caddy) before using it with
  real customer/financial data.

## 8. Roadmap (v2)

GST invoicing & e-invoice, barcode/QR, thermal printer support, WhatsApp
bill sharing, SMS notifications, inventory & supplier/purchase modules,
cloud backup, mobile app, Tamil language support.
