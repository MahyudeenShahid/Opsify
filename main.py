import asyncio
import os
import random
from dotenv import load_dotenv
load_dotenv()  # Load .env file FIRST before any os.environ.get() calls

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Any

from orchestrator.graph import AntigravityGraph
from company_brain.graph import CompanyBrainGraph
from broker.event_broker import broker

from company_brain.inventory import (
    init_db,
    get_suppliers,
    add_supplier,
    add_product,
    get_products,
    record_sale,
    record_restock,
    record_adjustment,
    get_transactions,
    get_demand_predictions,
    get_reorder_suggestions,
    get_warehouses
)
from company_brain.sheets_sync import sync_inventory_to_sheets

app = FastAPI(title="Opsify AI Orchestrator API", version="2.0.0")

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-API-Key"],
)

customer_graph = AntigravityGraph()
company_graph = CompanyBrainGraph()

# ── API Key Authentication ────────────────────────────────────────────────────
_OPSIFY_API_KEY = os.environ.get("OPSIFY_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

UNPROTECTED_PATHS = {"/", "/docs", "/redoc", "/openapi.json", "/ws/events"}

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    """Require X-API-Key header on all non-public endpoints when OPSIFY_API_KEY is configured."""
    if not _OPSIFY_API_KEY or request.url.path in UNPROTECTED_PATHS or request.url.path.startswith("/docs"):
        return await call_next(request)
    key = request.headers.get("X-API-Key", "")
    if key != _OPSIFY_API_KEY:
        return JSONResponse(status_code=403, content={"detail": "Invalid or missing X-API-Key header."})
    return await call_next(request)

class OrderRequest(BaseModel):
    message: str

class OrderResponse(BaseModel):
    execution_status: str
    trace_logs: list[str]
    intent: dict
    provider: dict

class EventPayload(BaseModel):
    event_type: str
    payload: dict

class SupplierRequest(BaseModel):
    name: str
    contact: str
    rating: float
    reliability_score: float
    lead_time_days: int

class ProductRequest(BaseModel):
    sku: str
    name: str
    category: str
    variant: str
    unit: str
    cost_price: float
    selling_price: float
    supplier_id: int
    warehouse_id: int
    initial_stock: float
    reorder_threshold: float

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

@app.get("/")
def read_root():
    return {"status": "Opsify Antigravity Engine is running."}

# --- EVENT BROKER WEBSOCKETS ---
@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    await broker.connect(websocket)
    try:
        while True:
            await websocket.receive_text() # Keep connection alive
    except WebSocketDisconnect:
        broker.disconnect(websocket)

@app.post("/api/events/publish")
async def publish_event(req: EventPayload):
    await broker.publish(req.event_type, "External", req.payload)
    
    # Autonomous Listener: If a customer order is booked, the Company Brain takes over.
    if req.event_type == "CUSTOMER_ORDER_BOOKED":
        # Use model_dump_json() for Pydantic v2 compatibility (fallback to json() for v1)
        try:
            payload_str = req.model_dump_json()
        except AttributeError:
            payload_str = req.json()
        asyncio.create_task(company_graph.run(payload_str))
        
    return {"status": "published"}

# --- SYSTEM 1 (CUSTOMER BRAIN) ---
@app.post("/api/orchestrate", response_model=OrderResponse)
async def orchestrate_order(req: OrderRequest):
    try:
        final_state = customer_graph.run(req.message)
        
        if final_state["execution_status"] == "BOOKED":
            intent = final_state.get("extracted_intent", {})
            cat = intent.get("category", "")
            
            if cat in ["Milk", "Wire", "Pipe", "Bread"]:
                qty_str = intent.get("quantity", "1")
                try:
                    qty = float(''.join(c for c in qty_str if c.isdigit() or c == '.'))
                except ValueError:
                    qty = 1.0
                    
                price = float(final_state["selected_provider"].get("price_per_hr", 150.0)) * qty
                
                # Emit to Event Broker to let System 2 handle the ledger/bidding!
                event = EventPayload(
                    event_type="CUSTOMER_ORDER_BOOKED",
                    payload={
                        "order_id": f"ORD-{int(asyncio.get_event_loop().time())}",
                        "item": cat,
                        "quantity": qty,
                        "total_value": price,
                        "provider_id": "System 1 Auth",
                        "warehouse_id": 1 # Defaulting to Warehouse 1
                    }
                )
                await publish_event(event)
        
        return OrderResponse(
            execution_status=final_state["execution_status"],
            trace_logs=final_state["agent_trace_logs"],
            intent=final_state["extracted_intent"],
            provider=final_state.get("selected_provider", {})
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- SYSTEM 2 (COMPANY BRAIN INVENTORY REST API) ---
@app.get("/api/warehouses")
def api_get_warehouses():
    return get_warehouses()

@app.get("/api/suppliers")
def api_get_suppliers():
    return get_suppliers()

@app.post("/api/suppliers/add")
def api_add_supplier(req: SupplierRequest):
    res = add_supplier(req.name, req.contact, req.rating, req.reliability_score, req.lead_time_days)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

# (random already imported at top)

@app.get("/api/vendors/search")
def api_search_vendors(query: str, location: str = "Karachi"):
    # Dual-Mode Google Places TextSearch simulation / API call
    import os
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if api_key:
        try:
            import requests
            url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={query}+wholesale+{location}&key={api_key}"
            res = requests.get(url).json()
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
        except Exception as e:
            pass
            
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

@app.get("/api/products")
def api_get_products():
    return get_products()

@app.post("/api/products/add")
def api_add_product(req: ProductRequest):
    res = add_product(req.sku, req.name, req.category, req.variant, req.unit, req.cost_price, req.selling_price, req.supplier_id, req.warehouse_id, req.initial_stock, req.reorder_threshold)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.post("/api/transactions/sale")
def api_record_sale(req: TransactionRequest):
    res = record_sale(req.product_id, req.warehouse_id, req.quantity, req.value)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.post("/api/transactions/restock")
def api_record_restock(req: TransactionRequest):
    res = record_restock(req.product_id, req.warehouse_id, req.quantity, req.value)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.post("/api/transactions/adjustment")
def api_record_adjustment(req: AdjustmentRequest):
    res = record_adjustment(req.product_id, req.warehouse_id, req.quantity_diff, req.reason)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.get("/api/transactions")
def api_get_transactions():
    return get_transactions()

@app.get("/api/inventory/predictions")
def api_get_demand_predictions():
    return get_demand_predictions()

@app.get("/api/inventory/suggestions")
def api_get_reorder_suggestions():
    return get_reorder_suggestions()

@app.post("/api/sheets/sync")
def api_sync_sheets():
    return sync_inventory_to_sheets()

# --- SYSTEM 1 AGENTIC KIT ---
from agents.chat_scan_agent import scan_chats_for_incomplete_orders

class ChatMessage(BaseModel):
    text: str

class ChatUser(BaseModel):
    name: str

class ChatPayloadItem(BaseModel):
    id: str
    users: List[ChatUser] = []
    messages: List[ChatMessage] = []

@app.post("/api/agents/scan-chats")
def api_scan_chats(req: List[ChatPayloadItem]):
    try:
        # Convert Pydantic models to plain dicts for the agent
        raw = [item.model_dump() if hasattr(item, 'model_dump') else item.dict() for item in req]
        return scan_chats_for_incomplete_orders(raw)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# --- SYSTEM 3 (ACTION BRAIN — LIVE GEOLOCATION ENGINE) ---
# ============================================================
from action_brain.geo import compute_route, nearest_depot, zone_to_coords, DEPOTS, ZONE_COORDS
from action_brain.riders import allocate_rider, get_all_riders
from action_brain.state_machine import create_job, advance_job, get_job, list_jobs

class DispatchRequest(BaseModel):
    order_id:       str
    destination:    str           # Zone name e.g. "Clifton"
    item:           str
    customer_name:  str
    customer_phone: str

class RouteRequest(BaseModel):
    origin_lat:  float
    origin_lng:  float
    dest_lat:    float
    dest_lng:    float

@app.get("/api/action/zones")
def api_list_zones():
    """Return all known zone names and their GPS coordinates."""
    return {"zones": [{"name": k, "lat": v[0], "lng": v[1]} for k, v in ZONE_COORDS.items()]}

@app.get("/api/action/depots")
def api_list_depots():
    """Return all depot hubs."""
    return {"depots": list(DEPOTS.values())}

@app.post("/api/action/route")
def api_compute_route(req: RouteRequest):
    """Compute live OSRM road-network route between two GPS points."""
    result = compute_route(req.origin_lat, req.origin_lng, req.dest_lat, req.dest_lng)
    return result

@app.get("/api/action/nearest-depot")
def api_nearest_depot(lat: float, lng: float):
    """Find the nearest Opsify depot hub to a GPS coordinate."""
    return nearest_depot(lat, lng)

@app.get("/api/action/riders")
def api_list_riders():
    """List all registered riders in the system."""
    return get_all_riders()

@app.post("/api/action/dispatch")
def api_dispatch_job(req: DispatchRequest):
    """
    Full dispatch pipeline:
    1. Resolve destination zone to GPS.
    2. Allocate nearest available rider via real OSRM ETA.
    3. Create a job in DISPATCHED state.
    Returns full job + route details.
    """
    try:
        rider = allocate_rider(req.destination)
        if "error" in rider:
            raise HTTPException(status_code=503, detail=rider["error"])

        route = rider["route"]
        job = create_job(
            order_id       = req.order_id,
            rider          = rider,
            destination    = req.destination,
            route          = route,
            item           = req.item,
            customer_name  = req.customer_name,
            customer_phone = req.customer_phone,
        )
        return {"status": "success", "job": job}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/action/jobs/{job_id}/advance")
def api_advance_job(job_id: str):
    """Advance a job to the next state in the pipeline."""
    result = advance_job(job_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@app.get("/api/action/jobs/{job_id}")
def api_get_job(job_id: str):
    """Fetch a specific job by ID."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
    return job

@app.get("/api/action/jobs")
def api_list_jobs():
    """List all active dispatch jobs."""
    return list_jobs()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

