# File: action_brain/riders.py
#
# ## Purpose
# Rider pool management: regional allocation, zone matching, and availability.

from typing import List, Dict, Any, Optional
from action_brain.geo import DEPOTS, zone_to_coords, nearest_depot, compute_route

# ---------------------------------------------------------------------------
# Rider Registry (simulates real courier dispatch DB)
# ---------------------------------------------------------------------------
RIDER_POOL: List[Dict[str, Any]] = [
    # --- Gulshan Depot ---
    {"id": "R001", "name": "Hamza Shah",      "phone": "+92-321-1234567", "depot": "Gulshan", "lat": 24.9242, "lng": 67.0873, "status": "AVAILABLE", "vehicle": "Bike",  "rating": 4.8},
    {"id": "R002", "name": "Faisal Khan",     "phone": "+92-333-9876543", "depot": "Gulshan", "lat": 24.9300, "lng": 67.0920, "status": "AVAILABLE", "vehicle": "Bike",  "rating": 4.6},
    # --- DHA Depot ---
    {"id": "R003", "name": "Zubair Ahmed",    "phone": "+92-300-4561234", "depot": "DHA",     "lat": 24.8138, "lng": 67.0366, "status": "AVAILABLE", "vehicle": "Van",   "rating": 4.9},
    {"id": "R004", "name": "Saad Mirza",      "phone": "+92-345-7890123", "depot": "DHA",     "lat": 24.8200, "lng": 67.0400, "status": "AVAILABLE", "vehicle": "Bike",  "rating": 4.5},
    # --- Saddar Hub ---
    {"id": "R005", "name": "Kashif Hussain",  "phone": "+92-312-3456789", "depot": "Saddar",  "lat": 24.8607, "lng": 67.0104, "status": "AVAILABLE", "vehicle": "Bike",  "rating": 4.7},
    {"id": "R006", "name": "Usman Farooq",    "phone": "+92-322-6543210", "depot": "Saddar",  "lat": 24.8650, "lng": 67.0200, "status": "AVAILABLE", "vehicle": "Van",   "rating": 4.4},
]


def allocate_rider(
    destination_zone: str,
) -> Dict[str, Any]:
    """
    Find the best available rider nearest to the destination zone.
    1. Resolve destination zone to GPS.
    2. Compute road route from each available rider to the destination.
    3. Rank by lowest ETA and pick the winner.
    Returns rider info + route details.
    """
    dest_lat, dest_lng = zone_to_coords(destination_zone)

    candidates = []
    for rider in RIDER_POOL:
        if rider["status"] != "AVAILABLE":
            continue
        route = compute_route(
            rider["lat"], rider["lng"],
            dest_lat,     dest_lng,
        )
        candidates.append({**rider, "route": route})

    if not candidates:
        return {"error": "No available riders at this time."}

    # Best rider = shortest ETA
    best = min(candidates, key=lambda r: r["route"]["eta_minutes"])
    return best


def get_all_riders() -> List[Dict[str, Any]]:
    return RIDER_POOL


def get_rider_by_id(rider_id: str) -> Optional[Dict[str, Any]]:
    return next((r for r in RIDER_POOL if r["id"] == rider_id), None)
