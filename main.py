from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from orchestrator.graph import AntigravityGraph
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Opsify AI Orchestrator API")

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
    
@app.get("/")
def read_root():
    return {"status": "Opsify Antigravity Engine is running."}

@app.post("/api/orchestrate", response_model=OrderResponse)
def orchestrate_order(req: OrderRequest):
    try:
        # Execute the Antigravity Graph
        final_state = graph.run(req.message)
        
        return OrderResponse(
            execution_status=final_state["execution_status"],
            trace_logs=final_state["agent_trace_logs"],
            intent=final_state["extracted_intent"],
            provider=final_state.get("selected_provider", {})
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Run the server locally on port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
