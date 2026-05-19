# File: action_brain/state_machine.py
#
# ## Purpose
# Job State Machine: manages lifecycle of dispatched jobs through 5 sequential states.
# Jobs are persisted to the SQLite database so they survive server restarts.
# Rider availability is updated atomically with job state transitions.

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from action_brain.db import get_jobs_db


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
    Create a new dispatch job, persist it to SQLite, and mark the rider as BUSY.
    """
    import json
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

    conn = get_jobs_db()
    conn.execute(
        """INSERT INTO jobs
           (job_id, order_id, rider_id, rider_name, rider_phone, rider_vehicle,
            rider_rating, destination_zone, item, customer_name, customer_phone,
            route_json, status, status_index, timeline_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            job["job_id"], job["order_id"], job["rider_id"], job["rider_name"],
            job["rider_phone"], job["rider_vehicle"], job["rider_rating"],
            job["destination_zone"], job["item"], job["customer_name"],
            job["customer_phone"], json.dumps(route), job["status"],
            job["status_index"], json.dumps(timeline), now, now,
        ),
    )
    # Mark rider as BUSY
    conn.execute("UPDATE riders SET status='BUSY' WHERE rider_id=?", (rider["id"],))
    conn.commit()
    conn.close()

    return job


def advance_job(job_id: str) -> Dict[str, Any]:
    """
    Advance a job to the next state. If JOB_COMPLETED, mark rider FREE.
    """
    import json
    conn = get_jobs_db()
    row = conn.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
    if not row:
        conn.close()
        return {"error": f"Job {job_id} not found."}

    current_idx = row["status_index"]
    if current_idx >= len(JOB_STATES) - 1:
        conn.close()
        return {"error": f"Job {job_id} is already COMPLETED.", "job": _row_to_job(row)}

    next_idx    = current_idx + 1
    next_status = JOB_STATES[next_idx]
    now         = _now_utc()

    timeline = json.loads(row["timeline_json"])
    timeline.append({"state": next_status, "timestamp": now})

    conn.execute(
        "UPDATE jobs SET status=?, status_index=?, timeline_json=?, updated_at=? WHERE job_id=?",
        (next_status, next_idx, json.dumps(timeline), now, job_id),
    )

    # Free the rider when job is done
    if next_status == "JOB_COMPLETED":
        conn.execute("UPDATE riders SET status='AVAILABLE' WHERE rider_id=?", (row["rider_id"],))

    conn.commit()

    updated = conn.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
    conn.close()
    return _row_to_job(updated)


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    conn = get_jobs_db()
    row = conn.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
    conn.close()
    return _row_to_job(row) if row else None


def list_jobs() -> List[Dict[str, Any]]:
    conn = get_jobs_db()
    rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC").fetchall()
    conn.close()
    return [_row_to_job(r) for r in rows]


def _row_to_job(row) -> Dict[str, Any]:
    import json
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
        "route":            json.loads(row["route_json"]),
        "status":           row["status"],
        "status_index":     row["status_index"],
        "timeline":         json.loads(row["timeline_json"]),
        "created_at":       row["created_at"],
        "updated_at":       row["updated_at"],
    }
