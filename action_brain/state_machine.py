# File: action_brain/state_machine.py
#
# ## Purpose
# Job State Machine: manages lifecycle of dispatched jobs through 5 sequential states.
# Jobs are persisted to Firestore so they survive server restarts.
# Rider availability is updated atomically with job state transitions.

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from action_brain.firestore_db import (
    create_job_record,
    get_job_record,
    list_job_records,
    save_job_record,
    set_rider_status,
)


JOB_STATES = [
    "DISPATCHED",
    "EN_ROUTE",
    "ARRIVED",
    "JOB_STARTED",
    "JOB_COMPLETED",
]


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    Create a new dispatch job, persist it to Firestore, and mark the rider as BUSY.
    """
    job_id = f"JOB-{uuid.uuid4().hex[:6].upper()}"
    now    = _now_utc()

    timeline = [{"state": "DISPATCHED", "timestamp": now}]

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
        "timeline":         timeline,
        "created_at":       now,
        "updated_at":       now,
    }

    create_job_record(job)
    set_rider_status(rider["id"], "BUSY")

    return job


def advance_job(job_id: str) -> Dict[str, Any]:
    """
    Advance a job to the next state. If JOB_COMPLETED, mark rider FREE.
    """
    row = get_job_record(job_id)
    if not row:
        return {"error": f"Job {job_id} not found."}

    current_idx = row["status_index"]
    if current_idx >= len(JOB_STATES) - 1:
        return {"error": f"Job {job_id} is already COMPLETED.", "job": _row_to_job(row)}

    next_idx    = current_idx + 1
    next_status = JOB_STATES[next_idx]
    now         = _now_utc()

    timeline = list(row.get("timeline", []))
    timeline.append({"state": next_status, "timestamp": now})

    row["status"] = next_status
    row["status_index"] = next_idx
    row["timeline"] = timeline
    row["updated_at"] = now
    save_job_record(row)

    # Free the rider when job is done
    if next_status == "JOB_COMPLETED":
        set_rider_status(row["rider_id"], "AVAILABLE")

    updated = get_job_record(job_id)
    return _row_to_job(updated) if updated else {"error": f"Job {job_id} not found."}


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    row = get_job_record(job_id)
    return _row_to_job(row) if row else None


def list_jobs() -> List[Dict[str, Any]]:
    return [_row_to_job(r) for r in list_job_records()]


def _row_to_job(row) -> Dict[str, Any]:
    if not row:
        return {}
    return {
        "job_id":           row["job_id"],
        "order_id":         row["order_id"],
        "rider_id":         row["rider_id"],
        "rider_name":       row["rider_name"],
        "rider_phone":      row["rider_phone"],
        "rider_vehicle":    row["rider_vehicle"],
        "rider_rating":     row["rider_rating"],
        "destination_zone": row["destination_zone"],
        "item":             row["item"],
        "customer_name":    row["customer_name"],
        "customer_phone":   row["customer_phone"],
        "route":            row.get("route", {}),
        "status":           row["status"],
        "status_index":     row["status_index"],
        "timeline":         row.get("timeline", []),
        "created_at":       row["created_at"],
        "updated_at":       row["updated_at"],
    }
