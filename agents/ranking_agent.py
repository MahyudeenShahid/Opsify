from orchestrator.state import OpsifyState

def decision_ranking_node(state: OpsifyState) -> OpsifyState:
    """
    Agent 3: Decision & Ranking Agent
    Evaluates candidate providers based on business logic/LLM reasoning (rating vs price).
    """
    state["agent_trace_logs"].append("[Ranking Agent] Evaluating candidates...")
    state["execution_status"] = "RANKING"
    
    candidates = state["candidate_providers"]
    
    if not candidates:
        state["agent_trace_logs"].append("[Ranking Agent] No candidates to rank. Aborting.")
        state["execution_status"] = "FAILED"
        return state
        
    # Mock LLM Ranking logic: Prioritize rating, then price
    # Sort by rating descending, then price ascending
    ranked = sorted(candidates, key=lambda x: (-x["rating"], x["price_per_hr"]))
    best_candidate = ranked[0]
    
    reasoning = (f"Selected {best_candidate['name']} ({best_candidate['rating']}*) "
                 f"over other options for best balance of rating and price at Rs {best_candidate['price_per_hr']}/hr.")
    
    state["selected_provider"] = best_candidate
    state["selected_provider"]["reasoning_string"] = reasoning
    state["agent_trace_logs"].append(f"[Ranking Agent] Choice: {reasoning}")
    
    return state
