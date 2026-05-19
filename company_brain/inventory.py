# File: company_brain/inventory.py
#
# ## Purpose
# Manage persistent SQLite operations for a multi-warehouse ERP system.
import sqlite3
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any

# DB_PATH can be overridden by tests (set module attribute before importing functions)
DB_PATH = os.environ.get("OPSIFY_DB_PATH", "opsify_business.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = 1")
    conn.execute("PRAGMA journal_mode=WAL")   # Better concurrent write safety
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Warehouses
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS warehouses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL
        )
    """)

    # 2. Suppliers
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            contact TEXT,
            rating REAL,
            reliability_score REAL,
            lead_time_days INTEGER
        )
    """)
    
    # 3. Products Catalog
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT,
            variant TEXT,
            unit TEXT,
            cost_price REAL NOT NULL,
            selling_price REAL NOT NULL,
            supplier_id INTEGER,
            FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        )
    """)
    
    # 4. Product Warehouses (Stock & Thresholds per location)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS product_warehouses (
            product_id INTEGER,
            warehouse_id INTEGER,
            stock REAL NOT NULL,
            reorder_threshold REAL NOT NULL,
            PRIMARY KEY (product_id, warehouse_id),
            FOREIGN KEY (product_id) REFERENCES products (id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
        )
    """)
    
    # 5. Transactions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            warehouse_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            reason TEXT,
            quantity REAL NOT NULL,
            total_value REAL NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products (id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
        )
    """)
    
    # Seed Data
    cursor.execute("SELECT COUNT(*) FROM warehouses")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO warehouses (name, location) VALUES (?, ?)", ("Alpha Depot", "Karachi"))
        wh_alpha = cursor.lastrowid
        cursor.execute("INSERT INTO warehouses (name, location) VALUES (?, ?)", ("Beta Hub", "Lahore"))
        wh_beta = cursor.lastrowid

        cursor.executemany("INSERT INTO suppliers (name, contact, rating, reliability_score, lead_time_days) VALUES (?, ?, ?, ?, ?)", [
            ("Dairy Central", "info@dairy.com", 4.8, 95.0, 3),
            ("BuildMart", "sales@buildmart.com", 4.5, 88.0, 4),
            ("Speedy Supply", "fast@speedy.com", 4.0, 90.0, 1),
            ("Discount Depot", "cheap@discount.com", 3.2, 70.0, 5)
        ])
        
        cursor.executemany("""
            INSERT INTO products (sku, name, category, variant, unit, cost_price, selling_price, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            ("MLK-001", "Milk", "Dairy", "Full Cream", "Liters", 100.0, 150.0, 1),
            ("WR-001", "Wire", "Hardware", "10 Gauge Copper", "Meters", 30.0, 45.0, 2),
            ("PP-001", "Pipe", "Hardware", "PVC 2 inch", "Pieces", 80.0, 120.0, 2),
            ("BKR-001", "Bread", "Bakery", "Whole Wheat", "Loaves", 40.0, 60.0, 1)
        ])
        
        # Seed initial stock into Alpha and Beta warehouses
        cursor.executemany("""
            INSERT INTO product_warehouses (product_id, warehouse_id, stock, reorder_threshold)
            VALUES (?, ?, ?, ?)
        """, [
            (1, wh_alpha, 25.0, 5.0), # Milk in Alpha
            (1, wh_beta, 10.0, 5.0),  # Milk in Beta
            (2, wh_alpha, 100.0, 15.0),
            (3, wh_beta, 50.0, 10.0),
            (4, wh_alpha, 15.0, 20.0)
        ])
        
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        cursor.executemany("""
            INSERT INTO transactions (product_id, warehouse_id, type, reason, quantity, total_value, timestamp)
            VALUES (?, ?, 'SALE', NULL, ?, ?, ?)
        """, [
            (1, wh_alpha, 30.0, 4500.0, thirty_days_ago),
            (4, wh_alpha, 45.0, 2700.0, thirty_days_ago)
        ])
        
    conn.commit()
    conn.close()

def get_suppliers() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM suppliers")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_warehouses() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM warehouses")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def add_product(sku: str, name: str, category: str, variant: str, unit: str, cost_price: float, selling_price: float, supplier_id: int, warehouse_id: int, initial_stock: float, reorder_threshold: float) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO products (sku, name, category, variant, unit, cost_price, selling_price, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (sku, name, category, variant, unit, cost_price, selling_price, supplier_id))
        prod_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO product_warehouses (product_id, warehouse_id, stock, reorder_threshold)
            VALUES (?, ?, ?, ?)
        """, (prod_id, warehouse_id, initial_stock, reorder_threshold))
        
        conn.commit()
        return {"status": "success", "id": prod_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_products() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*, s.name as supplier_name, pw.warehouse_id, w.name as warehouse_name, pw.stock, pw.reorder_threshold
        FROM products p 
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN product_warehouses pw ON p.id = pw.product_id
        LEFT JOIN warehouses w ON pw.warehouse_id = w.id
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def _execute_transaction(cursor, product_id: int, warehouse_id: int, tx_type: str, reason: str, qty: float, stock_modifier: float, total_value: float):
    cursor.execute("SELECT stock, reorder_threshold FROM product_warehouses WHERE product_id = ? AND warehouse_id = ?", (product_id, warehouse_id))
    row = cursor.fetchone()
    if not row:
        raise Exception(f"Product ID {product_id} not found in Warehouse ID {warehouse_id}.")
        
    new_stock = row["stock"] + stock_modifier
    if new_stock < 0 and tx_type != "ADJUSTMENT":
        raise Exception(f"Insufficient stock in warehouse. Available: {row['stock']}")
        
    cursor.execute("UPDATE product_warehouses SET stock = ? WHERE product_id = ? AND warehouse_id = ?", (new_stock, product_id, warehouse_id))
    
    timestamp = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO transactions (product_id, warehouse_id, type, reason, quantity, total_value, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (product_id, warehouse_id, tx_type, reason, qty, total_value, timestamp))
    
    return {
        "status": "success",
        "remaining_stock": new_stock,
        "reorder_warning": new_stock <= row["reorder_threshold"]
    }

def record_sale(product_id: int, warehouse_id: int, quantity: float, revenue: float) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        res = _execute_transaction(cursor, product_id, warehouse_id, "SALE", None, quantity, -quantity, revenue)
        conn.commit()
        return res
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def record_restock(product_id: int, warehouse_id: int, quantity: float, cost: float) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        res = _execute_transaction(cursor, product_id, warehouse_id, "RESTOCK", None, quantity, quantity, cost)
        conn.commit()
        return res
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def record_adjustment(product_id: int, warehouse_id: int, quantity_diff: float, reason: str) -> Dict[str, Any]:
    if not reason:
        return {"status": "error", "message": "Adjustment requires an audit reason."}
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        res = _execute_transaction(cursor, product_id, warehouse_id, "ADJUSTMENT", reason, quantity_diff, quantity_diff, 0.0)
        conn.commit()
        return res
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_transactions() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, p.name as product_name, p.unit, w.name as warehouse_name
        FROM transactions t
        JOIN products p ON t.product_id = p.id
        JOIN warehouses w ON t.warehouse_id = w.id
        ORDER BY t.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_demand_predictions() -> List[Dict[str, Any]]:
    """
    Computes daily sales velocity per product & warehouse over the last 30 days,
    and returns predictions and stock-out dates.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
    
    # Calculate velocity: total quantity sold in last 30 days / 30
    cursor.execute("""
        SELECT pw.product_id, pw.warehouse_id, p.name as product_name, w.name as warehouse_name, 
               pw.stock, p.unit, COALESCE(SUM(t.quantity), 0) as total_sold
        FROM product_warehouses pw
        JOIN products p ON pw.product_id = p.id
        JOIN warehouses w ON pw.warehouse_id = w.id
        LEFT JOIN transactions t ON pw.product_id = t.product_id 
             AND pw.warehouse_id = t.warehouse_id 
             AND t.type = 'SALE' 
             AND t.timestamp >= ?
        GROUP BY pw.product_id, pw.warehouse_id
    """, (thirty_days_ago,))
    
    rows = cursor.fetchall()
    conn.close()
    
    predictions = []
    for r in rows:
        stock = r["stock"]
        total_sold = r["total_sold"]
        daily_velocity = total_sold / 30.0
        
        # Avoid division by zero, use a minimal baseline if no sales yet
        if daily_velocity == 0:
            daily_velocity = 0.5 # Default heuristic
            
        days_remaining = stock / daily_velocity
        stock_out_date = (datetime.now() + timedelta(days=days_remaining)).strftime("%Y-%m-%d")
        
        predictions.append({
            "product_id": r["product_id"],
            "product_name": r["product_name"],
            "warehouse_name": r["warehouse_name"],
            "current_stock": stock,
            "unit": r["unit"],
            "daily_velocity": round(daily_velocity, 2),
            "days_remaining": round(days_remaining, 1),
            "stock_out_date": stock_out_date,
            "predicted_demand_30d": round(daily_velocity * 30, 1)
        })
        
    return predictions

def get_reorder_suggestions() -> List[Dict[str, Any]]:
    """
    Checks which products in which warehouses have dropped below their reorder threshold
    and returns restocking recommendations.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT pw.product_id, pw.warehouse_id, p.name as product_name, w.name as warehouse_name,
               pw.stock, pw.reorder_threshold, s.name as supplier_name, s.lead_time_days
        FROM product_warehouses pw
        JOIN products p ON pw.product_id = p.id
        JOIN warehouses w ON pw.warehouse_id = w.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE pw.stock <= pw.reorder_threshold
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    suggestions = []
    for r in rows:
        lead_time = r["lead_time_days"] or 3
        # Suggest restocking amount to double the threshold as a safe buffer
        suggested_qty = r["reorder_threshold"] * 2
        
        suggestions.append({
            "product_id": r["product_id"],
            "product_name": r["product_name"],
            "warehouse_name": r["warehouse_name"],
            "current_stock": r["stock"],
            "threshold": r["reorder_threshold"],
            "supplier_name": r["supplier_name"] or "Default Supplier",
            "lead_time_days": lead_time,
            "suggested_reorder_qty": suggested_qty,
            "urgency": "HIGH" if r["stock"] == 0 else "MEDIUM"
        })
        
    return suggestions

def add_supplier(name: str, contact: str, rating: float, reliability_score: float, lead_time_days: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO suppliers (name, contact, rating, reliability_score, lead_time_days)
            VALUES (?, ?, ?, ?, ?)
        """, (name, contact, rating, reliability_score, lead_time_days))
        sup_id = cursor.lastrowid
        conn.commit()
        return {"status": "success", "id": sup_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

