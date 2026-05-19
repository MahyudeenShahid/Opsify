import io
import csv
import random
from typing import Optional, List, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from broker.event_broker import broker
from company_brain.firestore_inventory import (
    get_suppliers,
    add_supplier,
    update_supplier,
    delete_supplier,
    delete_all_suppliers,
    add_product,
    update_product,
    delete_product,
    get_products,
    record_sale,
    record_restock,
    record_adjustment,
    get_transactions,
    get_demand_predictions,
    get_reorder_suggestions,
    get_warehouses,
    get_orders,
    add_order,
    update_order_status,
    delete_order,
    get_profit_summary,
)

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────────────────────────
class SupplierRequest(BaseModel):
    name: str
    contact: str
    rating: float
    reliability_score: float
    lead_time_days: int

class ProductRequest(BaseModel):
    sku: str
    name: str
    category: Optional[str] = ""
    variant: Optional[str] = ""
    unit: Optional[str] = "units"
    cost_price: float
    selling_price: float
    supplier_id: Optional[int] = None
    warehouse_id: Optional[int] = 1
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
    supplier_id: Optional[int] = None
    reorder_threshold: Optional[float] = None
    stock: Optional[float] = None
    warehouse_id: Optional[int] = 1

class UpdateSupplierRequest(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    rating: Optional[float] = None
    reliability_score: Optional[float] = None
    lead_time_days: Optional[int] = None

class OrderRequest(BaseModel):
    order_ref: Optional[str] = None
    customer_name: str
    product_id: int
    warehouse_id: int = 1
    quantity: float
    unit_price: float
    total_value: Optional[float] = None

class OrderStatusRequest(BaseModel):
    status: str  # PENDING | FULFILLED | CANCELLED

class TransactionRequest(BaseModel):
    product_id: int
    warehouse_id: int
    quantity: float
    value: float

class AdjustmentRequest(BaseModel):
    product_id: int
    warehouse_id: int
    quantity_diff: float
    reason: str

class ProcurementApproveRequest(BaseModel):
    product_id: int
    warehouse_id: int
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



# ── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/api/warehouses")
def api_get_warehouses():
    return get_warehouses()


@router.get("/api/suppliers")
def api_get_suppliers():
    return get_suppliers()


@router.post("/api/suppliers/add")
def api_add_supplier(req: SupplierRequest):
    res = add_supplier(req.name, req.contact, req.rating, req.reliability_score, req.lead_time_days)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.get("/api/vendors/search")
def api_search_vendors(query: str, location: str = "Karachi"):
    # Dual-Mode Google Places TextSearch simulation / API call
    import os
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if api_key:
        try:
            import requests
            url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={query}+wholesale+{location}&key={api_key}"
            res = requests.get(url).json()
            status = res.get("status")
            
            if status == "OK":
                results = res.get("results", [])[:5]
                vendors = []
                for i, p in enumerate(results):
                    rating = p.get("rating", round(random.uniform(4.0, 4.9), 1))
                    price_val = round(random.uniform(50.0, 500.0), 1)
                    distance_val = round(random.uniform(0.5, 6.0), 1)
                    
                    vendors.append({
                        "id": f"map-{i}",
                        "name": p.get("name"),
                        "address": p.get("formatted_address"),
                        "rating": rating,
                        "distance": f"{distance_val} km",
                        "price": f"Rs {price_val}",
                        "contact": p.get("formatted_phone_number", f"+92-300-{random.randint(1000000, 9999999)}"),
                        "reliability_score": round(90.0 - distance_val * 2 + rating * 2, 1)
                    })
                return {"status": "success", "vendors": vendors}
            else:
                print(f"[Supplier API] Google Places API returned non-OK status: {status}")
                if "error_message" in res:
                    print(f"[Supplier API] Error Details: {res['error_message']}")
        except Exception as e:
            print(f"[Supplier API] Live API request failed with exception: {e}")
            
    # Try 100% Free OpenStreetMap Nominatim API fallback before mocking
    osm_vendors = []
    try:
        import requests
        headers = {"User-Agent": "OpsifyERP/1.0"}
        search_q = f"{query} {location}"
        url = f"https://nominatim.openstreetmap.org/search?q={search_q}&format=json&limit=5"
        res = requests.get(url, headers=headers, timeout=8).json()
        
        if not res:
            url = f"https://nominatim.openstreetmap.org/search?q={query}+Karachi&format=json&limit=5"
            res = requests.get(url, headers=headers, timeout=8).json()
            
        for i, item in enumerate(res):
            rating = round(random.uniform(4.0, 4.9), 1)
            price_val = round(random.uniform(50.0, 500.0), 1)
            distance_val = round(random.uniform(0.5, 6.0), 1)
            
            display_name = item.get("display_name", f"{query.title()} Wholesaler")
            parts = [p.strip() for p in display_name.split(",")]
            name = parts[0]
            if len(parts) > 1 and len(name) < 10:
                name = f"{name} ({parts[1]})"
                
            osm_vendors.append({
                "id": f"osm-{i}",
                "name": name,
                "address": display_name[:120] + ("..." if len(display_name) > 120 else ""),
                "rating": rating,
                "distance": f"{distance_val} km",
                "price": f"Rs {price_val}",
                "contact": f"+92-300-{random.randint(1000000, 9999999)}",
                "reliability_score": round(90.0 - distance_val * 2 + rating * 2, 1)
            })
    except Exception as e:
        print(f"[Supplier API] OSM Nominatim search failed: {e}")
        
    if osm_vendors:
        return {"status": "success", "vendors": osm_vendors}
            
    # Mock data generator for DHA/Clifton/Gulshan
    keywords = query.lower()
    product_type = "Distributor"
    if "milk" in keywords or "dairy" in keywords:
        category = "Dairy"
        item = "Milk"
        unit = "liter"
        prefixes = ["Sindh Farms Milk", "National Dairy", "Pak-Arab Wholesalers", "Karachi Fresh Milk", "Premium Farms Wholesalers"]
        price_base = 100.0
    elif "wire" in keywords or "metal" in keywords or "copper" in keywords:
        category = "Hardware"
        item = "Wire"
        unit = "meter"
        prefixes = ["Pakistan Cables Bulk", "Gulshan Electric Wholesalers", "DHA Copper Mills", "Karachi Hardware Traders", "Indus Metal Hub"]
        price_base = 30.0
    elif "pipe" in keywords or "pvc" in keywords:
        category = "Hardware"
        item = "Pipe"
        unit = "piece"
        prefixes = ["Indus PVC Pipes", "Karachi Plumbing Wholesalers", "Standard Fitting Co.", "Clifton Hardware Hub", "Super Pipe Wholesalers"]
        price_base = 80.0
    elif "bread" in keywords or "bakery" in keywords:
        category = "Bakery"
        item = "Bread"
        unit = "loaf"
        prefixes = ["BakeHouse Wholesalers", "National Bread Co.", "Standard Grain Bakery", "Premium Flour Wholesalers", "Karachi Loaf Distributors"]
        price_base = 40.0
    else:
        category = "General"
        item = "Goods"
        unit = "unit"
        prefixes = [f"Karachi {query.title()} Traders", f"{location} {query.title()} Co.", f"Sindh Wholesale {query.title()}", f"Prime {query.title()} Wholesalers", f"Apex {query.title()} Distributors"]
        price_base = 150.0

    vendors = []
    # Seed randomized locations and prices for exactly 5 vendors
    random.seed(len(keywords) + len(location)) # Stable seed for query
    for i, prefix in enumerate(prefixes[:5]):
        rating = round(random.uniform(4.0, 5.0), 1)
        price_val = round(price_base * random.uniform(0.85, 1.15), 1)
        distance_val = round(random.uniform(0.5, 5.0), 1)
        
        vendors.append({
            "id": f"map-{i}",
            "name": prefix,
            "address": f"Plot {random.randint(10, 250)}, Block {random.randint(1, 9)}, {location}, Karachi",
            "rating": rating,
            "distance": f"{distance_val} km",
            "price": f"Rs {price_val}/{unit}",
            "contact": f"+92-321-{random.randint(1000000, 9999999)}",
            "reliability_score": round(100.0 - (distance_val * 3) - (i * 2), 1)
        })

    return {"status": "success", "vendors": vendors}


@router.get("/api/products")
def api_get_products():
    return get_products()


@router.post("/api/products/add")
def api_add_product(req: ProductRequest):
    qty = req.initial_stock if req.initial_stock is not None else (req.stock if req.stock is not None else 0.0)
    res = add_product(
        sku=req.sku,
        name=req.name,
        category=req.category or "",
        variant=req.variant or "",
        unit=req.unit or "units",
        cost_price=req.cost_price,
        selling_price=req.selling_price,
        supplier_id=req.supplier_id,
        warehouse_id=req.warehouse_id or 1,
        initial_stock=qty,
        reorder_threshold=req.reorder_threshold or 0.0
    )
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.post("/api/transactions/sale")
def api_record_sale(req: TransactionRequest):
    res = record_sale(req.product_id, req.warehouse_id, req.quantity, req.value)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.post("/api/procurement/suggest")
def api_procurement_suggest(req: ProcurementSuggestRequest):
    from agents.bidding_agent import generate_procurement_suggestions
    suggestions = generate_procurement_suggestions(req.product_name, req.lat, req.lng)
    return {"suggestions": suggestions}


@router.post("/api/chat")
async def api_chat(req: ChatRequest):
    from agents.chat_agent import run_chat
    from company_brain.ops_chat import save_chat_conversation, append_chat_messages
    # Normalize incoming messages
    msgs = [{"role": m.role, "content": m.content, "timestamp": None} for m in req.messages]

    # Attempt to capture a user identifier from headers (optional)
    # If the client provides X-User-Id header, include it in the saved conversation.
    # Otherwise we'll persist the conversation without a user_id.
    # Prefer explicit user_id in request payload
    user_id = req.user_id if getattr(req, 'user_id', None) else None

    # Persist the incoming user messages as a new conversation document
    chat_doc_id = None
    try:
        chat_doc_id = save_chat_conversation(msgs, user_id=user_id, session_id=None)
    except Exception as e:
        # Log but continue; chat should still work even if saving fails
        print(f"[OpsChat] Failed to save incoming conversation: {e}")

    # Run the chat agent
    result = run_chat(msgs)

    # Persist the assistant response to the same conversation doc if available
    try:
        assistant_text = result.get("text") if isinstance(result, dict) else None
        if assistant_text and chat_doc_id:
            append_chat_messages(chat_doc_id, [{"role": "assistant", "content": assistant_text, "timestamp": None}])
    except Exception as e:
        print(f"[OpsChat] Failed to append assistant message: {e}")

    return result


@router.post("/api/procurement/approve")
async def api_procurement_approve(req: ProcurementApproveRequest):
    vendor = req.vendor
    name = vendor.get("name", "Unknown Supplier")
    
    # Check if supplier exists, else add them
    sups = get_suppliers()
    sup_id = None
    for s in sups:
        if s["name"] == name:
            sup_id = s["id"]
            break
            
    if not sup_id:
        res = add_supplier(
            name=name,
            contact=vendor.get("contact", ""),
            rating=vendor.get("rating", 4.0),
            reliability_score=vendor.get("reliability_score", 80.0),
            lead_time_days=vendor.get("lead_time_days", 1)
        )
        if res["status"] == "error":
            raise HTTPException(status_code=400, detail=res["message"])
        sup_id = res.get("supplier_id", 1)
        
    # Parse price
    price_str = str(vendor.get("price", "0"))
    try:
        price_val = float(''.join(c for c in price_str if c.isdigit() or c == '.'))
    except ValueError:
        price_val = 100.0
        
    total_value = price_val * req.quantity
    
    res = record_restock(req.product_id, req.warehouse_id, req.quantity, total_value)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
        
    await broker.publish("SYSTEM_LOG", "ProcurementEngine", {
        "message": f"Manual Procurement Approved: Restocked {req.quantity} units from {name} for Rs {total_value}."
    })
    
    return {"status": "success", "message": "Procurement approved and stock updated."}


@router.post("/api/transactions/restock")
def api_record_restock(req: TransactionRequest):
    res = record_restock(req.product_id, req.warehouse_id, req.quantity, req.value)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.post("/api/transactions/adjustment")
def api_record_adjustment(req: AdjustmentRequest):
    res = record_adjustment(req.product_id, req.warehouse_id, req.quantity_diff, req.reason)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.get("/api/transactions")
def api_get_transactions():
    return get_transactions()


@router.get("/api/inventory/predictions")
def api_get_demand_predictions():
    return get_demand_predictions()


@router.get("/api/inventory/suggestions")
def api_get_reorder_suggestions():
    return get_reorder_suggestions()


@router.get("/api/export/csv")
def api_export_csv():
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["--- INVENTORY & STOCK ---"])
    products = get_products()
    if products:
        writer.writerow(products[0].keys())
        for p in products:
            writer.writerow(p.values())
            
    writer.writerow([])
    writer.writerow(["--- TRANSACTIONS & ORDERS ---"])
    txs = get_transactions()
    if txs:
        writer.writerow(txs[0].keys())
        for t in txs:
            writer.writerow(t.values())
            
    writer.writerow([])
    writer.writerow(["--- SUPPLIERS ---"])
    sups = get_suppliers()
    if sups:
        writer.writerow(sups[0].keys())
        for s in sups:
            writer.writerow(s.values())
            
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=opsify_ledger_export.csv"}
    )


# ── Product CRUD Extensions ──────────────────────────────────────────────────

@router.put("/api/products/{product_id}")
def api_update_product(product_id: int, req: UpdateProductRequest):
    res = update_product(
        product_id=product_id,
        name=req.name,
        category=req.category,
        variant=req.variant,
        unit=req.unit,
        cost_price=req.cost_price,
        selling_price=req.selling_price,
        supplier_id=req.supplier_id,
        reorder_threshold=req.reorder_threshold,
        stock=req.stock,
        warehouse_id=req.warehouse_id,
    )
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.delete("/api/products/{product_id}")
def api_delete_product(product_id: int):
    res = delete_product(product_id)
    if res["status"] == "error":
        raise HTTPException(status_code=404, detail=res["message"])
    return res


# ── Supplier CRUD Extensions ─────────────────────────────────────────────────

@router.put("/api/suppliers/{supplier_id}")
def api_update_supplier(supplier_id: int, req: UpdateSupplierRequest):
    res = update_supplier(
        supplier_id=supplier_id,
        name=req.name,
        contact=req.contact,
        rating=req.rating,
        reliability_score=req.reliability_score,
        lead_time_days=req.lead_time_days,
    )
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.delete("/api/suppliers/all")
def api_delete_all_suppliers():
    res = delete_all_suppliers()
    return res


@router.delete("/api/suppliers/{supplier_id}")
def api_delete_supplier(supplier_id: int):
    res = delete_supplier(supplier_id)
    if res["status"] == "error":
        raise HTTPException(status_code=404, detail=res["message"])
    return res


# ── Orders CRUD ──────────────────────────────────────────────────────────────

@router.get("/api/orders")
def api_get_orders():
    return get_orders()


@router.post("/api/orders/add")
def api_add_order(req: OrderRequest):
    import uuid
    order_ref = req.order_ref or f"ORD-{uuid.uuid4().hex[:6].upper()}"
    total = req.total_value if req.total_value is not None else req.quantity * req.unit_price
    res = add_order(
        order_ref=order_ref,
        customer_name=req.customer_name,
        product_id=req.product_id,
        warehouse_id=req.warehouse_id,
        quantity=req.quantity,
        unit_price=req.unit_price,
        total_value=total,
    )
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.put("/api/orders/{order_id}/status")
def api_update_order_status(order_id: int, req: OrderStatusRequest):
    res = update_order_status(order_id, req.status)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.delete("/api/orders/{order_id}")
def api_delete_order(order_id: int):
    res = delete_order(order_id)
    if res["status"] == "error":
        raise HTTPException(status_code=404, detail=res["message"])
    return res


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/api/analytics/profit")
def api_get_profit_summary():
    return get_profit_summary()
