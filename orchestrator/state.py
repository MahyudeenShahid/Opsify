from typing import TypedDict, List, Dict, Any

class OpsifyState(TypedDict):
    """
    The central Blackboard state passed between Antigravity agents.
    """
    # System 1: Interaction & Order Intelligence
    raw_input: str
    extracted_intent: Dict[str, Any]  # e.g., {"category": str, "location": str, "time": str, "quantity": str}
    candidate_providers: List[Dict[str, Any]]
    selected_provider: Dict[str, Any]
    
    # Execution Tracking
    agent_trace_logs: List[str]  # UI Requirement: Stores thoughts and tool usage
    execution_status: str        # Current status e.g., "PENDING", "PARSED", "MATCHED", "BOOKED", "FAILED"
    
    # (Future) System 2 & 3 extensions can be added here
    # e.g., inventory_status, delivery_route, etc.

def get_initial_state(user_message: str) -> OpsifyState:
    """Helper to initialize the state."""
    return {
        "raw_input": user_message,
        "extracted_intent": {},
        "candidate_providers": [],
        "selected_provider": {},
        "agent_trace_logs": [f"[SYSTEM] Initialized state with input: '{user_message}'"],
        "execution_status": "PENDING"
    }
