"""
ERP API Router — Per-user Firestore backend.
Every endpoint extracts user_id from the X-User-ID header so that all
data operations are scoped to the authenticated user.
"""
import io
import csv
import random
import uuid
from typing import Optional, List, Union, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Header, BackgroundTasks, Query

from broker.event_broker import broker
from company_brain.firestore_inventory import (
    # Warehouses
    get_warehouses, add_warehouse, update_warehouse, delete_warehouse,
    # Suppliers
    get_suppliers, add_supplier, update_supplier, delete_supplier, delete_all_suppliers,
    # Products
    add_product, update_product, delete_product, get_products, get_product_by_id,
    search_products_by_name_fragment,
    # Transactions
    record_sale, record_restock, record_adjustment, get_transactions,
    # Analytics
    get_demand_predictions, get_reorder_suggestions, get_profit_summary,
    # Orders
    get_orders, add_order, update_order_status, delete_order, dispatch_order,
    # Onboarding
    seed_user_data, init_empty_user, user_is_onboarded,
    # Activity
    get_activity_log,
    DEFAULT_USER_ID,
    save_push_token,
)
from company_brain.notifications import (
    send_push_notification,
    get_notifications,
    mark_notification_read,
    mark_all_notifications_read,
)

router = APIRouter()


# ── User-ID extraction helper ─────────────────────────────────────────────────

def _uid(x_user_id: Optional[str]) -> str:
    """Return the caller's user_id, falling back to the legacy shared namespace."""
    return x_user_id.strip() if x_user_id and x_user_id.strip() else DEFAULT_USER_ID


# ── Schemas ──────────────────────────────────────────────────────────────────

class SupplierRequest(BaseModel):
    name: str
    contact: str
    rating: float
    reliability_score: float
    lead_time_days: int

class UpdateSupplierRequest(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    rating: Optional[float] = None
    reliability_score: Optional[float] = None
    lead_time_days: Optional[int] = None

class ProductRequest(BaseModel):
    sku: str
    name: str
    category: Optional[str] = ""
    variant: Optional[str] = ""
    unit: Optional[str] = "units"
    cost_price: float
    selling_price: float
    supplier_id: Optional[Union[int, str]] = None
    warehouse_id: Optional[Union[int, str]] = 1
    initial_stock: Optional[float] = None
    stock: Optional[float] = None
    reorder_threshold: Optional[float] = 0.0

class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    variant: Optional[str] = None
    unit: Optional[str] = None
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None
    supplier_id: Optional[Union[int, str]] = None
    reorder_threshold: Optional[float] = None
    stock: Optional[float] = None
    warehouse_id: Optional[Union[int, str]] = 1

class OrderRequest(BaseModel):
    order_ref: Optional[str] = None
    customer_name: str
    product_id: Union[int, str]
    warehouse_id: Union[int, str] = 1
    quantity: float
    unit_price: float
    total_value: Optional[float] = None

class OrderStatusRequest(BaseModel):
    status: str

class WarehouseRequest(BaseModel):
    name: str
    location: str
    capacity: Optional[float] = 0.0

class UpdateWarehouseRequest(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None

class PushTokenRequest(BaseModel):
    token: str

class DispatchRequest(BaseModel):
    courier_name: str
    courier_phone: str

class TransactionRequest(BaseModel):
    product_id: Union[int, str]
    warehouse_id: Union[int, str]
    quantity: float
    value: float

class AdjustmentRequest(BaseModel):
    product_id: Union[int, str]
    warehouse_id: Union[int, str]
    quantity_diff: float
    reason: str

class ProcurementApproveRequest(BaseModel):
    product_id: Union[int, str]
    warehouse_id: Union[int, str]
    quantity: float
    vendor: dict

class ProcurementSuggestRequest(BaseModel):
    product_name: str
    lat: Optional[float] = 24.8607
    lng: Optional[float] = 67.0011

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_id: Optional[str] = None


# ── Warehouses ────────────────────────────────────────────────────────────────

@router.get("/api/warehouses")
def api_get_warehouses(x_user_id: Optional[str] = Header(None)):
    return get_warehouses(_uid(x_user_id))


@router.post("/api/warehouses/add")
def api_add_warehouse(req: WarehouseRequest, x_user_id: Optional[str] = Header(None)):
    res = add_warehouse(req.name, req.location, _uid(x_user_id))
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.put("/api/warehouses/{warehouse_id}")
def api_update_warehouse(warehouse_id: str, req: UpdateWarehouseRequest,
                         x_user_id: Optional[str] = Header(None)):
    res = update_warehouse(warehouse_id, req.name, req.location, _uid(x_user_id))
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.delete("/api/warehouses/{warehouse_id}")
def api_delete_warehouse(warehouse_id: str, x_user_id: Optional[str] = Header(None)):
    res = delete_warehouse(warehouse_id, _uid(x_user_id))
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


# ── Suppliers ─────────────────────────────────────────────────────────────────

@router.get("/api/suppliers")
def api_get_suppliers(x_user_id: Optional[str] = Header(None)):
    return get_suppliers(_uid(x_user_id))


@router.post("/api/suppliers")
def api_add_supplier(req: SupplierRequest, background_tasks: BackgroundTasks, x_user_id: Optional[str] = Header(None)):
    uid = _uid(x_user_id)
    res = add_supplier(req.name, req.contact, req.rating, req.reliability_score, req.lead_time_days, uid)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    background_tasks.add_task(send_push_notification, uid, "New Supplier Added", f"{req.name} has been added to your network.")
    return {"message": "Supplier added", "id": res.get("id")}


@router.put("/api/suppliers/{supplier_id}")
def api_update_supplier(supplier_id: str, req: UpdateSupplierRequest, background_tasks: BackgroundTasks, x_user_id: Optional[str] = Header(None)):
    uid = _uid(x_user_id)
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    res = update_supplier(supplier_id, uid, **update_data)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    background_tasks.add_task(send_push_notification, uid, "Supplier Updated", f"Details for supplier '{update_data.get('name', 'ID: '+supplier_id)}' were updated.")
    return {"message": "Supplier updated"}


@router.delete("/api/suppliers/all")
def api_delete_all_suppliers(x_user_id: Optional[str] = Header(None)):
    return delete_all_suppliers(_uid(x_user_id))


@router.delete("/api/suppliers/{supplier_id}")
def api_delete_supplier(supplier_id: str, background_tasks: BackgroundTasks, x_user_id: Optional[str] = Header(None)):
    uid = _uid(x_user_id)
    res = delete_supplier(supplier_id, uid)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    background_tasks.add_task(send_push_notification, uid, "Supplier Removed", f"Supplier has been removed from your network.")
    return {"message": "Supplier deleted"}


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("/api/products")
def api_get_products(x_user_id: Optional[str] = Header(None)):
    return get_products(_uid(x_user_id))


@router.post("/api/products/add")
def api_add_product(req: ProductRequest, x_user_id: Optional[str] = Header(None)):
    qty = req.initial_stock if req.initial_stock is not None else (req.stock if req.stock is not None else 0.0)
    res = add_product(
        sku=req.sku, name=req.name, category=req.category or "",
        variant=req.variant or "", unit=req.unit or "units",
        cost_price=req.cost_price, selling_price=req.selling_price,
        supplier_id=req.supplier_id, warehouse_id=req.warehouse_id or 1,
        initial_stock=qty, reorder_threshold=req.reorder_threshold or 0.0,
        user_id=_uid(x_user_id),
    )
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.put("/api/products/{product_id}")
def api_update_product(product_id: str, req: UpdateProductRequest,
                       x_user_id: Optional[str] = Header(None)):
    res = update_product(
        product_id=product_id, user_id=_uid(x_user_id),
        name=req.name, category=req.category, variant=req.variant,
        unit=req.unit, cost_price=req.cost_price, selling_price=req.selling_price,
        supplier_id=req.supplier_id, reorder_threshold=req.reorder_threshold,
        stock=req.stock, warehouse_id=req.warehouse_id,
    )
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.delete("/api/products/{product_id}")
def api_delete_product(product_id: str, x_user_id: Optional[str] = Header(None)):
    res = delete_product(product_id, _uid(x_user_id))
    if res["status"] == "error":
        raise HTTPException(status_code=404, detail=res["message"])
    return res


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get("/api/transactions")
def api_get_transactions(x_user_id: Optional[str] = Header(None)):
    return get_transactions(_uid(x_user_id))


@router.post("/api/transactions/sale")
def api_record_sale(req: TransactionRequest, x_user_id: Optional[str] = Header(None)):
    res = record_sale(req.product_id, req.warehouse_id, req.quantity, req.value, _uid(x_user_id))
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.post("/api/transactions/restock")
def api_record_restock(req: TransactionRequest, x_user_id: Optional[str] = Header(None)):
    res = record_restock(req.product_id, req.warehouse_id, req.quantity, req.value, _uid(x_user_id))
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.post("/api/transactions/adjustment")
def api_record_adjustment(req: AdjustmentRequest, x_user_id: Optional[str] = Header(None)):
    res = record_adjustment(req.product_id, req.warehouse_id, req.quantity_diff,
                            req.reason, _uid(x_user_id))
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/api/inventory/predictions")
def api_get_demand_predictions(x_user_id: Optional[str] = Header(None)):
    return get_demand_predictions(_uid(x_user_id))


@router.get("/api/inventory/suggestions")
def api_get_reorder_suggestions(x_user_id: Optional[str] = Header(None)):
    return get_reorder_suggestions(_uid(x_user_id))


@router.get("/api/analytics/profit")
def api_get_profit_summary(x_user_id: Optional[str] = Header(None)):
    return get_profit_summary(_uid(x_user_id))


# ── Orders ────────────────────────────────────────────────────────────────────

@router.get("/api/orders")
def api_get_orders(x_user_id: Optional[str] = Header(None)):
    return get_orders(_uid(x_user_id))


@router.post("/api/orders/add")
def api_add_order(req: OrderRequest, x_user_id: Optional[str] = Header(None)):
    order_ref = req.order_ref or f"ORD-{uuid.uuid4().hex[:6].upper()}"
    total = req.total_value if req.total_value is not None else req.quantity * req.unit_price
    res = add_order(
        order_ref=order_ref, customer_name=req.customer_name,
        product_id=req.product_id, warehouse_id=req.warehouse_id,
        quantity=req.quantity, unit_price=req.unit_price, total_value=total,
        user_id=_uid(x_user_id),
    )
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.put("/api/orders/{order_id}/status")
def api_update_order_status(order_id: str, req: OrderStatusRequest,
                            x_user_id: Optional[str] = Header(None)):
    res = update_order_status(order_id, req.status, _uid(x_user_id))
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.post("/api/orders/{order_id}/dispatch")
def api_dispatch_order(order_id: str, req: DispatchRequest,
                       x_user_id: Optional[str] = Header(None)):
    res = dispatch_order(order_id, req.courier_name, req.courier_phone, _uid(x_user_id))
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.delete("/api/orders/{order_id}")
def api_delete_order(order_id: str, x_user_id: Optional[str] = Header(None)):
    res = delete_order(order_id, _uid(x_user_id))
    if res["status"] == "error":
        raise HTTPException(status_code=404, detail=res["message"])
    return res


# ── Activity Log ──────────────────────────────────────────────────────────────

@router.get("/api/activity-log")
def api_get_activity_log(limit: int = 100, x_user_id: Optional[str] = Header(None)):
    return get_activity_log(_uid(x_user_id), limit)


# ── Onboarding ────────────────────────────────────────────────────────────────

@router.get("/api/users/onboarding")
def api_get_onboarding_status(x_user_id: Optional[str] = Header(None)):
    uid = _uid(x_user_id)
    onboarded = user_is_onboarded(uid)
    return {"onboarded": onboarded}

@router.post("/api/users/push-token")
def api_update_push_token(req: PushTokenRequest, x_user_id: Optional[str] = Header(None)):
    uid = _uid(x_user_id)
    save_push_token(uid, req.token)
    return {"message": "Push token saved"}

@router.post("/api/users/test-push")
def api_test_push_token(background_tasks: BackgroundTasks, x_user_id: Optional[str] = Header(None)):
    uid = _uid(x_user_id)
    background_tasks.add_task(send_push_notification, uid, "Push Notification Test", "Your push notification system is working perfectly! ✅")
    return {"message": "Test push initiated"}


@router.get("/api/users/notifications")
def api_get_notifications(limit: int = 50, x_user_id: Optional[str] = Header(None)):
    return get_notifications(_uid(x_user_id), limit)


@router.patch("/api/users/notifications/{notif_id}/read")
def api_mark_notification_read(notif_id: str, x_user_id: Optional[str] = Header(None)):
    mark_notification_read(_uid(x_user_id), notif_id)
    return {"message": "Marked as read"}


@router.post("/api/users/notifications/mark-all-read")
def api_mark_all_notifications_read(x_user_id: Optional[str] = Header(None)):
    mark_all_notifications_read(_uid(x_user_id))
    return {"message": "All notifications marked as read"}

@router.post("/api/onboarding/seed")
def api_onboarding_seed(x_user_id: Optional[str] = Header(None)):
    uid = _uid(x_user_id)
    seed_user_data(uid)
    return {"status": "success", "message": "Sample data loaded."}


@router.post("/api/onboarding/init")
def api_onboarding_init(x_user_id: Optional[str] = Header(None)):
    uid = _uid(x_user_id)
    init_empty_user(uid)
    return {"status": "success", "message": "Empty workspace created."}


# ── Vendor / Supplier Finder ──────────────────────────────────────────────────

@router.get("/api/vendors/search")
def api_search_vendors(query: str, location: str = "Karachi",
                       x_user_id: Optional[str] = Header(None)):
    import os, requests as req_lib
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if api_key:
        try:
            url = (f"https://maps.googleapis.com/maps/api/place/textsearch/json"
                   f"?query={query}+wholesale+{location}&key={api_key}")
            res = req_lib.get(url).json()
            if res.get("status") == "OK":
                vendors = []
                for i, p in enumerate(res.get("results", [])[:5]):
                    rating = p.get("rating", round(random.uniform(4.0, 4.9), 1))
                    vendors.append({
                        "id": f"map-{i}", "name": p.get("name"),
                        "address": p.get("formatted_address"), "rating": rating,
                        "distance": f"{round(random.uniform(0.5, 6.0), 1)} km",
                        "price": f"Rs {round(random.uniform(50.0, 500.0), 1)}",
                        "contact": p.get("formatted_phone_number", f"+92-300-{random.randint(1000000,9999999)}"),
                        "reliability_score": round(90.0 - random.uniform(0,10) + rating * 2, 1),
                    })
                return {"status": "success", "vendors": vendors}
        except Exception as e:
            print(f"[Vendor Search] Maps API failed: {e}")

    # OpenStreetMap fallback
    try:
        import requests as r
        headers = {"User-Agent": "OpsifyERP/1.0"}
        res = r.get(f"https://nominatim.openstreetmap.org/search?q={query}+{location}&format=json&limit=5",
                    headers=headers, timeout=8).json()
        if res:
            vendors = []
            for i, item in enumerate(res):
                parts = [p.strip() for p in item.get("display_name", f"{query.title()}").split(",")]
                name = parts[0] if len(parts[0]) >= 10 else f"{parts[0]} ({parts[1]})" if len(parts) > 1 else parts[0]
                vendors.append({
                    "id": f"osm-{i}", "name": name,
                    "address": item.get("display_name", "")[:120],
                    "rating": round(random.uniform(4.0, 4.9), 1),
                    "distance": f"{round(random.uniform(0.5, 6.0), 1)} km",
                    "price": f"Rs {round(random.uniform(50.0, 500.0), 1)}",
                    "contact": f"+92-300-{random.randint(1000000, 9999999)}",
                    "reliability_score": round(random.uniform(70.0, 95.0), 1),
                })
            return {"status": "success", "vendors": vendors}
    except Exception as e:
        print(f"[Vendor Search] OSM failed: {e}")

    # Mock fallback
    kw = query.lower()
    prefixes = (
        ["Sindh Farms Milk", "National Dairy", "Pak-Arab Wholesalers", "Karachi Fresh Milk", "Premium Farms Wholesalers"] if any(x in kw for x in ["milk","dairy"])
        else ["Pakistan Cables", "Gulshan Electric", "DHA Copper Mills", "Karachi Hardware", "Indus Metal Hub"] if any(x in kw for x in ["wire","copper","metal"])
        else ["Indus PVC Pipes", "Karachi Plumbing", "Standard Fitting Co.", "Super Pipe Wholesalers", "Clifton Hardware Hub"] if any(x in kw for x in ["pipe","pvc"])
        else ["BakeHouse Wholesalers", "National Bread Co.", "Standard Grain", "Premium Flour", "Karachi Loaf Dist."] if any(x in kw for x in ["bread","bakery"])
        else [f"Karachi {query.title()} Traders", f"{location} {query.title()} Co.", f"Sindh Wholesale {query.title()}", f"Prime {query.title()}", f"Apex {query.title()} Dist."]
    )
    random.seed(len(kw) + len(location))
    vendors = []
    for i, prefix in enumerate(prefixes[:5]):
        rating = round(random.uniform(4.0, 5.0), 1)
        vendors.append({
            "id": f"mock-{i}", "name": prefix,
            "address": f"Plot {random.randint(10,250)}, Block {random.randint(1,9)}, {location}",
            "rating": rating,
            "distance": f"{round(random.uniform(0.5, 5.0), 1)} km",
            "price": f"Rs {round(random.uniform(50.0, 500.0), 1)}",
            "contact": f"+92-321-{random.randint(1000000, 9999999)}",
            "reliability_score": round(90.0 - i * 2 + rating * 2, 1),
        })
    return {"status": "success", "vendors": vendors}


# ── Procurement ──────────────────────────────────────────────────────────────

@router.post("/api/procurement/suggest")
def api_procurement_suggest(req: ProcurementSuggestRequest):
    from agents.bidding_agent import generate_procurement_suggestions
    return {"suggestions": generate_procurement_suggestions(req.product_name, req.lat, req.lng)}


@router.post("/api/procurement/approve")
async def api_procurement_approve(req: ProcurementApproveRequest,
                                  x_user_id: Optional[str] = Header(None)):
    uid = _uid(x_user_id)
    vendor = req.vendor
    name = vendor.get("name", "Unknown Supplier")
    sups = get_suppliers(uid)
    sup_id = next((s["id"] for s in sups if s["name"] == name), None)
    if not sup_id:
        res = add_supplier(name=name, contact=vendor.get("contact", ""),
                           rating=vendor.get("rating", 4.0),
                           reliability_score=vendor.get("reliability_score", 80.0),
                           lead_time_days=vendor.get("lead_time_days", 1),
                           user_id=uid)
        if res["status"] == "error":
            raise HTTPException(status_code=400, detail=res["message"])
        sup_id = res.get("id", 1)
    price_str = str(vendor.get("price", "0"))
    try:
        price_val = float(''.join(c for c in price_str if c.isdigit() or c == '.'))
    except ValueError:
        price_val = 100.0
    res = record_restock(req.product_id, req.warehouse_id, req.quantity,
                         price_val * req.quantity, uid)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    await broker.publish("SYSTEM_LOG", "ProcurementEngine", {
        "message": f"Procurement Approved: {req.quantity} units from {name} for Rs {price_val * req.quantity:.0f}."
    })
    return {"status": "success", "message": "Procurement approved and stock updated."}


# ── OpsBot Chat ───────────────────────────────────────────────────────────────

@router.post("/api/chat")
async def api_chat(req: ChatRequest, x_user_id: Optional[str] = Header(None)):
    from agents.chat_agent import run_chat
    uid = req.user_id or _uid(x_user_id)
    msgs = [{"role": m.role, "content": m.content, "timestamp": None} for m in req.messages]
    result = run_chat(msgs)
    return result


# ── CSV Export ───────────────────────────────────────────────────────────────

@router.get("/api/export/csv")
def api_export_csv(uid: Optional[str] = Query(None), x_user_id: Optional[str] = Header(None)):
    from fastapi.responses import StreamingResponse
    user = uid or _uid(x_user_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["--- INVENTORY & STOCK ---"])
    products = get_products(user)
    if products:
        writer.writerow(products[0].keys()); [writer.writerow(p.values()) for p in products]
    writer.writerow([]); writer.writerow(["--- TRANSACTIONS ---"])
    txs = get_transactions(user)
    if txs:
        writer.writerow(txs[0].keys()); [writer.writerow(t.values()) for t in txs]
    writer.writerow([]); writer.writerow(["--- SUPPLIERS ---"])
    sups = get_suppliers(user)
    if sups:
        writer.writerow(sups[0].keys()); [writer.writerow(s.values()) for s in sups]
    output.seek(0)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=opsify_ledger_export.csv"}
    )
