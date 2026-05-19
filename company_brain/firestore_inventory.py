from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from firebase_admin import firestore

from firebase_store import get_firestore_client, utc_now


WAREHOUSES_COLLECTION = "warehouses"
SUPPLIERS_COLLECTION = "suppliers"
PRODUCTS_COLLECTION = "products"
PRODUCT_WAREHOUSES_COLLECTION = "product_warehouses"
TRANSACTIONS_COLLECTION = "transactions"


def _client():
    return get_firestore_client()


def _collection(name: str):
    return _client().collection(name)


def _first_doc(name: str):
    return next(_collection(name).limit(1).stream(), None)


def _numeric_doc_id(doc_id: Any) -> int:
    try:
        return int(str(doc_id))
    except Exception:
        return 0


def _next_numeric_id(collection_name: str) -> int:
    docs = list(_collection(collection_name).stream())
    if not docs:
        return 1
    return max(_numeric_doc_id(doc.id) for doc in docs) + 1


def _timestamp_value(value: Any):
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except Exception:
            return utc_now()
    return utc_now()


def _doc_data(doc_snap) -> Dict[str, Any]:
    data = doc_snap.to_dict() or {}
    if "id" not in data:
        data["id"] = _numeric_doc_id(doc_snap.id)
    return data


def init_db():
    if _first_doc(WAREHOUSES_COLLECTION) is not None:
        return

    client = _client()
    now = utc_now()

    warehouses = [
        {"id": 1, "name": "Alpha Depot", "location": "Karachi"},
        {"id": 2, "name": "Beta Hub", "location": "Lahore"},
    ]
    suppliers = [
        {"id": 1, "name": "Dairy Central", "contact": "info@dairy.com", "rating": 4.8, "reliability_score": 95.0, "lead_time_days": 3},
        {"id": 2, "name": "BuildMart", "contact": "sales@buildmart.com", "rating": 4.5, "reliability_score": 88.0, "lead_time_days": 4},
        {"id": 3, "name": "Speedy Supply", "contact": "fast@speedy.com", "rating": 4.0, "reliability_score": 90.0, "lead_time_days": 1},
        {"id": 4, "name": "Discount Depot", "contact": "cheap@discount.com", "rating": 3.2, "reliability_score": 70.0, "lead_time_days": 5},
    ]
    products = [
        {"id": 1, "sku": "MLK-001", "name": "Milk", "category": "Dairy", "variant": "Full Cream", "unit": "Liters", "cost_price": 100.0, "selling_price": 150.0, "supplier_id": 1},
        {"id": 2, "sku": "WR-001", "name": "Wire", "category": "Hardware", "variant": "10 Gauge Copper", "unit": "Meters", "cost_price": 30.0, "selling_price": 45.0, "supplier_id": 2},
        {"id": 3, "sku": "PP-001", "name": "Pipe", "category": "Hardware", "variant": "PVC 2 inch", "unit": "Pieces", "cost_price": 80.0, "selling_price": 120.0, "supplier_id": 2},
        {"id": 4, "sku": "BKR-001", "name": "Bread", "category": "Bakery", "variant": "Whole Wheat", "unit": "Loaves", "cost_price": 40.0, "selling_price": 60.0, "supplier_id": 1},
    ]
    product_warehouses = [
        {"product_id": 1, "warehouse_id": 1, "stock": 25.0, "reorder_threshold": 5.0},
        {"product_id": 1, "warehouse_id": 2, "stock": 10.0, "reorder_threshold": 5.0},
        {"product_id": 2, "warehouse_id": 1, "stock": 100.0, "reorder_threshold": 15.0},
        {"product_id": 3, "warehouse_id": 2, "stock": 50.0, "reorder_threshold": 10.0},
        {"product_id": 4, "warehouse_id": 1, "stock": 15.0, "reorder_threshold": 20.0},
    ]
    transactions = [
        {"product_id": 1, "warehouse_id": 1, "type": "SALE", "reason": None, "quantity": 30.0, "total_value": 4500.0, "timestamp": (now - timedelta(days=30)).isoformat()},
        {"product_id": 4, "warehouse_id": 1, "type": "SALE", "reason": None, "quantity": 45.0, "total_value": 2700.0, "timestamp": (now - timedelta(days=30)).isoformat()},
    ]

    for item in warehouses:
        client.collection(WAREHOUSES_COLLECTION).document(str(item["id"])).set(item)
    for item in suppliers:
        client.collection(SUPPLIERS_COLLECTION).document(str(item["id"])).set(item)
    for item in products:
        client.collection(PRODUCTS_COLLECTION).document(str(item["id"])).set(item)
    for item in product_warehouses:
        doc_id = f'{item["product_id"]}:{item["warehouse_id"]}'
        client.collection(PRODUCT_WAREHOUSES_COLLECTION).document(doc_id).set(item)
    for item in transactions:
        client.collection(TRANSACTIONS_COLLECTION).add(item)


def get_db_connection():
    raise RuntimeError("SQLite has been removed from the production data path. Use Firestore-backed helpers instead.")


def get_suppliers() -> List[Dict[str, Any]]:
    return [_doc_data(doc) for doc in _collection(SUPPLIERS_COLLECTION).order_by("id").stream()]


def get_warehouses() -> List[Dict[str, Any]]:
    return [_doc_data(doc) for doc in _collection(WAREHOUSES_COLLECTION).order_by("id").stream()]


def get_warehouse_by_id(warehouse_id: int) -> Optional[Dict[str, Any]]:
    snap = _collection(WAREHOUSES_COLLECTION).document(str(int(warehouse_id))).get()
    return _doc_data(snap) if snap.exists else None


def _find_supplier_by_name(name: str) -> Optional[Dict[str, Any]]:
    normalized = name.strip().lower()
    for doc in _collection(SUPPLIERS_COLLECTION).stream():
        data = _doc_data(doc)
        if data.get("name", "").strip().lower() == normalized:
            return data
    return None


def _find_product_by_sku(sku: str) -> Optional[Dict[str, Any]]:
    normalized = sku.strip().lower()
    for doc in _collection(PRODUCTS_COLLECTION).stream():
        data = _doc_data(doc)
        if data.get("sku", "").strip().lower() == normalized:
            return data
    return None


def get_product_by_id(product_id: int) -> Optional[Dict[str, Any]]:
    snap = _collection(PRODUCTS_COLLECTION).document(str(int(product_id))).get()
    return _doc_data(snap) if snap.exists else None


def get_product_by_name(name: str) -> Optional[Dict[str, Any]]:
    normalized = name.strip().lower()
    for doc in _collection(PRODUCTS_COLLECTION).stream():
        data = _doc_data(doc)
        if data.get("name", "").strip().lower() == normalized:
            return data
    return None


def search_products_by_name_fragment(fragment: str) -> List[Dict[str, Any]]:
    normalized = fragment.strip().lower()
    return [
        _doc_data(doc)
        for doc in _collection(PRODUCTS_COLLECTION).stream()
        if normalized in (_doc_data(doc).get("name", "").lower())
    ]


def get_stock_record(product_id: int, warehouse_id: int) -> Optional[Dict[str, Any]]:
    snap = _collection(PRODUCT_WAREHOUSES_COLLECTION).document(f"{int(product_id)}:{int(warehouse_id)}").get()
    if not snap.exists:
        return None
    data = _doc_data(snap)
    product = get_product_by_id(int(product_id)) or {}
    warehouse = get_warehouse_by_id(int(warehouse_id)) or {}
    return {
        **data,
        "product_name": product.get("name"),
        "unit": product.get("unit"),
        "warehouse_name": warehouse.get("name"),
    }


def add_supplier(name: str, contact: str, rating: float, reliability_score: float, lead_time_days: int) -> Dict[str, Any]:
    if _find_supplier_by_name(name):
        return {"status": "error", "message": f"Supplier '{name}' already exists."}

    supplier_id = _next_numeric_id(SUPPLIERS_COLLECTION)
    _collection(SUPPLIERS_COLLECTION).document(str(supplier_id)).set({
        "id": supplier_id,
        "name": name,
        "contact": contact,
        "rating": rating,
        "reliability_score": reliability_score,
        "lead_time_days": lead_time_days,
        "created_at": utc_now().isoformat(),
    })
    return {"status": "success", "id": supplier_id}


def add_product(sku: str, name: str, category: str, variant: str, unit: str, cost_price: float, selling_price: float, supplier_id: int, warehouse_id: int, initial_stock: float, reorder_threshold: float) -> Dict[str, Any]:
    if _find_product_by_sku(sku):
        return {"status": "error", "message": f"Product SKU '{sku}' already exists."}

    product_id = _next_numeric_id(PRODUCTS_COLLECTION)
    _collection(PRODUCTS_COLLECTION).document(str(product_id)).set({
        "id": product_id,
        "sku": sku,
        "name": name,
        "category": category,
        "variant": variant,
        "unit": unit,
        "cost_price": cost_price,
        "selling_price": selling_price,
        "supplier_id": supplier_id,
        "created_at": utc_now().isoformat(),
    })
    _collection(PRODUCT_WAREHOUSES_COLLECTION).document(f"{product_id}:{int(warehouse_id)}").set({
        "product_id": product_id,
        "warehouse_id": int(warehouse_id),
        "stock": float(initial_stock),
        "reorder_threshold": float(reorder_threshold),
        "updated_at": utc_now().isoformat(),
    })
    return {"status": "success", "id": product_id}


def get_products() -> List[Dict[str, Any]]:
    suppliers = {item["id"]: item for item in get_suppliers()}
    warehouses = {item["id"]: item for item in get_warehouses()}
    products = {item["id"]: item for item in [_doc_data(doc) for doc in _collection(PRODUCTS_COLLECTION).stream()]}

    rows: List[Dict[str, Any]] = []
    for doc in _collection(PRODUCT_WAREHOUSES_COLLECTION).stream():
        stock_data = _doc_data(doc)
        product = products.get(stock_data["product_id"])
        if not product:
            continue
        rows.append({
            **product,
            "supplier_name": suppliers.get(product.get("supplier_id"), {}).get("name"),
            "warehouse_id": stock_data["warehouse_id"],
            "warehouse_name": warehouses.get(stock_data["warehouse_id"], {}).get("name"),
            "stock": stock_data["stock"],
            "reorder_threshold": stock_data["reorder_threshold"],
        })
    return rows


def _write_transaction(cursor_product_id: int, warehouse_id: int, tx_type: str, reason: Optional[str], qty: float, total_value: float) -> Dict[str, Any]:
    stock_record = get_stock_record(cursor_product_id, warehouse_id)
    if not stock_record:
        raise ValueError(f"Product ID {cursor_product_id} not found in Warehouse ID {warehouse_id}.")

    current_stock = float(stock_record["stock"])
    reorder_threshold = float(stock_record.get("reorder_threshold", 0.0))
    delta = qty if tx_type in {"RESTOCK", "ADJUSTMENT"} else -qty
    new_stock = current_stock + delta
    if new_stock < 0 and tx_type != "ADJUSTMENT":
        raise ValueError(f"Insufficient stock in warehouse. Available: {current_stock}")

    _collection(PRODUCT_WAREHOUSES_COLLECTION).document(f"{int(cursor_product_id)}:{int(warehouse_id)}").set({
        "product_id": int(cursor_product_id),
        "warehouse_id": int(warehouse_id),
        "stock": new_stock,
        "reorder_threshold": reorder_threshold,
        "updated_at": utc_now().isoformat(),
    })
    _collection(TRANSACTIONS_COLLECTION).add({
        "product_id": int(cursor_product_id),
        "warehouse_id": int(warehouse_id),
        "type": tx_type,
        "reason": reason,
        "quantity": float(qty),
        "total_value": float(total_value),
        "timestamp": utc_now().isoformat(),
    })
    return {"status": "success", "remaining_stock": new_stock, "reorder_warning": new_stock <= reorder_threshold}


def record_sale(product_id: int, warehouse_id: int, quantity: float, revenue: float) -> Dict[str, Any]:
    try:
        return _write_transaction(product_id, warehouse_id, "SALE", None, quantity, revenue)
    except Exception as e:
        return {"status": "error", "message": str(e)}


def record_restock(product_id: int, warehouse_id: int, quantity: float, cost: float) -> Dict[str, Any]:
    try:
        return _write_transaction(product_id, warehouse_id, "RESTOCK", None, quantity, cost)
    except Exception as e:
        return {"status": "error", "message": str(e)}


def record_adjustment(product_id: int, warehouse_id: int, quantity_diff: float, reason: str) -> Dict[str, Any]:
    if not reason:
        return {"status": "error", "message": "Adjustment requires an audit reason."}
    try:
        return _write_transaction(product_id, warehouse_id, "ADJUSTMENT", reason, quantity_diff, 0.0)
    except Exception as e:
        return {"status": "error", "message": str(e)}


def get_transactions() -> List[Dict[str, Any]]:
    products = {item["id"]: item for item in get_products()}
    warehouses = {item["id"]: item for item in get_warehouses()}
    rows = [
        _doc_data(doc)
        for doc in _collection(TRANSACTIONS_COLLECTION).order_by("timestamp", direction=firestore.Query.DESCENDING).stream()
    ]
    for row in rows:
        product = products.get(row["product_id"], {})
        warehouse = warehouses.get(row["warehouse_id"], {})
        row["product_name"] = product.get("name")
        row["unit"] = product.get("unit")
        row["warehouse_name"] = warehouse.get("name")
    return rows


def get_demand_predictions() -> List[Dict[str, Any]]:
    today = utc_now()
    ninety_days_ago = today - timedelta(days=90)
    products = get_products()
    transactions = [
        row
        for row in get_transactions()
        if _timestamp_value(row.get("timestamp")) >= ninety_days_ago and row.get("type") == "SALE"
    ]

    weekly_sales: Dict[tuple, list[float]] = defaultdict(lambda: [0.0] * 13)
    meta: Dict[tuple, dict] = {}

    for product in products:
        key = (product["id"], product["warehouse_id"])
        meta[key] = {
            "product_id": product["id"],
            "product_name": product["name"],
            "warehouse_name": product.get("warehouse_name"),
            "current_stock": product["stock"],
            "unit": product["unit"],
        }

    for tx in transactions:
        key = (tx["product_id"], tx["warehouse_id"])
        if key not in meta:
            continue
        tx_date = _timestamp_value(tx.get("timestamp"))
        days_ago = (today - tx_date).days
        week_idx = min(int(days_ago // 7), 12)
        bucket = 12 - week_idx
        weekly_sales[key][bucket] += float(tx.get("quantity", 0.0))

    predictions = []
    alpha = 0.4
    for key, item in meta.items():
        weeks = weekly_sales[key]
        non_zero = [week for week in weeks if week > 0]
        if non_zero:
            smoothed = weeks[0]
            for week in weeks[1:]:
                smoothed = alpha * week + (1 - alpha) * smoothed
            daily_velocity = smoothed / 7.0
            recent_avg = sum(weeks[9:13]) / 4.0
            older_avg = sum(weeks[5:9]) / 4.0
            if older_avg > 0:
                trend_pct = ((recent_avg - older_avg) / older_avg) * 100
                trend = "UP" if trend_pct > 5 else "DOWN" if trend_pct < -5 else "STABLE"
            else:
                trend_pct = 0.0
                trend = "STABLE"
            confidence = "HIGH" if len(non_zero) >= 6 else "MEDIUM" if len(non_zero) >= 3 else "LOW"
        else:
            daily_velocity = 0.5
            trend = "STABLE"
            trend_pct = 0.0
            confidence = "LOW"

        stock = float(item["current_stock"])
        days_remaining = stock / daily_velocity if daily_velocity > 0 else 9999
        stock_out_date = (today + timedelta(days=days_remaining)).strftime("%Y-%m-%d")

        predictions.append({
            "product_id": item["product_id"],
            "name": item["product_name"],
            "warehouse_name": item["warehouse_name"],
            "current_stock": round(stock, 2),
            "unit": item["unit"],
            "daily_velocity": round(daily_velocity, 2),
            "days_remaining": round(min(days_remaining, 9999), 1),
            "estimated_stockout_date": stock_out_date,
            "predicted_demand_30d": round(daily_velocity * 30, 1),
            "trend": trend,
            "trend_pct": round(trend_pct, 1),
            "confidence": confidence,
            "forecast_model": "SES_alpha0.4",
        })

    return predictions


def get_reorder_suggestions() -> List[Dict[str, Any]]:
    suppliers = {item["id"]: item for item in get_suppliers()}
    suggestions = []
    for product in get_products():
        if float(product["stock"]) > float(product["reorder_threshold"]):
            continue
        lead_time = int(suppliers.get(product.get("supplier_id"), {}).get("lead_time_days") or 3)
        stock = float(product["stock"])
        threshold = float(product["reorder_threshold"])
        daily_baseline = max(threshold / 7.0, 0.5)
        lead_demand = daily_baseline * lead_time
        suggested_qty = round((lead_demand + threshold) * 1.2, 1)
        days_of_stock = stock / daily_baseline if daily_baseline > 0 else 0

        if stock == 0:
            urgency = "CRITICAL"
        elif days_of_stock <= lead_time:
            urgency = "HIGH"
        else:
            urgency = "MEDIUM"

        supplier_name = suppliers.get(product.get("supplier_id"), {}).get("name") or "Default Supplier"
        suggestions.append({
            "product_id": product["id"],
            "product_name": product["name"],
            "warehouse_name": product.get("warehouse_name"),
            "current_stock": round(stock, 2),
            "threshold": threshold,
            "supplier_name": supplier_name,
            "lead_time_days": lead_time,
            "days_of_stock_remaining": round(days_of_stock, 1),
            "suggested_reorder_qty": suggested_qty,
            "urgency": urgency,
            "message": (
                f"[{urgency}] {product['name']} at {product.get('warehouse_name')}: "
                f"{stock} left, {lead_time}d lead time. Order {suggested_qty} units from {supplier_name}."
            ),
        })

    suggestions.sort(key=lambda x: {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}.get(x["urgency"], 3))
    return suggestions
