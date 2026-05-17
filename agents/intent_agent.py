import json
from orchestrator.state import OpsifyState

def linguistic_intent_node(state: OpsifyState) -> OpsifyState:
    """
    Agent 1: Linguistic Intent Agent
    Parses natural language (English/Urdu/Roman) into structured intent.
    In a real app, this calls an LLM (e.g., OpenAI or Gemini).
    Here we simulate the LLM extraction logic.
    """
    state["agent_trace_logs"].append("[Intent Agent] Parsing input for intent...")
    state["execution_status"] = "PARSING_INTENT"
    
    raw = state["raw_input"].lower()
    
    # Mock LLM Extraction
    intent = {
        "category": "Unknown",
        "quantity": "1",
        "time": "ASAP",
        "location": "Unknown"
    }
    
    # Simple heuristics to mock LLM behavior
    if "electrician" in raw or "bijli" in raw or "wire" in raw:
        intent["category"] = "Electrician"
    elif "plumber" in raw or "pani" in raw or "pipe" in raw or "leak" in raw:
        intent["category"] = "Plumber"
    elif "ac" in raw or "cooling" in raw:
        intent["category"] = "AC Technician"
    elif "doodh" in raw or "milk" in raw:
        intent["category"] = "Milk"
        
    if "kal" in raw or "tomorrow" in raw:
        intent["time"] = "Tomorrow"
    if "kilo" in raw or "kg" in raw:
        # crude extraction
        intent["quantity"] = "2kg" if "2" in raw else "1kg"
        
    if "gulshan" in raw:
        intent["location"] = "Gulshan"
    elif "dha" in raw or "defence" in raw:
        intent["location"] = "DHA"
    elif "clifton" in raw:
        intent["location"] = "Clifton"
        
    state["extracted_intent"] = intent
    state["agent_trace_logs"].append(f"[Intent Agent] Extracted Intent: {json.dumps(intent)}")
    
    return state
