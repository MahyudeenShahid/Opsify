from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from orchestrator.graph import AntigravityGraph
from fastapi.middleware.cors import CORSMiddleware
from company_brain.inventory import (
    init_db,
    get_suppliers,
    add_supplier,
    get_products,
    add_product,
    record_sale,
    record_restock,
    record_adjustment,
    get_transactions
)

app = FastAPI(title="Opsify AI Orchestrator API")

# Initialize database tables and seed values on start
init_db()

# Allow requests from Flutter app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate our Antigravity State-Graph
graph = AntigravityGraph()

class OrderRequest(BaseModel):
    message: str

class OrderResponse(BaseModel):
    execution_status: str
    trace_logs: list[str]
    intent: dict
    provider: dict

class SupplierRequest(BaseModel):
    name: str
    contact: str
    rating: float
    lead_time_days: int

class ProductRequest(BaseModel):
    sku: str
    name: str
    category: str
    stock: float
    reorder_threshold: float
    cost_price: float
    selling_price: float
    supplier_id: int

class TransactionRequest(BaseModel):
    product_id: int
    quantity: float
    value: float # Revenue for sale, Cost for restock

class AdjustmentRequest(BaseModel):
    product_id: int
    quantity_diff: float

@app.get("/")
def read_root():
    return {"status": "Opsify Antigravity Engine is running."}

# System 1: Text-Based Orchestrator Endpoint
@app.post("/api/orchestrate", response_model=OrderResponse)
def orchestrate_order(req: OrderRequest):
    try:
        final_state = graph.run(req.message)
        
        # Integrate Stock Deductions in Pipeline if booking is successful
        if final_state["execution_status"] == "BOOKED":
            intent = final_state.get("extracted_intent", {})
            cat = intent.get("category", "")
            
            # Simple heuristic for MVP: Match product name to intent category
            if cat in ["Milk", "Wire", "Pipe"]:
                qty_str = intent.get("quantity", "1")
                try:
                    qty = float(''.join(c for c in qty_str if c.isdigit() or c == '.'))
                except ValueError:
                    qty = 1.0
                    
                price = float(final_state["selected_provider"].get("price_per_hr", 150.0)) * qty
                
                # Fetch products to find ID
                products = get_products()
                prod_id = next((p["id"] for p in products if p["name"].lower() == cat.lower()), None)
                if prod_id:
                    record_sale(prod_id, qty, price)
        
        return OrderResponse(
            execution_status=final_state["execution_status"],
            trace_logs=final_state["agent_trace_logs"],
            intent=final_state["extracted_intent"],
            provider=final_state.get("selected_provider", {})
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# System 2: Stock Inventory & Management endpoints
@app.get("/api/suppliers")
def api_get_suppliers():
    return get_suppliers()

@app.post("/api/suppliers/add")
def api_add_supplier(req: SupplierRequest):
    res = add_supplier(req.name, req.contact, req.rating, req.lead_time_days)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.get("/api/products")
def api_get_products():
    return get_products()

@app.post("/api/products/add")
def api_add_product(req: ProductRequest):
    res = add_product(req.sku, req.name, req.category, req.stock, req.reorder_threshold, req.cost_price, req.selling_price, req.supplier_id)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.post("/api/transactions/sale")
def api_record_sale(req: TransactionRequest):
    res = record_sale(req.product_id, req.quantity, req.value)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.post("/api/transactions/restock")
def api_record_restock(req: TransactionRequest):
    res = record_restock(req.product_id, req.quantity, req.value)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.post("/api/transactions/adjustment")
def api_record_adjustment(req: AdjustmentRequest):
    res = record_adjustment(req.product_id, req.quantity_diff)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.get("/api/transactions")
def api_get_transactions():
    return get_transactions()

if __name__ == "__main__":
    import uvicorn
    # Run the server locally on port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
