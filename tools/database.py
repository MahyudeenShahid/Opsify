import random
from typing import List, Dict, Any

# Mock Database for Hackathon
MOCK_PROVIDERS = [
    {"id": "p1", "name": "Ali Electrician", "category": "Electrician", "location": "Gulshan", "rating": 4.8, "price_per_hr": 1000},
    {"id": "p2", "name": "Bilal AC Tech", "category": "AC Technician", "location": "Clifton", "rating": 4.5, "price_per_hr": 1500},
    {"id": "p3", "name": "Zain Plumber", "category": "Plumber", "location": "DHA", "rating": 4.9, "price_per_hr": 1200},
    {"id": "p4", "name": "Kamran Electrician", "category": "Electrician", "location": "DHA", "rating": 4.2, "price_per_hr": 800},
    {"id": "p5", "name": "Dairy Farm Delivery", "category": "Milk", "location": "Gulshan", "rating": 4.7, "price_per_hr": 300},
]

def query_mock_provider_db(location: str, category: str) -> List[Dict[str, Any]]:
    """
    Tool for the Hyperlocal Matching Agent to find available providers.
    """
    results = []
    # Case insensitive basic search
    for provider in MOCK_PROVIDERS:
        if category.lower() in provider["category"].lower():
            # In a real app, we'd do geospatial radius search. 
            # Here we just loosely check location string or return if we lack exact location match.
            results.append(provider)
            
    # Mocking availability check delay or logic
    return results
