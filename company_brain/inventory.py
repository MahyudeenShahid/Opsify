# File: company_brain/inventory.py
#
# ## Purpose
# Manage persistent SQLite database operations for a fully functional operational hub.
#
# ## Responsibility
# Ensure business operators can manage suppliers, detailed product catalogs, and diverse transactions (sales, restocking, adjustments).
#
# ## Inputs
# Supplier details, product properties, and transaction data.
#
# ## Outputs
# Structured database records, full inventory listing, transaction ledgers, and low stock warnings.
#
# ## Dependencies
# - sqlite3
#
# ## Notes
# Implements advanced relational structures (foreign keys) to mimic a robust ERP system.

import sqlite3
import os
from datetime import datetime
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
            stock REAL NOT NULL,
            reorder_threshold REAL NOT NULL,
            cost_price REAL NOT NULL,
            selling_price REAL NOT NULL,
            supplier_id INTEGER,
            FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        )
    """)
    
    # 3. Transactions Table (Replaces generic Ledger)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            type TEXT NOT NULL, -- 'SALE', 'RESTOCK', 'ADJUSTMENT'
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
        cursor.execute("INSERT INTO suppliers (name, contact, rating, lead_time_days) VALUES (?, ?, ?, ?)", 
                       ("Dairy Central", "info@dairy.com", 4.8, 1))
        sup_milk = cursor.lastrowid
        
        cursor.execute("INSERT INTO suppliers (name, contact, rating, lead_time_days) VALUES (?, ?, ?, ?)", 
                       ("BuildMart", "sales@buildmart.com", 4.5, 3))
        sup_build = cursor.lastrowid
        
        # Seed Products
        mock_items = [
            ("MLK-001", "Milk", "Commodity", 25.0, 5.0, 100.0, 150.0, sup_milk),
            ("WR-001", "Wire", "Hardware", 100.0, 15.0, 30.0, 45.0, sup_build),
            ("PP-001", "Pipe", "Hardware", 50.0, 10.0, 80.0, 120.0, sup_build),
        ]
        cursor.executemany("""
            INSERT INTO products (sku, name, category, stock, reorder_threshold, cost_price, selling_price, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, mock_items)
        
    conn.commit()
    conn.close()

# --- SUPPLIERS ---
def add_supplier(name: str, contact: str, rating: float, lead_time_days: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO suppliers (name, contact, rating, lead_time_days) VALUES (?, ?, ?, ?)", 
                       (name, contact, rating, lead_time_days))
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
def add_product(sku: str, name: str, category: str, stock: float, reorder_threshold: float, cost_price: float, selling_price: float, supplier_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO products (sku, name, category, stock, reorder_threshold, cost_price, selling_price, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (sku, name, category, stock, reorder_threshold, cost_price, selling_price, supplier_id))
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

# --- TRANSACTIONS ---
def _execute_transaction(cursor, product_id: int, tx_type: str, qty: float, stock_modifier: float, total_value: float):
    cursor.execute("SELECT stock, reorder_threshold FROM products WHERE id = ?", (product_id,))
    row = cursor.fetchone()
    if not row:
        raise Exception(f"Product ID {product_id} not found.")
        
    new_stock = row["stock"] + stock_modifier
    if new_stock < 0:
        raise Exception(f"Insufficient stock. Available: {row['stock']}")
        
    cursor.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, product_id))
    
    timestamp = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO transactions (product_id, type, quantity, total_value, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, (product_id, tx_type, qty, total_value, timestamp))
    
    return {
        "status": "success",
        "remaining_stock": new_stock,
        "reorder_warning": new_stock <= row["reorder_threshold"]
    }

def record_sale(product_id: int, quantity: float, revenue: float) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        res = _execute_transaction(cursor, product_id, "SALE", quantity, -quantity, revenue)
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
        res = _execute_transaction(cursor, product_id, "RESTOCK", quantity, quantity, cost)
        conn.commit()
        return res
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def record_adjustment(product_id: int, quantity_diff: float) -> Dict[str, Any]:
    """quantity_diff can be negative (shrinkage/damage) or positive (found stock)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Adjustment value is usually treated as 0 value transaction or calculated based on COGS.
        res = _execute_transaction(cursor, product_id, "ADJUSTMENT", quantity_diff, quantity_diff, 0.0)
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
        SELECT t.*, p.name as product_name 
        FROM transactions t
        JOIN products p ON t.product_id = p.id
        ORDER BY t.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
