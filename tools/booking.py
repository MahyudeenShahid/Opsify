import uuid
from typing import Dict, Any

def simulate_booking(provider_id: str, time: str, intent_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool for the Action Simulation Agent to execute a booking.
    """
    # Simulate API call to provider's app or SMS gateway
    booking_id = f"BKG-{uuid.uuid4().hex[:6].upper()}"
    
    return {
        "status": "success",
        "booking_id": booking_id,
        "provider_id": provider_id,
        "scheduled_time": time,
        "details": intent_data,
        "message": f"Provider has been notified and confirmed for {time}."
    }
