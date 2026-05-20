"""
Firestore Inventory — Per-User Data Store
All data lives under: users/{user_id}/{collection}/{doc}

Collections per user:
  warehouses, suppliers, products, product_warehouses,
  transactions, orders, activity_log, opsbot_messages
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from firebase_admin import firestore

from firebase_store import get_firestore_client, utc_now

# ── Default/fallback user for backward compat ──────────────────────────────────
DEFAULT_USER_ID = "shared_default"

# Collection names (relative to users/{uid}/)
COL_WAREHOUSES      = "warehouses"
COL_SUPPLIERS       = "suppliers"
COL_PRODUCTS        = "products"
COL_STOCK           = "product_warehouses"
COL_TRANSACTIONS    = "transactions"
COL_ORDERS          = "orders"
COL_ACTIVITY_LOG    = "activity_log"


# ── Core helpers ──────────────────────────────────────────────────────────────

def _client():
    return get_firestore_client()


def _user_ref(user_id: str):
    """Reference to the user document (parent of all subcollections)."""
    return _client().collection("users").document(user_id)


def _col(user_id: str, collection: str):
    """Shorthand for users/{uid}/{collection}."""
    return _user_ref(user_id).collection(collection)

def save_push_token(user_id: str, token: str):
    _user_ref(user_id).set({"expo_push_token": token}, merge=True)

def get_push_token(user_id: str) -> Optional[str]:
    doc = _user_ref(user_id).get()
    return doc.to_dict().get("expo_push_token") if doc.exists else None


def _numeric_doc_id(doc_id: Any) -> int:
    try:
        return int(str(doc_id))
    except Exception:
        return 0


def _normalize_id(val: Any) -> Any:
    if val is None:
        return None
    s = str(val).strip()
    try:
        if "." in s:
            return int(float(s))
        return int(s)
    except Exception:
        return s


def _next_numeric_id(user_id: str, collection: str) -> int:
    docs = list(_col(user_id, collection).stream())
    if not docs:
        return 1
    return max(_numeric_doc_id(doc.id) for doc in docs) + 1


def _timestamp_value(value: Any):
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return utc_now()
    return utc_now()


def _doc_data(doc_snap) -> Dict[str, Any]:
    data = doc_snap.to_dict() or {}
    if "id" not in data:
        data["id"] = _numeric_doc_id(doc_snap.id)
    return data


def log_activity(user_id: str, action: str, entity: str, details: Dict[str, Any]):
    """Append an activity log entry for auditing."""
    try:
        _col(user_id, COL_ACTIVITY_LOG).add({
            "action":    action,     # ADD | EDIT | DELETE | SALE | RESTOCK | ADJUSTMENT | ORDER
            "entity":    entity,     # product | supplier | warehouse | order | transaction
            "details":   details,
            "timestamp": utc_now().isoformat(),
        })
    except Exception as e:
        print(f"[ActivityLog] {e}")


# ── Init / Onboarding ─────────────────────────────────────────────────────────

def init_db():
    """Legacy no-op — actual seeding is done per-user via seed_user_data()."""
    pass


def user_is_onboarded(user_id: str) -> bool:
    snap = _user_ref(user_id).get()
    if not snap.exists:
        return False
    return snap.to_dict().get("onboarded", False)


def mark_user_onboarded(user_id: str):
    _user_ref(user_id).set({"onboarded": True}, merge=True)


def seed_user_data(user_id: str):
    """Populate sample data for a new user."""
    client = _client()
    now = utc_now()

    warehouses = [
        {"id": 1, "name": "Alpha Depot",  "location": "Karachi"},
        {"id": 2, "name": "Beta Hub",     "location": "Lahore"},
    ]
    suppliers = [
        {"id": 1, "name": "Dairy Central",  "contact": "info@dairy.com",    "rating": 4.8, "reliability_score": 95.0, "lead_time_days": 3},
        {"id": 2, "name": "BuildMart",      "contact": "sales@buildmart.com","rating": 4.5, "reliability_score": 88.0, "lead_time_days": 4},
        {"id": 3, "name": "Speedy Supply",  "contact": "fast@speedy.com",   "rating": 4.0, "reliability_score": 90.0, "lead_time_days": 1},
        {"id": 4, "name": "Discount Depot", "contact": "cheap@discount.com", "rating": 3.2, "reliability_score": 70.0, "lead_time_days": 5},
    ]
    products = [
        {"id": 1, "sku": "MLK-001", "name": "Milk",  "category": "Dairy",    "variant": "Full Cream",       "unit": "Liters", "cost_price": 100.0, "selling_price": 150.0, "supplier_id": 1},
        {"id": 2, "sku": "WR-001",  "name": "Wire",  "category": "Hardware", "variant": "10 Gauge Copper", "unit": "Meters", "cost_price":  30.0, "selling_price":  45.0, "supplier_id": 2},
        {"id": 3, "sku": "PP-001",  "name": "Pipe",  "category": "Hardware", "variant": "PVC 2 inch",       "unit": "Pieces", "cost_price":  80.0, "selling_price": 120.0, "supplier_id": 2},
        {"id": 4, "sku": "BKR-001", "name": "Bread", "category": "Bakery",   "variant": "Whole Wheat",      "unit": "Loaves", "cost_price":  40.0, "selling_price":  60.0, "supplier_id": 1},
        # ⚠️ DEMO ALERT: Sugar is critically low — triggers Low Stock & Reorder features immediately
        {"id": 5, "sku": "SGR-001", "name": "Sugar", "category": "Grocery",  "variant": "Refined White",    "unit": "KG",     "cost_price":  55.0, "selling_price":  80.0, "supplier_id": 3},
    ]
    stock_records = [
        {"product_id": 1, "warehouse_id": 1, "stock": 25.0,  "reorder_threshold": 5.0},
        {"product_id": 1, "warehouse_id": 2, "stock": 10.0,  "reorder_threshold": 5.0},
        {"product_id": 2, "warehouse_id": 1, "stock": 100.0, "reorder_threshold": 15.0},
        {"product_id": 3, "warehouse_id": 2, "stock": 50.0,  "reorder_threshold": 10.0},
        # Bread: stock (8) < threshold (20) → triggers reorder alert ✅
        {"product_id": 4, "warehouse_id": 1, "stock": 8.0,   "reorder_threshold": 20.0},
        # Sugar: stock (2) << threshold (30) → CRITICAL alert ✅
        {"product_id": 5, "warehouse_id": 1, "stock": 2.0,   "reorder_threshold": 30.0},
    ]

    transactions = [
        {"product_id": 1, "warehouse_id": 1, "type": "SALE",    "reason": None, "quantity": 30.0, "total_value": 4500.0, "timestamp": (now - timedelta(days=30)).isoformat()},
        {"product_id": 4, "warehouse_id": 1, "type": "SALE",    "reason": None, "quantity": 45.0, "total_value": 2700.0, "timestamp": (now - timedelta(days=30)).isoformat()},
        {"product_id": 2, "warehouse_id": 1, "type": "RESTOCK", "reason": None, "quantity": 50.0, "total_value": 1500.0, "timestamp": (now - timedelta(days=20)).isoformat()},
    ]

    batch = client.batch()

    for w in warehouses:
        batch.set(_col(user_id, COL_WAREHOUSES).document(str(w["id"])), w)
    for s in suppliers:
        batch.set(_col(user_id, COL_SUPPLIERS).document(str(s["id"])), s)
    for p in products:
        batch.set(_col(user_id, COL_PRODUCTS).document(str(p["id"])), {**p, "created_at": now.isoformat()})
    for sr in stock_records:
        doc_id = f'{sr["product_id"]}:{sr["warehouse_id"]}'
        batch.set(_col(user_id, COL_STOCK).document(doc_id), {**sr, "updated_at": now.isoformat()})
    batch.commit()

    for tx in transactions:
        _col(user_id, COL_TRANSACTIONS).add({**tx})

    mark_user_onboarded(user_id)


def init_empty_user(user_id: str):
    """Create a minimal empty workspace (1 warehouse) for a new user."""
    _col(user_id, COL_WAREHOUSES).document("1").set(
        {"id": 1, "name": "Main Warehouse", "location": "My City"}
    )
    mark_user_onboarded(user_id)


# ── Warehouses ────────────────────────────────────────────────────────────────

def get_warehouses(user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
    return [_doc_data(doc) for doc in _col(user_id, COL_WAREHOUSES).order_by("id").stream()]


def get_warehouse_by_id(warehouse_id: Any, user_id: str = DEFAULT_USER_ID) -> Optional[Dict[str, Any]]:
    wid = _normalize_id(warehouse_id)
    snap = _col(user_id, COL_WAREHOUSES).document(str(wid)).get()
    return _doc_data(snap) if snap.exists else None


def add_warehouse(name: str, location: str, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    wid = _next_numeric_id(user_id, COL_WAREHOUSES)
    _col(user_id, COL_WAREHOUSES).document(str(wid)).set({
        "id": wid,
        "name": name,
        "location": location,
        "created_at": utc_now().isoformat(),
    })
    log_activity(user_id, "ADD", "warehouse", {"id": wid, "name": name})
    return {"status": "success", "id": wid}


def update_warehouse(warehouse_id: Any, name: Optional[str] = None, location: Optional[str] = None,
                     user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    db_id = str(warehouse_id)
    ref = _col(user_id, COL_WAREHOUSES).document(db_id)
    if not ref.get().exists:
        try:
            int_id = str(int(float(warehouse_id)))
            ref = _col(user_id, COL_WAREHOUSES).document(int_id)
        except Exception:
            pass
    if not ref.get().exists:
        return {"status": "error", "message": f"Warehouse {warehouse_id} not found."}
    
    updates = {}
    if name is not None:
        updates["name"] = name
    if location is not None:
        updates["location"] = location
        
    if updates:
        ref.update(updates)
    log_activity(user_id, "EDIT", "warehouse", {"id": warehouse_id, **updates})
    return {"status": "success", "id": warehouse_id}


def delete_warehouse(warehouse_id: Any, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    db_id = str(warehouse_id)
    ref = _col(user_id, COL_WAREHOUSES).document(db_id)
    if not ref.get().exists:
        try:
            int_id = str(int(float(warehouse_id)))
            ref = _col(user_id, COL_WAREHOUSES).document(int_id)
        except Exception:
            pass
    if not ref.get().exists:
        return {"status": "error", "message": f"Warehouse {warehouse_id} not found."}
    ref.delete()
    log_activity(user_id, "DELETE", "warehouse", {"id": warehouse_id})
    return {"status": "success", "id": warehouse_id}


# ── Suppliers ─────────────────────────────────────────────────────────────────

def get_suppliers(user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
    docs = [_doc_data(doc) for doc in _col(user_id, COL_SUPPLIERS).stream()]
    return sorted(docs, key=lambda d: d.get("id", 0))


def _find_supplier_by_name(name: str, user_id: str) -> Optional[Dict[str, Any]]:
    norm = name.strip().lower()
    for doc in _col(user_id, COL_SUPPLIERS).stream():
        data = _doc_data(doc)
        if data.get("name", "").strip().lower() == norm:
            return data
    return None


def add_supplier(name: str, contact: str, rating: float, reliability_score: float,
                 lead_time_days: int, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    if _find_supplier_by_name(name, user_id):
        return {"status": "error", "message": f"Supplier '{name}' already exists."}
    sid = _next_numeric_id(user_id, COL_SUPPLIERS)
    _col(user_id, COL_SUPPLIERS).document(str(sid)).set({
        "id": sid, "name": name, "contact": contact, "rating": rating,
        "reliability_score": reliability_score, "lead_time_days": lead_time_days,
        "created_at": utc_now().isoformat(),
    })
    log_activity(user_id, "ADD", "supplier", {"id": sid, "name": name})
    return {"status": "success", "id": sid}


def update_supplier(supplier_id: Any, user_id: str = DEFAULT_USER_ID, **kwargs) -> Dict[str, Any]:
    db_id = str(supplier_id)
    ref = _col(user_id, COL_SUPPLIERS).document(db_id)
    if not ref.get().exists:
        try:
            int_id = str(int(float(supplier_id)))
            ref = _col(user_id, COL_SUPPLIERS).document(int_id)
        except Exception:
            pass
    if not ref.get().exists:
        return {"status": "error", "message": f"Supplier {supplier_id} not found."}
    updates = {k: v for k, v in kwargs.items() if v is not None}
    if updates:
        ref.update(updates)
    log_activity(user_id, "EDIT", "supplier", {"id": supplier_id, **updates})
    return {"status": "success", "id": supplier_id}


def delete_supplier(supplier_id: Any, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    db_id = str(supplier_id)
    ref = _col(user_id, COL_SUPPLIERS).document(db_id)
    if not ref.get().exists:
        try:
            int_id = str(int(float(supplier_id)))
            ref = _col(user_id, COL_SUPPLIERS).document(int_id)
        except Exception:
            pass
    if not ref.get().exists:
        return {"status": "error", "message": f"Supplier {supplier_id} not found."}
    ref.delete()
    log_activity(user_id, "DELETE", "supplier", {"id": supplier_id})
    return {"status": "success", "id": supplier_id}


def delete_all_suppliers(user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    docs = list(_col(user_id, COL_SUPPLIERS).stream())
    for doc in docs:
        doc.reference.delete()
    log_activity(user_id, "DELETE_ALL", "supplier", {"count": len(docs)})
    return {"status": "success", "deleted": len(docs)}


# ── Products ──────────────────────────────────────────────────────────────────

def _find_product_by_sku(sku: str, user_id: str) -> Optional[Dict[str, Any]]:
    norm = sku.strip().lower()
    for doc in _col(user_id, COL_PRODUCTS).stream():
        data = _doc_data(doc)
        if data.get("sku", "").strip().lower() == norm:
            return data
    return None


def get_product_by_id(product_id: Any, user_id: str = DEFAULT_USER_ID) -> Optional[Dict[str, Any]]:
    pid = _normalize_id(product_id)
    snap = _col(user_id, COL_PRODUCTS).document(str(pid)).get()
    return _doc_data(snap) if snap.exists else None


def get_product_by_name(name: str, user_id: str = DEFAULT_USER_ID) -> Optional[Dict[str, Any]]:
    norm = name.strip().lower()
    for doc in _col(user_id, COL_PRODUCTS).stream():
        data = _doc_data(doc)
        if data.get("name", "").strip().lower() == norm:
            return data
    return None


def search_products_by_name_fragment(fragment: str, user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
    norm = fragment.strip().lower()
    return [
        _doc_data(doc) for doc in _col(user_id, COL_PRODUCTS).stream()
        if norm in _doc_data(doc).get("name", "").lower()
    ]


def get_stock_record(product_id: Any, warehouse_id: Any, user_id: str = DEFAULT_USER_ID) -> Optional[Dict[str, Any]]:
    pid = _normalize_id(product_id)
    wid = _normalize_id(warehouse_id)
    snap = _col(user_id, COL_STOCK).document(f"{pid}:{wid}").get()
    if not snap.exists:
        return None
    data = _doc_data(snap)
    product   = get_product_by_id(pid, user_id) or {}
    warehouse = get_warehouse_by_id(wid, user_id) or {}
    return {**data, "product_name": product.get("name"), "unit": product.get("unit"), "warehouse_name": warehouse.get("name")}


def get_products(user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
    suppliers  = {item["id"]: item for item in get_suppliers(user_id)}
    warehouses = {item["id"]: item for item in get_warehouses(user_id)}
    products   = {item["id"]: item for item in [_doc_data(d) for d in _col(user_id, COL_PRODUCTS).stream()]}

    rows: List[Dict[str, Any]] = []
    for doc in _col(user_id, COL_STOCK).stream():
        stock_data = _doc_data(doc)
        product = products.get(stock_data["product_id"])
        if not product:
            continue
        rows.append({
            **product,
            "supplier_name":  suppliers.get(product.get("supplier_id"), {}).get("name"),
            "warehouse_id":   stock_data["warehouse_id"],
            "warehouse_name": warehouses.get(stock_data["warehouse_id"], {}).get("name"),
            "stock":          stock_data["stock"],
            "reorder_threshold": stock_data["reorder_threshold"],
        })
    return rows


def add_product(sku: str, name: str, category: str, variant: str, unit: str,
                cost_price: float, selling_price: float, supplier_id: int,
                warehouse_id: int, initial_stock: float, reorder_threshold: float,
                user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    if _find_product_by_sku(sku, user_id):
        return {"status": "error", "message": f"SKU '{sku}' already exists."}
    pid = _next_numeric_id(user_id, COL_PRODUCTS)
    _col(user_id, COL_PRODUCTS).document(str(pid)).set({
        "id": pid, "sku": sku, "name": name, "category": category, "variant": variant,
        "unit": unit, "cost_price": cost_price, "selling_price": selling_price,
        "supplier_id": supplier_id, "created_at": utc_now().isoformat(),
    })
    _col(user_id, COL_STOCK).document(f"{pid}:{int(warehouse_id)}").set({
        "product_id": pid, "warehouse_id": int(warehouse_id),
        "stock": float(initial_stock), "reorder_threshold": float(reorder_threshold),
        "updated_at": utc_now().isoformat(),
    })
    log_activity(user_id, "ADD", "product", {"id": pid, "name": name, "stock": initial_stock})
    return {"status": "success", "id": pid}


def update_product(product_id: Any, user_id: str = DEFAULT_USER_ID, warehouse_id: int = 1,
                   name=None, category=None, variant=None, unit=None,
                   cost_price=None, selling_price=None, supplier_id=None,
                   reorder_threshold=None, stock=None) -> Dict[str, Any]:
    db_id = str(product_id)
    ref = _col(user_id, COL_PRODUCTS).document(db_id)
    if not ref.get().exists:
        try:
            int_id = str(int(float(product_id)))
            ref = _col(user_id, COL_PRODUCTS).document(int_id)
            product_id = int(float(product_id))
        except Exception:
            pass
    if not ref.get().exists:
        return {"status": "error", "message": f"Product {product_id} not found."}
    updates = {k: v for k, v in dict(name=name, category=category, variant=variant, unit=unit,
                                     cost_price=cost_price, selling_price=selling_price,
                                     supplier_id=supplier_id).items() if v is not None}
    if updates:
        ref.update(updates)
    if stock is not None or reorder_threshold is not None:
        wh_ref = _col(user_id, COL_STOCK).document(f"{int(product_id)}:{int(warehouse_id)}")
        if wh_ref.get().exists:
            wh_upd: Dict[str, Any] = {"updated_at": utc_now().isoformat()}
            if stock is not None: wh_upd["stock"] = float(stock)
            if reorder_threshold is not None: wh_upd["reorder_threshold"] = float(reorder_threshold)
            wh_ref.update(wh_upd)
    log_activity(user_id, "EDIT", "product", {"id": product_id, **updates})
    return {"status": "success", "id": product_id}


def delete_product(product_id: Any, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    db_id = str(product_id)
    ref = _col(user_id, COL_PRODUCTS).document(db_id)
    if not ref.get().exists:
        try:
            int_id = str(int(float(product_id)))
            ref = _col(user_id, COL_PRODUCTS).document(int_id)
            product_id = int(float(product_id))
        except Exception:
            pass
    if not ref.get().exists:
        return {"status": "error", "message": f"Product {product_id} not found."}
    for doc in _col(user_id, COL_STOCK).stream():
        if _doc_data(doc).get("product_id") == int(product_id):
            doc.reference.delete()
    for doc in _col(user_id, COL_TRANSACTIONS).stream():
        if _doc_data(doc).get("product_id") == int(product_id):
            doc.reference.delete()
    ref.delete()
    log_activity(user_id, "DELETE", "product", {"id": product_id})
    return {"status": "success", "id": product_id}


# ── Transactions ──────────────────────────────────────────────────────────────

def _write_transaction(product_id: Any, warehouse_id: Any, tx_type: str, reason: Optional[str],
                       qty: float, total_value: float, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    pid = _normalize_id(product_id)
    wid = _normalize_id(warehouse_id)
    stock_record = get_stock_record(pid, wid, user_id)
    if not stock_record:
        raise ValueError(f"Product {pid} not found in Warehouse {wid}.")

    current_stock = float(stock_record["stock"])
    reorder_threshold = float(stock_record.get("reorder_threshold", 0.0))
    delta     = qty if tx_type in {"RESTOCK", "ADJUSTMENT"} else -qty
    new_stock = current_stock + delta
    if new_stock < 0 and tx_type != "ADJUSTMENT":
        raise ValueError(f"Insufficient stock. Available: {current_stock}")

    _col(user_id, COL_STOCK).document(f"{pid}:{wid}").set({
        "product_id": pid, "warehouse_id": wid,
        "stock": new_stock, "reorder_threshold": reorder_threshold,
        "updated_at": utc_now().isoformat(),
    })
    product = get_product_by_id(pid, user_id) or {}
    tx_doc = {
        "product_id": pid, "warehouse_id": wid,
        "type": tx_type, "reason": reason, "quantity": float(qty),
        "total_value": float(total_value), "timestamp": utc_now().isoformat(),
        "product_name": product.get("name", ""), "unit": product.get("unit", ""),
    }
    _col(user_id, COL_TRANSACTIONS).add(tx_doc)
    log_activity(user_id, tx_type, "transaction", {
        "product_id": pid, "product_name": product.get("name"),
        "qty": qty, "value": total_value, "warehouse_id": wid,
    })
    return {"status": "success", "remaining_stock": new_stock, "reorder_warning": new_stock <= reorder_threshold}


def record_sale(product_id: Any, warehouse_id: Any, quantity: float,
                revenue: float, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    try:
        return _write_transaction(product_id, warehouse_id, "SALE", None, quantity, revenue, user_id)
    except Exception as e:
        return {"status": "error", "message": str(e)}


def record_restock(product_id: Any, warehouse_id: Any, quantity: float,
                   cost: float, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    try:
        return _write_transaction(product_id, warehouse_id, "RESTOCK", None, quantity, cost, user_id)
    except Exception as e:
        return {"status": "error", "message": str(e)}


def record_adjustment(product_id: Any, warehouse_id: Any, quantity_diff: float,
                      reason: str, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    if not reason:
        return {"status": "error", "message": "Adjustment requires a reason."}
    try:
        return _write_transaction(product_id, warehouse_id, "ADJUSTMENT", reason, quantity_diff, 0.0, user_id)
    except Exception as e:
        return {"status": "error", "message": str(e)}


def get_transactions(user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
    products   = {item["id"]: item for item in get_products(user_id)}
    warehouses = {item["id"]: item for item in get_warehouses(user_id)}
    rows = [_doc_data(doc) for doc in _col(user_id, COL_TRANSACTIONS)
            .order_by("timestamp", direction=firestore.Query.DESCENDING).stream()]
    for row in rows:
        product   = products.get(row.get("product_id"), {})
        warehouse = warehouses.get(row.get("warehouse_id"), {})
        row["product_name"]   = row.get("product_name") or product.get("name")
        row["unit"]           = row.get("unit") or product.get("unit")
        row["warehouse_name"] = warehouse.get("name")
    return rows


# ── Orders ────────────────────────────────────────────────────────────────────

def get_orders(user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
    products   = {item["id"]: item for item in get_products(user_id)}
    warehouses = {item["id"]: item for item in get_warehouses(user_id)}
    rows = []
    for doc in _col(user_id, COL_ORDERS).stream():
        data = _doc_data(doc)
        product   = products.get(data.get("product_id"), {})
        warehouse = warehouses.get(data.get("warehouse_id"), {})
        rows.append({
            **data,
            "product_name":   product.get("name", "Unknown"),
            "unit":           product.get("unit", ""),
            "warehouse_name": warehouse.get("name", ""),
        })
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return rows


def add_order(order_ref: str, customer_name: str, product_id: int, warehouse_id: int,
              quantity: float, unit_price: float, total_value: float,
              status: str = "PENDING", user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    existing = list(_col(user_id, COL_ORDERS).where("order_ref", "==", order_ref).limit(1).stream())
    if existing:
        return {"status": "error", "message": f"Order ref '{order_ref}' already exists."}
    oid = _next_numeric_id(user_id, COL_ORDERS)
    _col(user_id, COL_ORDERS).document(str(oid)).set({
        "id": oid, "order_ref": order_ref, "customer_name": customer_name,
        "product_id": int(product_id), "warehouse_id": int(warehouse_id),
        "quantity": float(quantity), "unit_price": float(unit_price),
        "total_value": float(total_value), "status": status,
        "created_at": utc_now().isoformat(),
    })
    log_activity(user_id, "ORDER", "order", {"id": oid, "customer": customer_name, "status": status})
    return {"status": "success", "id": oid}


def update_order_status(order_id: Any, status: str, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    valid = {"PENDING", "PACKED", "DISPATCHED", "FULFILLED", "CANCELLED"}
    if status not in valid:
        return {"status": "error", "message": f"Invalid status '{status}'. Use: {valid}"}
    db_id = str(order_id)
    ref = _col(user_id, COL_ORDERS).document(db_id)
    if not ref.get().exists:
        try:
            int_id = str(int(float(order_id)))
            ref = _col(user_id, COL_ORDERS).document(int_id)
        except Exception:
            pass
    if not ref.get().exists:
        return {"status": "error", "message": f"Order {order_id} not found."}
    ref.update({"status": status, "updated_at": utc_now().isoformat()})
    log_activity(user_id, "ORDER_STATUS", "order", {"id": order_id, "status": status})
    return {"status": "success", "id": order_id}


def delete_order(order_id: Any, user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    db_id = str(order_id)
    ref = _col(user_id, COL_ORDERS).document(db_id)
    if not ref.get().exists:
        try:
            int_id = str(int(float(order_id)))
            ref = _col(user_id, COL_ORDERS).document(int_id)
        except Exception:
            pass
    if not ref.get().exists:
        return {"status": "error", "message": f"Order {order_id} not found."}
    ref.delete()
    log_activity(user_id, "DELETE", "order", {"id": order_id})
    return {"status": "success", "id": order_id}


def dispatch_order(order_id: Any, courier_name: str, courier_phone: str,
                   user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    db_id = str(order_id)
    ref = _col(user_id, COL_ORDERS).document(db_id)
    if not ref.get().exists:
        try:
            int_id = str(int(float(order_id)))
            ref = _col(user_id, COL_ORDERS).document(int_id)
        except Exception:
            pass
    if not ref.get().exists:
        return {"status": "error", "message": f"Order {order_id} not found."}
    ref.update({
        "status": "DISPATCHED",
        "courier_name": courier_name,
        "courier_phone": courier_phone,
        "dispatched_at": utc_now().isoformat(),
    })
    log_activity(user_id, "DISPATCH", "order", {"id": order_id, "courier": courier_name})
    return {"status": "success", "id": order_id}


# ── Activity Log ──────────────────────────────────────────────────────────────

def get_activity_log(user_id: str = DEFAULT_USER_ID, limit: int = 100) -> List[Dict[str, Any]]:
    try:
        docs = (_col(user_id, COL_ACTIVITY_LOG)
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream())
        return [{**_doc_data(doc), "log_id": doc.id} for doc in docs]
    except Exception as e:
        print(f"[ActivityLog] get error: {e}")
        return []


# ── Analytics ─────────────────────────────────────────────────────────────────

def get_demand_predictions(user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
    today = utc_now()
    ninety_days_ago = today - timedelta(days=90)
    products = get_products(user_id)
    transactions = [
        row for row in get_transactions(user_id)
        if _timestamp_value(row.get("timestamp")) >= ninety_days_ago and row.get("type") == "SALE"
    ]

    weekly_sales: Dict[tuple, list] = defaultdict(lambda: [0.0] * 13)
    meta: Dict[tuple, dict] = {}

    for product in products:
        key = (product["id"], product["warehouse_id"])
        meta[key] = {
            "product_id": product["id"], "product_name": product["name"],
            "warehouse_name": product.get("warehouse_name"),
            "current_stock": product["stock"], "unit": product["unit"],
        }

    for tx in transactions:
        key = (tx["product_id"], tx["warehouse_id"])
        if key not in meta:
            continue
        tx_date  = _timestamp_value(tx.get("timestamp"))
        days_ago = (today - tx_date).days
        week_idx = min(int(days_ago // 7), 12)
        bucket   = 12 - week_idx
        weekly_sales[key][bucket] += float(tx.get("quantity", 0.0))

    predictions = []
    alpha = 0.4
    for key, item in meta.items():
        weeks    = weekly_sales[key]
        non_zero = [w for w in weeks if w > 0]
        if non_zero:
            smoothed = weeks[0]
            for week in weeks[1:]:
                smoothed = alpha * week + (1 - alpha) * smoothed
            daily_velocity = smoothed / 7.0
            recent_avg = sum(weeks[9:13]) / 4.0
            older_avg  = sum(weeks[5:9]) / 4.0
            if older_avg > 0:
                trend_pct = ((recent_avg - older_avg) / older_avg) * 100
                trend = "UP" if trend_pct > 5 else "DOWN" if trend_pct < -5 else "STABLE"
            else:
                trend_pct, trend = 0.0, "STABLE"
            confidence = "HIGH" if len(non_zero) >= 6 else "MEDIUM" if len(non_zero) >= 3 else "LOW"
        else:
            daily_velocity, trend, trend_pct, confidence = 0.5, "STABLE", 0.0, "LOW"

        stock = float(item["current_stock"])
        days_remaining  = stock / daily_velocity if daily_velocity > 0 else 9999
        stock_out_date  = (today + timedelta(days=days_remaining)).strftime("%Y-%m-%d")

        predictions.append({
            "product_id": item["product_id"], "name": item["product_name"],
            "warehouse_name": item["warehouse_name"], "current_stock": round(stock, 2),
            "unit": item["unit"], "daily_velocity": round(daily_velocity, 2),
            "days_remaining": round(min(days_remaining, 9999), 1),
            "estimated_stockout_date": stock_out_date,
            "predicted_demand_30d": round(daily_velocity * 30, 1),
            "trend": trend, "trend_pct": round(trend_pct, 1),
            "confidence": confidence, "forecast_model": "SES_alpha0.4",
        })
    return predictions


def get_reorder_suggestions(user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
    suppliers = {item["id"]: item for item in get_suppliers(user_id)}
    suggestions = []
    for product in get_products(user_id):
        if float(product["stock"]) > float(product["reorder_threshold"]):
            continue
        lead_time    = int(suppliers.get(product.get("supplier_id"), {}).get("lead_time_days") or 3)
        stock        = float(product["stock"])
        threshold    = float(product["reorder_threshold"])
        daily_base   = max(threshold / 7.0, 0.5)
        lead_demand  = daily_base * lead_time
        sugg_qty     = round((lead_demand + threshold) * 1.2, 1)
        days_of_stock = stock / daily_base if daily_base > 0 else 0
        urgency = "CRITICAL" if stock == 0 else "HIGH" if days_of_stock <= lead_time else "MEDIUM"
        supplier_name = suppliers.get(product.get("supplier_id"), {}).get("name") or "Default Supplier"
        suggestions.append({
            "product_id": product["id"], "product_name": product["name"],
            "warehouse_name": product.get("warehouse_name"), "current_stock": round(stock, 2),
            "threshold": threshold, "supplier_name": supplier_name,
            "lead_time_days": lead_time, "days_of_stock_remaining": round(days_of_stock, 1),
            "suggested_reorder_qty": sugg_qty, "urgency": urgency,
            "message": f"[{urgency}] {product['name']} at {product.get('warehouse_name')}: {stock} left, {lead_time}d lead time. Order {sugg_qty} units from {supplier_name}.",
        })
    suggestions.sort(key=lambda x: {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}.get(x["urgency"], 3))
    return suggestions


def get_profit_summary(user_id: str = DEFAULT_USER_ID) -> Dict[str, Any]:
    products_list = get_products(user_id)
    products_map  = {p["id"]: p for p in products_list}
    transactions  = get_transactions(user_id)

    product_stats: Dict[int, Dict[str, float]] = {}
    for tx in transactions:
        pid = tx.get("product_id")
        if pid is None:
            continue
        if pid not in product_stats:
            product_stats[pid] = {"revenue": 0.0, "cost": 0.0, "qty_sold": 0.0, "qty_restocked": 0.0}
        tx_type = tx.get("type", "")
        qty = float(tx.get("quantity", 0))
        val = float(tx.get("total_value", 0))
        if tx_type == "SALE":
            product_stats[pid]["revenue"] += val
            product_stats[pid]["qty_sold"] += qty
            p = products_map.get(pid, {})
            product_stats[pid]["cost"] += qty * float(p.get("cost_price", 0))
        elif tx_type == "RESTOCK":
            product_stats[pid]["cost"] += val
            product_stats[pid]["qty_restocked"] += qty

    per_product = []
    total_revenue = total_cost = 0.0
    for pid, stats in product_stats.items():
        p = products_map.get(pid, {})
        revenue = stats["revenue"]; cost = stats["cost"]
        profit  = revenue - cost
        margin  = (profit / revenue * 100) if revenue > 0 else 0.0
        total_revenue += revenue; total_cost += cost
        per_product.append({
            "product_id": pid, "product_name": p.get("name", "Unknown"),
            "revenue": round(revenue, 2), "cost": round(cost, 2),
            "profit": round(profit, 2), "margin_pct": round(margin, 1),
            "qty_sold": stats["qty_sold"],
        })
    per_product.sort(key=lambda x: x["profit"], reverse=True)
    total_profit = total_revenue - total_cost
    total_margin = (total_profit / total_revenue * 100) if total_revenue > 0 else 0.0
    low_stock_count = sum(1 for p in products_list if float(p.get("stock", 0)) <= float(p.get("reorder_threshold", 0)))
    return {
        "total_revenue": round(total_revenue, 2), "total_cost": round(total_cost, 2),
        "total_profit": round(total_profit, 2), "total_margin_pct": round(total_margin, 1),
        "low_stock_count": low_stock_count, "total_products": len(products_list),
        "per_product": per_product,
    }


# Backward-compat shim so existing code that calls without user_id still works
def get_db_connection():
    raise RuntimeError("SQLite has been removed. Use Firestore-backed helpers.")
