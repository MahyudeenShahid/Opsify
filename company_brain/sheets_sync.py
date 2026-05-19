# File: company_brain/sheets_sync.py
#
# ## Purpose
# Syncs the live SQLite inventory snapshot to Google Sheets via gspread.
# Falls back to a local CSV export if the service account is missing.
#
# Configuration (set in .env):
#   GOOGLE_SERVICE_ACCOUNT_PATH  — path to service_account.json  (default: service_account.json)
#   GOOGLE_SHEETS_NAME           — the spreadsheet title to open  (default: Opsify Inventory Sync)

import os
import csv
from datetime import datetime
from company_brain.inventory import get_db_connection

# Read configuration from environment (populated by load_dotenv() in main.py)
_SA_PATH   = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PATH", "service_account.json")
_SHEET_NAME = os.environ.get("GOOGLE_SHEETS_NAME", "Opsify Inventory Sync")


def sync_inventory_to_sheets():
    """
    Attempts to sync inventory with Google Sheets via gspread.

    Primary path:
      1. Reads GOOGLE_SERVICE_ACCOUNT_PATH and GOOGLE_SHEETS_NAME from env.
      2. Authenticates with the service account.
      3. Opens the configured spreadsheet by name.
      4. Writes current stock snapshot (clears first).

    Fallback path (service account missing, gspread error, etc.):
      - Exports a local mock_google_sheet.csv with the same data.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT w.name AS warehouse_name, p.sku, p.name AS product_name, p.variant,
               p.unit, pw.stock, pw.reorder_threshold,
               p.cost_price, p.selling_price, s.name AS supplier_name
        FROM product_warehouses pw
        JOIN products p      ON pw.product_id   = p.id
        JOIN warehouses w    ON pw.warehouse_id  = w.id
        LEFT JOIN suppliers s ON p.supplier_id  = s.id
        ORDER BY w.name, p.name
    """)
    rows = cursor.fetchall()
    conn.close()

    headers = [
        "Warehouse", "SKU", "Product", "Variant", "Unit",
        "Current Stock", "Reorder Threshold",
        "Cost Price (PKR)", "Selling Price (PKR)", "Supplier",
        "Last Synced"
    ]
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    data_matrix = [headers]
    for r in rows:
        data_matrix.append([
            r["warehouse_name"],
            r["sku"],
            r["product_name"],
            r["variant"],
            r["unit"],
            r["stock"],
            r["reorder_threshold"],
            r["cost_price"],
            r["selling_price"],
            r["supplier_name"] or "N/A",
            timestamp,
        ])

    # ── PRIMARY: Live Google Sheets ───────────────────────────────────────────
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        if not os.path.exists(_SA_PATH):
            raise FileNotFoundError(
                f"Service account not found at '{_SA_PATH}'. "
                f"Set GOOGLE_SERVICE_ACCOUNT_PATH in .env to point to your JSON key file."
            )

        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]

        creds  = Credentials.from_service_account_file(_SA_PATH, scopes=scopes)
        client = gspread.authorize(creds)
        sheet  = client.open(_SHEET_NAME).sheet1
        sheet.clear()
        sheet.update("A1", data_matrix)

        return {
            "status":   "success",
            "message":  f"Successfully synced {len(rows)} rows to Google Sheets: '{_SHEET_NAME}'.",
            "rows":     len(rows),
            "sheet":    _SHEET_NAME,
            "fallback": False,
        }

    # ── FALLBACK: Local CSV ───────────────────────────────────────────────────
    except Exception as e:
        csv_path = "mock_google_sheet.csv"
        with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerows(data_matrix)

        return {
            "status":  "success",
            "message": (
                f"Google Sheets sync skipped ({str(e)[:80]}). "
                f"Fallback CSV exported to '{csv_path}' with {len(rows)} rows."
            ),
            "rows":    len(rows),
            "fallback": True,
            "csv_path": csv_path,
        }
