import asyncio
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from orchestrator.graph import AntigravityGraph
from company_brain.graph import CompanyBrainGraph
from broker.event_broker import broker

from company_brain.inventory import (
    init_db,
    get_suppliers,
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

app = FastAPI(title="Opsify AI Orchestrator API")

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

customer_graph = AntigravityGraph()
company_graph = CompanyBrainGraph()

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
        asyncio.create_task(company_graph.run(req.json()))
        
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
