from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from firebase_store import get_firestore_client, utc_now


JOBS_COLLECTION = "dispatch_jobs"
RIDERS_COLLECTION = "dispatch_riders"


def _client():
    return get_firestore_client()


def _collection(name: str):
    return _client().collection(name)


def _doc_data(doc_snap) -> Dict[str, Any]:
    data = doc_snap.to_dict() or {}
    data.setdefault("job_id", doc_snap.id)
    return data


def sync_rider_pool(rider_pool: list) -> None:
    for rider in rider_pool:
        ref = _collection(RIDERS_COLLECTION).document(rider["id"])
        snap = ref.get()
        status = snap.to_dict().get("status", "AVAILABLE") if snap.exists else "AVAILABLE"
        ref.set({
            **rider,
            "status": status,
            "updated_at": utc_now().isoformat(),
        }, merge=True)


def get_rider_statuses() -> dict:
    rows = _collection(RIDERS_COLLECTION).stream()
    return {row.id: (row.to_dict() or {}).get("status", "AVAILABLE") for row in rows}


def set_rider_status(rider_id: str, status: str) -> None:
    _collection(RIDERS_COLLECTION).document(rider_id).set({
        "status": status,
        "updated_at": utc_now().isoformat(),
    }, merge=True)


def create_job_record(job: Dict[str, Any]) -> Dict[str, Any]:
    _collection(JOBS_COLLECTION).document(job["job_id"]).set(job)
    return job


def save_job_record(job: Dict[str, Any]) -> Dict[str, Any]:
    _collection(JOBS_COLLECTION).document(job["job_id"]).set(job, merge=True)
    return job


def get_job_record(job_id: str) -> Optional[Dict[str, Any]]:
    snap = _collection(JOBS_COLLECTION).document(job_id).get()
    return _doc_data(snap) if snap.exists else None


def list_job_records() -> List[Dict[str, Any]]:
    rows = [_doc_data(doc) for doc in _collection(JOBS_COLLECTION).stream()]
    rows.sort(key=lambda item: str(item.get("created_at", "")), reverse=True)
    return rows
