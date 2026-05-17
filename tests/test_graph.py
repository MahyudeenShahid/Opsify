# File: tests/test_graph.py
#
# ## Purpose
# Test the Opsify Antigravity state-graph pipeline with various multilingual customer inputs.
#
# ## Responsibility
# Validate Phase 1 execution of the Customer Brain orchestrator.
#
# ## Inputs
# Multilingual customer messages.
#
# ## Outputs
# Console display of trace logs, extracted intent, and selected provider.
#
# ## Dependencies
# - orchestrator.graph
#
# ## Notes
# Used for verification and pipeline demonstration.

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from orchestrator.graph import AntigravityGraph
import json

def test_pipeline():
    graph = AntigravityGraph()
    
    # Test cases representing different languages and inputs
    test_cases = [
        "Kal Gulshan mein ek electrician bhej do, wire jal gayi hai.",
        "AC is not cooling properly in Clifton, need an AC technician ASAP.",
        "Pani ka pipe leak ho raha hai DHA mein, plumber chahiye kal.",
        "Need 2kg milk delivered to DHA tomorrow."
    ]
    
    print("=" * 60)
    print("STARTING OPSIFY ANTIGRAVITY PIPELINE VALIDATION")
    print("=" * 60)
    
    for i, case in enumerate(test_cases, 1):
        print(f"\n--- TEST CASE {i}: \"{case}\" ---")
        
        # Execute state graph
        final_state = graph.run(case)
        
        print("\nTrace Logs:")
        for log in final_state["agent_trace_logs"]:
            print(f"  {log}")
            
        print("\nExtracted Intent:")
        print(f"  {json.dumps(final_state['extracted_intent'], indent=2)}")
        
        print("\nExecution Result:")
        print(f"  Status: {final_state['execution_status']}")
        if final_state.get("selected_provider"):
            print(f"  Booked: {final_state['selected_provider'].get('name')} ({final_state['selected_provider'].get('rating')}*)")
            print(f"  Reasoning: {final_state['selected_provider'].get('reasoning_string')}")
        else:
            print("  Booked: None")
            
        print("-" * 60)

if __name__ == "__main__":
    test_pipeline()
