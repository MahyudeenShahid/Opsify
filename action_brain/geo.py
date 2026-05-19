# File: action_brain/geo.py
#
# ## Purpose
# Live geolocation engine for System 3: Action Brain.
# Uses real OSRM (Open Source Routing Machine) public API to compute actual
# road-network routing distances and travel times between two GPS coordinates.
# Falls back to Haversine great-circle approximation if OSRM is unavailable.

import math
import os
import json
from typing import Tuple, Dict, Any, List, Optional

try:
    import requests as _requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    _REQUESTS_AVAILABLE = False

# ---------------------------------------------------------------------------
# Karachi Depot Coordinates (Latitude, Longitude)
# ---------------------------------------------------------------------------
DEPOTS: Dict[str, Dict[str, Any]] = {
    "Gulshan": {
        "name": "Gulshan Depot",
        "lat": 24.9242,
        "lng": 67.0873,
        "zone": ["Gulshan", "North Karachi", "Liaquatabad"],
    },
    "DHA": {
        "name": "DHA / Clifton Depot",
        "lat": 24.8138,
        "lng": 67.0366,
        "zone": ["DHA", "Clifton", "Defence"],
    },
    "Saddar": {
        "name": "Saddar Central Hub",
        "lat": 24.8607,
        "lng": 67.0104,
        "zone": ["Saddar", "Lyari", "Kharadar", "Garden"],
    },
}

# Representative GPS coordinates for service areas
ZONE_COORDS: Dict[str, Tuple[float, float]] = {
    "Gulshan":        (24.9242, 67.0873),
    "Clifton":        (24.8155, 67.0327),
    "DHA":            (24.8138, 67.0366),
    "Defence":        (24.8138, 67.0366),
    "North Karachi":  (24.9749, 67.0599),
    "Liaquatabad":    (24.9008, 67.0508),
    "Saddar":         (24.8607, 67.0104),
    "Lyari":          (24.8680, 67.0023),
    "Kharadar":       (24.8605, 67.0151),
    "Garden":         (24.8669, 67.0197),
    "PECHS":          (24.8626, 67.0591),
    "Nazimabad":      (24.9175, 67.0416),
    "Karachi":        (24.8607, 67.0104),  # default city center
}


# ---------------------------------------------------------------------------
# OSRM Route Engine (Public API — free, no key required)
# ---------------------------------------------------------------------------
OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving"


def _get_osrm_route(
    origin_lat: float, origin_lng: float,
    dest_lat: float,   dest_lng: float,
) -> Optional[Dict[str, Any]]:
    """
    Query OSRM public API for road-network routing.
    Returns a dict with 'distance_m' (meters) and 'duration_s' (seconds),
    or None if the call fails.
    """
    if not _REQUESTS_AVAILABLE:
        return None
    try:
        url = f"{OSRM_BASE_URL}/{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        params = {
            "overview": "false",
            "geometries": "geojson",
            "steps": "false",
        }
        resp = _requests.get(url, params=params, timeout=5)
        data = resp.json()
        if data.get("code") == "Ok" and data.get("routes"):
            route = data["routes"][0]
            return {
                "distance_m":  route["distance"],
                "duration_s":  route["duration"],
                "source":      "OSRM",
            }
    except Exception:
        pass
    return None


def _haversine_distance(
    lat1: float, lng1: float,
    lat2: float, lng2: float,
) -> float:
    """
    Haversine great-circle distance in kilometres.
    """
    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def compute_route(
    origin_lat: float, origin_lng: float,
    dest_lat:   float, dest_lng:   float,
    avg_speed_kmh: float = 25.0,          # Karachi urban average
) -> Dict[str, Any]:
    """
    Compute routing information between two GPS coordinates.
    Tries OSRM first; falls back to Haversine if unavailable.

    Returns:
        {
            "distance_km": float,
            "eta_minutes": float,
            "source": "OSRM" | "Haversine",
            "origin": {"lat": ..., "lng": ...},
            "destination": {"lat": ..., "lng": ...},
        }
    """
    osrm = _get_osrm_route(origin_lat, origin_lng, dest_lat, dest_lng)
    if osrm:
        distance_km = osrm["distance_m"] / 1000.0
        eta_minutes = osrm["duration_s"] / 60.0
        source      = "OSRM (Live Road Network)"
    else:
        distance_km = _haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
        # Urban road factor: real road distance ≈ 1.35× straight-line distance
        distance_km *= 1.35
        eta_minutes = (distance_km / avg_speed_kmh) * 60.0
        source      = "Haversine Fallback"

    return {
        "distance_km":  round(distance_km, 2),
        "eta_minutes":  round(eta_minutes, 1),
        "source":       source,
        "origin":       {"lat": origin_lat, "lng": origin_lng},
        "destination":  {"lat": dest_lat,   "lng": dest_lng},
    }


def zone_to_coords(zone: str) -> Tuple[float, float]:
    """Return GPS (lat, lng) for a named Karachi zone."""
    return ZONE_COORDS.get(zone, ZONE_COORDS["Karachi"])


def nearest_depot(destination_lat: float, destination_lng: float) -> Dict[str, Any]:
    """
    Return the depot with the shortest Haversine distance to the destination.
    """
    best_depot = None
    best_dist  = float("inf")
    for key, depot in DEPOTS.items():
        dist = _haversine_distance(
            depot["lat"], depot["lng"],
            destination_lat, destination_lng,
        )
        if dist < best_dist:
            best_dist  = dist
            best_depot = {**depot, "key": key, "distance_km": round(dist, 2)}
    return best_depot
