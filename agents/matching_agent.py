from orchestrator.state import OpsifyState
from tools.database import query_mock_provider_db
import json

def hyperlocal_matching_node(state: OpsifyState) -> OpsifyState:
    """
    Agent 2: Hyperlocal Matching Agent
    Uses the parsed intent to find matching providers in the database via a Tool.
    """
    state["agent_trace_logs"].append("[Matching Agent] Searching for providers...")
    state["execution_status"] = "MATCHING"
    
    intent = state["extracted_intent"]
    category = intent.get("category", "")
    location = intent.get("location", "")
    
    # Using the tool
    state["agent_trace_logs"].append(f"[Tool: database.py] Calling query_mock_provider_db(location='{location}', category='{category}')")
    
    candidates = query_mock_provider_db(location, category)
    
    state["candidate_providers"] = candidates
    state["agent_trace_logs"].append(f"[Matching Agent] Found {len(candidates)} candidates.")
    
    return state
