# File: action_brain/riders.py
#
# ## Purpose
# Rider pool management: regional allocation, zone matching, and DB-backed availability.

from typing import List, Dict, Any, Optional
from action_brain.geo import zone_to_coords, compute_route
from action_brain.firestore_db import sync_rider_pool, get_rider_statuses

# ---------------------------------------------------------------------------
# Rider Registry (source of truth for static attributes)
# Availability status is read from the DB at runtime.
# ---------------------------------------------------------------------------
RIDER_POOL: List[Dict[str, Any]] = [
    # --- Gulshan Depot ---
    {"id": "R001", "name": "Hamza Shah",      "phone": "+92-321-1234567", "depot": "Gulshan", "lat": 24.9242, "lng": 67.0873, "vehicle": "Bike",  "rating": 4.8},
    {"id": "R002", "name": "Faisal Khan",     "phone": "+92-333-9876543", "depot": "Gulshan", "lat": 24.9300, "lng": 67.0920, "vehicle": "Bike",  "rating": 4.6},
    # --- DHA Depot ---
    {"id": "R003", "name": "Zubair Ahmed",    "phone": "+92-300-4561234", "depot": "DHA",     "lat": 24.8138, "lng": 67.0366, "vehicle": "Van",   "rating": 4.9},
    {"id": "R004", "name": "Saad Mirza",      "phone": "+92-345-7890123", "depot": "DHA",     "lat": 24.8200, "lng": 67.0400, "vehicle": "Bike",  "rating": 4.5},
    # --- Saddar Hub ---
    {"id": "R005", "name": "Kashif Hussain",  "phone": "+92-312-3456789", "depot": "Saddar",  "lat": 24.8607, "lng": 67.0104, "vehicle": "Bike",  "rating": 4.7},
    {"id": "R006", "name": "Usman Farooq",    "phone": "+92-322-6543210", "depot": "Saddar",  "lat": 24.8650, "lng": 67.0200, "vehicle": "Van",   "rating": 4.4},
]

# Sync is deferred to first real call to avoid blocking startup / test imports
_riders_synced = False

def _ensure_synced():
    global _riders_synced
    if not _riders_synced:
        try:
            sync_rider_pool(RIDER_POOL)
            _riders_synced = True
        except Exception:
            pass  # Fail silently if Firestore unavailable at startup



def allocate_rider(destination_zone: str) -> Dict[str, Any]:
    """
    Find the best AVAILABLE rider nearest to the destination zone.
    1. Check DB for which riders are currently AVAILABLE.
    2. Compute OSRM route from each available rider to the destination.
    3. Rank by lowest ETA and return the winner.
    """
    _ensure_synced()
    dest_lat, dest_lng = zone_to_coords(destination_zone)

    # Refresh availability from DB
    statuses = get_rider_statuses()

    candidates = []
    for rider in RIDER_POOL:
        if statuses.get(rider["id"], "AVAILABLE") != "AVAILABLE":
            continue
        route = compute_route(rider["lat"], rider["lng"], dest_lat, dest_lng)
        candidates.append({**rider, "status": "AVAILABLE", "route": route})

    if not candidates:
        return {"error": "No available riders at this time. All riders are currently on active jobs."}

    # Best rider = shortest ETA
    best = min(candidates, key=lambda r: r["route"]["eta_minutes"])
    return best


def get_all_riders() -> List[Dict[str, Any]]:
    """Return all riders with current DB status attached."""
    _ensure_synced()
    statuses = get_rider_statuses()
    return [{**r, "status": statuses.get(r["id"], "AVAILABLE")} for r in RIDER_POOL]


def get_rider_by_id(rider_id: str) -> Optional[Dict[str, Any]]:
    statuses = get_rider_statuses()
    rider = next((r for r in RIDER_POOL if r["id"] == rider_id), None)
    if rider:
        return {**rider, "status": statuses.get(rider_id, "AVAILABLE")}
    return None
