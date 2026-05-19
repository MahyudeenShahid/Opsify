from typing import Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from action_brain.geo import compute_route, nearest_depot, zone_to_coords, DEPOTS, ZONE_COORDS
from action_brain.riders import allocate_rider, get_all_riders
from action_brain.state_machine import create_job, advance_job, get_job, list_jobs

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────────────────────────
class DispatchRequest(BaseModel):
    order_id:       str
    destination:    str           # Zone name e.g. "Clifton"
    item:           str
    customer_name:  str
    customer_phone: str

class RouteRequest(BaseModel):
    origin_lat:  float
    origin_lng:  float
    dest_lat:    float
    dest_lng:    float


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/api/action/zones")
def api_list_zones():
    """Return all known zone names and their GPS coordinates."""
    return {"zones": [{"name": k, "lat": v[0], "lng": v[1]} for k, v in ZONE_COORDS.items()]}


@router.get("/api/action/depots")
def api_list_depots():
    """Return all depot hubs."""
    return {"depots": list(DEPOTS.values())}


@router.post("/api/action/route")
def api_compute_route(req: RouteRequest):
    """Compute live OSRM road-network route between two GPS points."""
    result = compute_route(req.origin_lat, req.origin_lng, req.dest_lat, req.dest_lng)
    return result


@router.get("/api/action/nearest-depot")
def api_nearest_depot(lat: float, lng: float):
    """Find the nearest Opsify depot hub to a GPS coordinate."""
    return nearest_depot(lat, lng)


@router.get("/api/action/riders")
def api_list_riders():
    """List all registered riders in the system."""
    return get_all_riders()


@router.post("/api/action/dispatch")
def api_dispatch_job(req: DispatchRequest):
    """
    Full dispatch pipeline:
    1. Resolve destination zone to GPS.
    2. Allocate nearest available rider via real OSRM ETA.
    3. Create a job in DISPATCHED state.
    Returns full job + route details.
    """
    try:
        rider = allocate_rider(req.destination)
        if "error" in rider:
            raise HTTPException(status_code=503, detail=rider["error"])

        route = rider["route"]
        job = create_job(
            order_id       = req.order_id,
            rider          = rider,
            destination    = req.destination,
            route          = route,
            item           = req.item,
            customer_name  = req.customer_name,
            customer_phone = req.customer_phone,
        )
        return {"status": "success", "job": job}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/action/jobs/{job_id}/advance")
def api_advance_job(job_id: str):
    """Advance a job to the next state in the pipeline."""
    result = advance_job(job_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/api/action/jobs/{job_id}")
def api_get_job(job_id: str):
    """Fetch a specific job by ID."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
    return job


@router.get("/api/action/jobs")
def api_list_jobs():
    """List all active dispatch jobs."""
    return list_jobs()
