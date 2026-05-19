# File: agents/matching_agent.py
#
# ## Purpose
# Agent 2: Hyperlocal Matching Agent.
# Uses the parsed intent to find matching providers via the expanded zone-aware database.
# Logs match quality (exact / adjacent / city-wide) into the trace terminal.

from orchestrator.state import OpsifyState
from tools.database import query_mock_provider_db
import json


def hyperlocal_matching_node(state: OpsifyState) -> OpsifyState:
    state["agent_trace_logs"].append("[Matching Agent] Searching for providers...")
    state["execution_status"] = "MATCHING"

    intent   = state["extracted_intent"]
    category = intent.get("category", "")
    location = intent.get("location", "Unknown")

    state["agent_trace_logs"].append(
        f"[Tool: database.py] query_mock_provider_db(location='{location}', category='{category}')"
    )

    candidates = query_mock_provider_db(location, category)

    if not candidates:
        state["agent_trace_logs"].append("[Matching Agent] No providers found. Aborting.")
        state["execution_status"] = "FAILED"
        return state

    # Annotate match quality for traceability
    exact    = [c for c in candidates if c.get("zone_match", "").lower() == location.lower()]
    adjacent = [c for c in candidates if c.get("zone_match", "").lower() != location.lower()]

    if exact:
        state["agent_trace_logs"].append(
            f"[Matching Agent] Found {len(exact)} exact-zone match(es) in '{location}', "
            f"{len(adjacent)} from adjacent zones."
        )
    else:
        state["agent_trace_logs"].append(
            f"[Matching Agent] No exact match in '{location}'. "
            f"Expanded to adjacent zones — {len(adjacent)} provider(s) found."
        )

    state["candidate_providers"] = candidates
    state["agent_trace_logs"].append(
        f"[Matching Agent] {len(candidates)} candidate(s) ready for ranking."
    )
    return state
