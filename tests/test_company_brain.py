import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from company_brain.inventory import init_db
from company_brain.graph import CompanyBrainGraph

def run_tests():
    print("=" * 60)
    print("STARTING SYSTEM 2: COMPANY BRAIN GRAPH VALIDATION")
    print("=" * 60)

    # 1. Clean previous runs
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'opsify_business.db'))
    if os.path.exists(db_path):
        os.remove(db_path)
        print("Removed old test database.")

    # 2. Init DB
    init_db()
    print("Database initialized and seeded with multiple competing suppliers.")

    graph = CompanyBrainGraph()

    # Scenario 1: URGENCY LOW (Plenty of stock remaining, but triggers reorder threshold)
    # Milk initial stock = 25. Threshold = 5.
    # Let's order 22 units. Stock goes to 3. 
    # Since 3 units will last a while based on slow velocity, urgency = LOW.
    # Should pick "Discount Depot" (cheapest).
    
    event_low_urgency = {
        "event_type": "CUSTOMER_ORDER_BOOKED",
        "payload": {
            "order_id": "ORD-001",
            "item": "Milk",
            "quantity": 22.0,
            "total_value": 3300.0,
            "provider_id": "internal"
        }
    }
    
    print("\n--- SCENARIO 1: LOW URGENCY PROCUREMENT ---")
    out_1 = graph.run(json.dumps(event_low_urgency))
    parsed_1 = json.loads(out_1)
    print("Output JSON Event:")
    print(json.dumps(parsed_1, indent=2))
    
    # Scenario 2: URGENCY HIGH
    # Let's order more Milk so stock drops to 0.
    # Days remaining will be 0. Urgency HIGH.
    # Should pick "Speedy Supply" (fastest).
    
    event_high_urgency = {
        "event_type": "CUSTOMER_ORDER_BOOKED",
        "payload": {
            "order_id": "ORD-002",
            "item": "Milk",
            "quantity": 3.0,
            "total_value": 450.0,
            "provider_id": "internal"
        }
    }
    
    print("\n--- SCENARIO 2: HIGH URGENCY PROCUREMENT ---")
    out_2 = graph.run(json.dumps(event_high_urgency))
    parsed_2 = json.loads(out_2)
    print("Output JSON Event:")
    print(json.dumps(parsed_2, indent=2))
    
    # Scenario 3: OUT OF STOCK
    # Order more Milk. Stock is now 0.
    # Should return DELAYED_OUT_OF_STOCK
    
    event_out_of_stock = {
        "event_type": "CUSTOMER_ORDER_BOOKED",
        "payload": {
            "order_id": "ORD-003",
            "item": "Milk",
            "quantity": 5.0,
            "total_value": 750.0,
            "provider_id": "internal"
        }
    }
    
    print("\n--- SCENARIO 3: OUT OF STOCK FAILURE ---")
    out_3 = graph.run(json.dumps(event_out_of_stock))
    parsed_3 = json.loads(out_3)
    print("Output JSON Event:")
    print(json.dumps(parsed_3, indent=2))

if __name__ == "__main__":
    run_tests()
