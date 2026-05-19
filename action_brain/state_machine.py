# File: action_brain/state_machine.py
#
# ## Purpose
# Job State Machine: manages the lifecycle of a dispatched job through 5 sequential states.
# Each transition records a precise UTC timestamp.

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

# In-memory job store (would use Redis / DB in production)
_JOBS: Dict[str, Dict[str, Any]] = {}

JOB_STATES = [
    "DISPATCHED",
    "EN_ROUTE",
    "ARRIVED",
    "JOB_STARTED",
    "JOB_COMPLETED",
]


def create_job(
    order_id:       str,
    rider:          Dict[str, Any],
    destination:    str,
    route:          Dict[str, Any],
    item:           str,
    customer_name:  str,
    customer_phone: str,
) -> Dict[str, Any]:
    """
    Create a new dispatch job and initialise it at DISPATCHED state.
    """
    job_id = f"JOB-{uuid.uuid4().hex[:6].upper()}"
    now    = datetime.now(timezone.utc).isoformat()

    job = {
        "job_id":           job_id,
        "order_id":         order_id,
        "rider_id":         rider["id"],
        "rider_name":       rider["name"],
        "rider_phone":      rider["phone"],
        "rider_vehicle":    rider["vehicle"],
        "rider_rating":     rider["rating"],
        "destination_zone": destination,
        "item":             item,
        "customer_name":    customer_name,
        "customer_phone":   customer_phone,
        "route":            route,
        "status":           "DISPATCHED",
        "status_index":     0,
        "timeline":         [{"state": "DISPATCHED", "timestamp": now}],
        "created_at":       now,
        "updated_at":       now,
    }
    _JOBS[job_id] = job
    return job


def advance_job(job_id: str) -> Dict[str, Any]:
    """
    Advance a job to the next state in the state machine pipeline.
    Returns the updated job or an error dict.
    """
    job = _JOBS.get(job_id)
    if not job:
        return {"error": f"Job {job_id} not found."}

    current_idx = job["status_index"]
    if current_idx >= len(JOB_STATES) - 1:
        return {"error": f"Job {job_id} is already COMPLETED.", "job": job}

    next_idx    = current_idx + 1
    next_status = JOB_STATES[next_idx]
    now         = datetime.now(timezone.utc).isoformat()

    job["status"]       = next_status
    job["status_index"] = next_idx
    job["updated_at"]   = now
    job["timeline"].append({"state": next_status, "timestamp": now})

    return job


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    return _JOBS.get(job_id)


def list_jobs() -> List[Dict[str, Any]]:
    return list(_JOBS.values())
