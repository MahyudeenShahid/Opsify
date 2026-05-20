import asyncio
import os
from dotenv import load_dotenv
load_dotenv()  # Load .env file FIRST before any os.environ.get() calls

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from broker.event_broker import broker
from company_brain.firestore_inventory import init_db
from company_brain.graph import CompanyBrainGraph

app = FastAPI(title="Opsify AI Orchestrator API", version="2.0.0")

# Initialize database tables
init_db()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-API-Key"],
)

# ── API Key Authentication Middleware ─────────────────────────────────────────
_OPSIFY_API_KEY = os.environ.get("OPSIFY_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Paths exempt from authentication
UNPROTECTED_PATHS = {"/", "/docs", "/redoc", "/openapi.json", "/ws/events", "/api/map/render", "/api/petrol/price", "/api/export/csv", "/favicon.ico"}

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    """Require X-API-Key header on all non-public endpoints when OPSIFY_API_KEY is configured."""
    # Allow CORS preflight requests (OPTIONS method) and unprotected paths
    if request.method == "OPTIONS" or not _OPSIFY_API_KEY or request.url.path in UNPROTECTED_PATHS or "api/map/render" in request.url.path or "api/petrol/price" in request.url.path or request.url.path.startswith("/docs"):
        return await call_next(request)
    key = request.headers.get("X-API-Key", "")
    if key != _OPSIFY_API_KEY:
        return JSONResponse(status_code=403, content={"detail": "Invalid or missing X-API-Key header."})
    return await call_next(request)


# ── Schemas ──────────────────────────────────────────────────────────────────
class EventPayload(BaseModel):
    event_type: str
    payload: dict


# ── Root Info Endpoint ────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"status": "Opsify Antigravity Engine is running."}


# ── Event Broker & WebSockets ────────────────────────────────────────────────
@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    await broker.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        broker.disconnect(websocket)


async def auto_dispatch_s3(payload: dict):
    """Helper to automatically trigger System 3 dispatch in the background."""
    try:
        from action_brain.riders import allocate_rider
        from action_brain.state_machine import create_job

        order_id = payload.get("order_id")
        destination = payload.get("customer_zone", "Clifton")
        item = payload.get("item", "General")
        customer_name = payload.get("customer_name", "Autonomous Client")
        customer_phone = payload.get("customer_phone", "+92-300-8271039")

        await broker.publish("SYSTEM_LOG", "ActionBrain", {
            "message": f"S2→S3 Auto-Trigger: BUSINESS_DISPATCH_CONFIRMED for {order_id}. Allocating rider to {destination}..."
        })

        rider = allocate_rider(destination)
        if "error" in rider:
            await broker.publish("SYSTEM_LOG", "ActionBrain", {
                "message": f"Auto-dispatch failed: {rider['error']}"
            })
            return

        route = rider["route"]
        job = create_job(
            order_id=order_id,
            rider=rider,
            destination=destination,
            route=route,
            item=item,
            customer_name=customer_name,
            customer_phone=customer_phone
        )
        
        await broker.publish("SYSTEM_LOG", "ActionBrain", {
            "message": f"Auto-dispatched Rider {job['rider_name']} ({job['rider_vehicle']}) for Order {order_id}. Job ID: {job['job_id']}. ETA: {int(route.get('eta_minutes', 0))} min."
        })
    except Exception as e:
        await broker.publish("SYSTEM_LOG", "ActionBrain", {
            "message": f"Auto-dispatch exception: {str(e)}"
        })


@app.post("/api/events/publish")
async def publish_event(req: EventPayload):
    """Publish arbitrary events externally and trigger autonomous listeners."""
    await broker.publish(req.event_type, "External", req.payload)
    
    # Autonomous Listener: If a customer order is booked, the Company Brain takes over.
    if req.event_type == "CUSTOMER_ORDER_BOOKED":
        company_graph = CompanyBrainGraph()
        try:
            payload_str = req.model_dump_json()
        except AttributeError:
            payload_str = req.json()
        asyncio.create_task(company_graph.run(payload_str))
        
    # S2 -> S3 Auto-Trigger
    if req.event_type == "BUSINESS_DISPATCH_CONFIRMED":
        payload = req.payload
        if payload.get("dispatch_status") == "READY":
            asyncio.create_task(auto_dispatch_s3(payload))
        
    return {"status": "published"}


# ── Include Sub-Routers ───────────────────────────────────────────────────────
from routers.orchestrator import router as orchestrator_router
from routers.company import router as company_router
from routers.action import router as action_router
from routers.agri import router as agri_router

app.include_router(orchestrator_router)
app.include_router(company_router)
app.include_router(action_router)
app.include_router(agri_router)


# ── Startup Execution ────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
