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
            ("Malir Organic Farm Cooperative", "sales@malirfarm.org", 4.8, 95.0, 1),
            ("Super Highway Sabzi Mandi", "info@sabzimandi.com", 4.5, 88.0, 2),
            ("Kathore Mango Orchards", "orders@kathore.pk", 4.9, 98.0, 3),
            ("Hub River Vegetable Hub", "contact@hubveggie.pk", 4.2, 82.0, 2)
        ])
        
        cursor.executemany("""
            INSERT INTO products (sku, name, category, variant, unit, cost_price, selling_price, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            ("TOM-001", "Organic Tomatoes", "Vegetables", "Red Round", "Kilograms", 40.0, 60.0, 1),
            ("MNG-001", "Sindhri Mangoes", "Fruits", "A-Grade", "Kilograms", 120.0, 180.0, 3),
            ("ONN-001", "Red Onions", "Vegetables", "Medium", "Kilograms", 30.0, 50.0, 2),
            ("POT-001", "Fresh Potatoes", "Vegetables", "Organic Russet", "Kilograms", 25.0, 45.0, 4),
            ("SPN-001", "Spinach Bunches", "Herbs", "Fresh Green", "Bunches", 15.0, 25.0, 1)
        ])
        
        # Seed initial stock into Alpha and Beta warehouses
        cursor.executemany("""
            INSERT INTO product_warehouses (product_id, warehouse_id, stock, reorder_threshold)
            VALUES (?, ?, ?, ?)
        """, [
            (1, wh_alpha, 450.0, 50.0), # Tomatoes in Alpha
            (1, wh_beta, 200.0, 50.0),
            (2, wh_alpha, 600.0, 100.0), # Mangoes in Alpha
            (3, wh_alpha, 350.0, 50.0),  # Onions in Alpha
            (4, wh_alpha, 500.0, 80.0),  # Potatoes in Alpha
            (5, wh_alpha, 45.0, 80.0)    # Spinach in Alpha (breaches 80 threshold to show reorder state!)
        ])
        
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        cursor.executemany("""
            INSERT INTO transactions (product_id, warehouse_id, type, reason, quantity, total_value, timestamp)
            VALUES (?, ?, 'SALE', NULL, ?, ?, ?)
        """, [
            (1, wh_alpha, 120.0, 7200.0, thirty_days_ago),
            (2, wh_alpha, 250.0, 45000.0, thirty_days_ago),
            (5, wh_alpha, 90.0, 2250.0, thirty_days_ago)
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
    ML-grade demand forecasting using Single Exponential Smoothing (SES) on weekly buckets.

    Algorithm:
    - Split last 90 days of sales into 13 weekly buckets
    - Apply SES with alpha=0.4 (recent weeks weighted more than older ones)
    - Compute smoothed daily velocity from final smoothed weekly value
    - Derive stock-out date and 30-day demand estimate
    - Include trend direction and confidence level

    No external ML libraries required — pure Python.
    """
    from datetime import date

    conn = get_db_connection()
    cursor = conn.cursor()

    ninety_days_ago = (datetime.now() - timedelta(days=90)).isoformat()

    # Fetch all sales per product/warehouse in last 90 days with day-level granularity
    cursor.execute("""
        SELECT pw.product_id, pw.warehouse_id, p.name AS product_name,
               w.name AS warehouse_name, pw.stock, p.unit,
               t.timestamp, t.quantity
        FROM product_warehouses pw
        JOIN products p ON pw.product_id = p.id
        JOIN warehouses w ON pw.warehouse_id = w.id
        LEFT JOIN transactions t ON pw.product_id = t.product_id
             AND pw.warehouse_id = t.warehouse_id
             AND t.type = 'SALE'
             AND t.timestamp >= ?
        GROUP BY pw.product_id, pw.warehouse_id, t.id
    """, (ninety_days_ago,))

    rows = cursor.fetchall()
    conn.close()

    # Aggregate by (product_id, warehouse_id)
    from collections import defaultdict
    products: Dict[tuple, dict] = {}
    weekly_sales: Dict[tuple, list] = defaultdict(lambda: [0.0] * 13)  # 13 weeks

    today = datetime.now()

    for r in rows:
        key = (r["product_id"], r["warehouse_id"])
        if key not in products:
            products[key] = {
                "product_id":   r["product_id"],
                "product_name": r["product_name"],
                "warehouse_name": r["warehouse_name"],
                "current_stock": r["stock"],
                "unit": r["unit"],
            }
        if r["timestamp"] and r["quantity"]:
            try:
                tx_date = datetime.fromisoformat(r["timestamp"])
                days_ago = (today - tx_date).days
                week_idx = min(int(days_ago // 7), 12)   # 0 = most recent week
                bucket   = 12 - week_idx                  # reverse: index 0 = oldest
                weekly_sales[key][bucket] += r["quantity"]
            except Exception:
                pass

    predictions = []
    ALPHA = 0.4   # SES smoothing factor: higher = more weight on recent data

    for key, meta in products.items():
        weeks = weekly_sales[key]

        # Single Exponential Smoothing
        non_zero = [w for w in weeks if w > 0]
        if non_zero:
            smoothed = weeks[0]
            for w in weeks[1:]:
                smoothed = ALPHA * w + (1 - ALPHA) * smoothed
            daily_velocity = smoothed / 7.0

            # Trend: compare last 4 weeks vs previous 4 weeks
            recent_avg = sum(weeks[9:13]) / 4.0
            older_avg  = sum(weeks[5:9])  / 4.0
            if older_avg > 0:
                trend_pct = ((recent_avg - older_avg) / older_avg) * 100
                trend = "UP" if trend_pct > 5 else "DOWN" if trend_pct < -5 else "STABLE"
            else:
                trend = "STABLE"
                trend_pct = 0.0

            confidence = "HIGH" if len(non_zero) >= 6 else "MEDIUM" if len(non_zero) >= 3 else "LOW"
        else:
            # No historical sales — use minimal baseline
            daily_velocity = 0.5
            trend = "STABLE"
            trend_pct = 0.0
            confidence = "LOW"

        stock = meta["current_stock"]
        days_remaining = stock / daily_velocity if daily_velocity > 0 else 9999
        stock_out_date = (today + timedelta(days=days_remaining)).strftime("%Y-%m-%d")

        predictions.append({
            "product_id":         meta["product_id"],
            "name":               meta["product_name"],
            "warehouse_name":     meta["warehouse_name"],
            "current_stock":      round(stock, 2),
            "unit":               meta["unit"],
            "daily_velocity":     round(daily_velocity, 2),
            "days_remaining":     round(min(days_remaining, 9999), 1),
            "estimated_stockout_date": stock_out_date,
            "predicted_demand_30d":   round(daily_velocity * 30, 1),
            "trend":              trend,
            "trend_pct":          round(trend_pct, 1),
            "confidence":         confidence,
            "forecast_model":     "SES_alpha0.4",
        })

    return predictions


def get_reorder_suggestions() -> List[Dict[str, Any]]:
    """
    AI-grade reorder suggestions combining:
    - Stock below threshold detection
    - Lead-time demand calculation (how much will sell while waiting for restock)
    - 20% safety buffer on top
    - Urgency ladder: CRITICAL / HIGH / MEDIUM based on days-of-stock remaining
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT pw.product_id, pw.warehouse_id, p.name AS product_name,
               w.name AS warehouse_name, pw.stock, pw.reorder_threshold,
               s.name AS supplier_name, s.lead_time_days
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
        stock     = r["stock"]
        threshold = r["reorder_threshold"]

        # Lead-time demand + 20% safety buffer
        daily_baseline = max(threshold / 7.0, 0.5)   # rough velocity estimate
        lead_demand    = daily_baseline * lead_time
        suggested_qty  = round((lead_demand + threshold) * 1.2, 1)
        days_of_stock  = stock / daily_baseline if daily_baseline > 0 else 0

        if stock == 0:
            urgency = "CRITICAL"
        elif days_of_stock <= lead_time:
            urgency = "HIGH"
        else:
            urgency = "MEDIUM"

        suggestions.append({
            "product_id":         r["product_id"],
            "product_name":       r["product_name"],
            "warehouse_name":     r["warehouse_name"],
            "current_stock":      round(stock, 2),
            "threshold":          threshold,
            "supplier_name":      r["supplier_name"] or "Default Supplier",
            "lead_time_days":     lead_time,
            "days_of_stock_remaining": round(days_of_stock, 1),
            "suggested_reorder_qty": suggested_qty,
            "urgency":            urgency,
            "message":            (
                f"[{urgency}] {r['product_name']} at {r['warehouse_name']}: "
                f"{stock} left, {lead_time}d lead time. "
                f"Order {suggested_qty} units from {r['supplier_name'] or 'supplier'}."
            ),
        })

    # Sort by urgency: CRITICAL first
    urgency_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
    suggestions.sort(key=lambda x: urgency_order.get(x["urgency"], 3))
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

