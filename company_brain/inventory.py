# File: company_brain/inventory.py
#
# ## Purpose
# Manage persistent SQLite database operations for a fully functional operational hub.
#
# ## Responsibility
# Ensure business operators can manage suppliers, detailed product catalogs, and diverse transactions (sales, restocking, adjustments).
# Includes advanced predictive logic for demand and restocking.
#
# ## Inputs
# Supplier details, product properties, and transaction data.
#
# ## Outputs
# Structured database records, full inventory listing, transaction ledgers, predictive stock-out dates, and reorder suggestions.
#
# ## Dependencies
# - sqlite3
#
# ## Notes
# Implements advanced relational structures (foreign keys) to mimic a robust ERP system.

import sqlite3
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any

DB_PATH = "opsify_business.db"

def get_db_connection():
    """Create a persistent SQLite connection with foreign keys enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = 1")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize full inventory, suppliers, and transactions tables."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Suppliers Table
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
    
    # 2. Products Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT,
            variant TEXT,
            unit TEXT,
            stock REAL NOT NULL,
            reorder_threshold REAL NOT NULL,
            cost_price REAL NOT NULL,
            selling_price REAL NOT NULL,
            supplier_id INTEGER,
            FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        )
    """)
    
    # 3. Supplier Prices History Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS supplier_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            supplier_id INTEGER NOT NULL,
            price REAL NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products (id),
            FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        )
    """)
    
    # 4. Transactions Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            type TEXT NOT NULL, -- 'SALE', 'RESTOCK', 'ADJUSTMENT'
            reason TEXT, -- Used for adjustments (Damage, Expiry, etc.)
            quantity REAL NOT NULL,
            total_value REAL NOT NULL, -- Revenue if sale, Cost if restock
            timestamp TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products (id)
        )
    """)
    
    # Seed mock data if empty
    cursor.execute("SELECT COUNT(*) FROM suppliers")
    if cursor.fetchone()[0] == 0:
        # Seed Suppliers
        cursor.execute("INSERT INTO suppliers (name, contact, rating, reliability_score, lead_time_days) VALUES (?, ?, ?, ?, ?)", 
                       ("Dairy Central", "info@dairy.com", 4.8, 95.0, 3))
        sup_milk = cursor.lastrowid
        
        cursor.execute("INSERT INTO suppliers (name, contact, rating, reliability_score, lead_time_days) VALUES (?, ?, ?, ?, ?)", 
                       ("BuildMart", "sales@buildmart.com", 4.5, 88.0, 4))
        sup_build = cursor.lastrowid
        
        cursor.execute("INSERT INTO suppliers (name, contact, rating, reliability_score, lead_time_days) VALUES (?, ?, ?, ?, ?)", 
                       ("Speedy Supply", "fast@speedy.com", 4.0, 90.0, 1)) # Fastest, but lower rating (so higher mock price in our algo)
        sup_speedy = cursor.lastrowid
        
        cursor.execute("INSERT INTO suppliers (name, contact, rating, reliability_score, lead_time_days) VALUES (?, ?, ?, ?, ?)", 
                       ("Discount Depot", "cheap@discount.com", 3.2, 70.0, 5)) # Slowest, but lowest rating (so cheapest mock price)
        sup_discount = cursor.lastrowid
        
        # Seed Products
        mock_items = [
            ("MLK-001", "Milk", "Dairy", "Full Cream", "Liters", 25.0, 5.0, 100.0, 150.0, sup_milk),
            ("WR-001", "Wire", "Hardware", "10 Gauge Copper", "Meters", 100.0, 15.0, 30.0, 45.0, sup_build),
            ("PP-001", "Pipe", "Hardware", "PVC 2 inch", "Pieces", 50.0, 10.0, 80.0, 120.0, sup_build),
            ("BKR-001", "Bread", "Bakery", "Whole Wheat", "Loaves", 15.0, 20.0, 40.0, 60.0, sup_milk), # Example of high-demand/low-stock item
        ]
        cursor.executemany("""
            INSERT INTO products (sku, name, category, variant, unit, stock, reorder_threshold, cost_price, selling_price, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, mock_items)
        
        # Seed some historical SALE transactions to power the prediction engine
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        cursor.execute("""
            INSERT INTO transactions (product_id, type, reason, quantity, total_value, timestamp)
            VALUES (?, 'SALE', NULL, ?, ?, ?)
        """, (1, 30.0, 30*150.0, thirty_days_ago)) # Milk sold
        
        cursor.execute("""
            INSERT INTO transactions (product_id, type, reason, quantity, total_value, timestamp)
            VALUES (?, 'SALE', NULL, ?, ?, ?)
        """, (4, 45.0, 45*60.0, thirty_days_ago)) # Bread sold
        
    conn.commit()
    conn.close()

# --- SUPPLIERS ---
def add_supplier(name: str, contact: str, rating: float, reliability_score: float, lead_time_days: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO suppliers (name, contact, rating, reliability_score, lead_time_days) VALUES (?, ?, ?, ?, ?)", 
                       (name, contact, rating, reliability_score, lead_time_days))
        conn.commit()
        return {"status": "success", "id": cursor.lastrowid}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_suppliers() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM suppliers")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# --- PRODUCTS ---
def add_product(sku: str, name: str, category: str, variant: str, unit: str, stock: float, reorder_threshold: float, cost_price: float, selling_price: float, supplier_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO products (sku, name, category, variant, unit, stock, reorder_threshold, cost_price, selling_price, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (sku, name, category, variant, unit, stock, reorder_threshold, cost_price, selling_price, supplier_id))
        conn.commit()
        return {"status": "success", "id": cursor.lastrowid}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_products() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*, s.name as supplier_name 
        FROM products p 
        LEFT JOIN suppliers s ON p.supplier_id = s.id
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# --- PREDICTIONS & SUGGESTIONS ---
def get_demand_predictions() -> List[Dict[str, Any]]:
    """Calculates daily sales velocity over the last 30 days and projects stock-out date."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
    
    cursor.execute("""
        SELECT p.id, p.name, p.variant, p.stock, p.unit,
               COALESCE(SUM(t.quantity), 0) as total_sold_30d
        FROM products p
        LEFT JOIN transactions t ON p.id = t.product_id 
                                 AND t.type = 'SALE' 
                                 AND t.timestamp >= ?
        GROUP BY p.id
    """, (thirty_days_ago,))
    
    rows = cursor.fetchall()
    predictions = []
    
    for row in rows:
        total_sold = row["total_sold_30d"]
        daily_velocity = total_sold / 30.0 if total_sold > 0 else 0
        stock = row["stock"]
        
        if daily_velocity > 0:
            days_until_stockout = stock / daily_velocity
            stockout_date = (datetime.now() + timedelta(days=days_until_stockout)).strftime('%Y-%m-%d')
        else:
            days_until_stockout = None
            stockout_date = "No current demand"
            
        predictions.append({
            "product_id": row["id"],
            "name": row["name"],
            "variant": row["variant"],
            "unit": row["unit"],
            "current_stock": stock,
            "daily_velocity": round(daily_velocity, 2),
            "estimated_stockout_date": stockout_date,
            "days_until_stockout": round(days_until_stockout, 1) if days_until_stockout is not None else None
        })
        
    conn.close()
    return predictions

def get_reorder_suggestions() -> List[Dict[str, Any]]:
    """Combines sales velocity, reorder thresholds, and supplier lead times to suggest actions."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
    
    cursor.execute("""
        SELECT p.id, p.name, p.variant, p.unit, p.stock, p.reorder_threshold, 
               s.name as supplier_name, s.lead_time_days,
               COALESCE(SUM(t.quantity), 0) as total_sold_30d
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN transactions t ON p.id = t.product_id 
                                 AND t.type = 'SALE' 
                                 AND t.timestamp >= ?
        GROUP BY p.id
    """, (thirty_days_ago,))
    
    rows = cursor.fetchall()
    suggestions = []
    
    for row in rows:
        daily_velocity = row["total_sold_30d"] / 30.0
        lead_time = row["lead_time_days"] or 1
        
        # Lead time demand is the amount of stock we'll burn while waiting for a restock delivery
        lead_time_demand = daily_velocity * lead_time
        critical_threshold = max(row["reorder_threshold"], lead_time_demand)
        
        if row["stock"] <= critical_threshold:
            # We are in the danger zone. Need to restock!
            # Let's suggest ordering 14 days worth of inventory, minus current stock.
            target_stock = daily_velocity * 14
            suggested_qty = max(target_stock - row["stock"], 1.0)
            
            message = f"[ALERT] Reorder {round(suggested_qty, 1)} {row['unit']} of {row['name']} from {row['supplier_name']} immediately."
            
            suggestions.append({
                "product_id": row["id"],
                "name": row["name"],
                "variant": row["variant"],
                "unit": row["unit"],
                "suggested_quantity": round(suggested_qty, 1),
                "supplier": row["supplier_name"],
                "message": message,
                "urgency": "High" if row["stock"] <= lead_time_demand else "Medium"
            })
            
    conn.close()
    return suggestions

# --- TRANSACTIONS ---
def _execute_transaction(cursor, product_id: int, tx_type: str, reason: str, qty: float, stock_modifier: float, total_value: float):
    cursor.execute("SELECT stock, reorder_threshold FROM products WHERE id = ?", (product_id,))
    row = cursor.fetchone()
    if not row:
        raise Exception(f"Product ID {product_id} not found.")
        
    new_stock = row["stock"] + stock_modifier
    if new_stock < 0 and tx_type != "ADJUSTMENT":
        raise Exception(f"Insufficient stock. Available: {row['stock']}")
        
    cursor.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, product_id))
    
    timestamp = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO transactions (product_id, type, reason, quantity, total_value, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (product_id, tx_type, reason, qty, total_value, timestamp))
    
    return {
        "status": "success",
        "remaining_stock": new_stock,
        "reorder_warning": new_stock <= row["reorder_threshold"]
    }

def record_sale(product_id: int, quantity: float, revenue: float) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        res = _execute_transaction(cursor, product_id, "SALE", None, quantity, -quantity, revenue)
        conn.commit()
        return res
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def record_restock(product_id: int, quantity: float, cost: float) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        res = _execute_transaction(cursor, product_id, "RESTOCK", None, quantity, quantity, cost)
        conn.commit()
        return res
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def record_adjustment(product_id: int, quantity_diff: float, reason: str) -> Dict[str, Any]:
    """Requires an audit reason (e.g. Damage, Expired). quantity_diff can be negative or positive."""
    if not reason:
        return {"status": "error", "message": "Adjustment requires an audit reason."}
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        res = _execute_transaction(cursor, product_id, "ADJUSTMENT", reason, quantity_diff, quantity_diff, 0.0)
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
        SELECT t.*, p.name as product_name, p.unit
        FROM transactions t
        JOIN products p ON t.product_id = p.id
        ORDER BY t.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
