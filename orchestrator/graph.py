from orchestrator.state import OpsifyState, get_initial_state
from agents.intent_agent import linguistic_intent_node
from agents.matching_agent import hyperlocal_matching_node
from agents.ranking_agent import decision_ranking_node
from agents.simulation_agent import action_simulation_node

class AntigravityGraph:
    """
    A lightweight State-Graph Orchestrator (similar to LangGraph).
    Executes the nodes sequentially and maintains the Blackboard State.
    """
    def __init__(self):
        # Define the linear execution pipeline for System 1 (Customer Brain)
        self.pipeline = [
            linguistic_intent_node,
            hyperlocal_matching_node,
            decision_ranking_node,
            action_simulation_node
        ]
        
    def run(self, user_message: str) -> OpsifyState:
        # Initialize the Blackboard State
        state = get_initial_state(user_message)
        
        # Execute each agent node in the pipeline
        for node in self.pipeline:
            # If a node failed or finished early, we can halt
            if state["execution_status"] == "FAILED":
                state["agent_trace_logs"].append("[Orchestrator] Graph execution halted due to failure.")
                break
                
            state = node(state)
            
        state["agent_trace_logs"].append(f"[Orchestrator] Final Status: {state['execution_status']}")
        return state
