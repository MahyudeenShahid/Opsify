import os
import csv
from datetime import datetime
from company_brain.inventory import get_db_connection

def sync_inventory_to_sheets():
    """
    Attempts to sync inventory with Google Sheets via gspread.
    If 'service_account.json' or the gspread library is missing,
    it falls back to exporting a local mock_google_sheet.csv.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT w.name as warehouse_name, p.sku, p.name as product_name, p.variant, 
               p.unit, pw.stock, pw.reorder_threshold
        FROM product_warehouses pw
        JOIN products p ON pw.product_id = p.id
        JOIN warehouses w ON pw.warehouse_id = w.id
        ORDER BY w.name, p.name
    """)
    rows = cursor.fetchall()
    conn.close()

    headers = ["Warehouse", "SKU", "Product", "Variant", "Unit", "Current Stock", "Reorder Threshold", "Last Synced"]
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
            timestamp
        ])

    try:
        import gspread
        from google.oauth2.service_account import Credentials
        
        credentials_path = "service_account.json"
        if not os.path.exists(credentials_path):
            raise FileNotFoundError("service_account.json not found.")

        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        
        creds = Credentials.from_service_account_file(credentials_path, scopes=scopes)
        client = gspread.authorize(creds)
        
        # We assume the user has a sheet named "Opsify Inventory Sync"
        sheet = client.open("Opsify Inventory Sync").sheet1
        sheet.clear()
        sheet.update("A1", data_matrix)
        
        return {"status": "success", "message": "Successfully synced to live Google Sheets!", "fallback": False}

    except Exception as e:
        # Fallback to local CSV export
        csv_path = "mock_google_sheet.csv"
        with open(csv_path, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(data_matrix)
            
        return {
            "status": "success", 
            "message": f"Service Account missing or error: {str(e)}. Fallback to local CSV export at {csv_path}.",
            "fallback": True
        }
