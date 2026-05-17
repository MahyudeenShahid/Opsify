from orchestrator.state import OpsifyState
from tools.booking import simulate_booking
import json

def action_simulation_node(state: OpsifyState) -> OpsifyState:
    """
    Agent 4: Action Simulation Agent
    Executes the booking in the real world (or simulated API).
    """
    if state["execution_status"] == "FAILED":
        return state
        
    state["agent_trace_logs"].append("[Action Agent] Initiating booking...")
    state["execution_status"] = "BOOKING"
    
    provider = state.get("selected_provider", {})
    if not provider:
        state["execution_status"] = "FAILED"
        return state
        
    intent = state.get("extracted_intent", {})
    time = intent.get("time", "ASAP")
    
    state["agent_trace_logs"].append(f"[Tool: booking.py] Calling simulate_booking(provider_id='{provider['id']}', time='{time}')")
    result = simulate_booking(provider["id"], time, intent)
    
    state["execution_status"] = "BOOKED"
    state["agent_trace_logs"].append(f"[Action Agent] Booking confirmed! ID: {result['booking_id']}")
    
    return state
