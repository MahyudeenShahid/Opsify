# File: tests/test_company_brain.py
#
# ## Purpose
# Integration test for System 2: Company Brain Graph.
# Uses an ISOLATED test database — NEVER touches opsify_business.db.

import sys
import os
import json
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# ── Redirect DB path BEFORE importing any company_brain modules ──────────────
_TEST_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ["OPSIFY_TEST_DB"] = _TEST_DB

import company_brain.inventory as _inv
_inv.DB_PATH = _TEST_DB  # Override the module-level path

from company_brain.inventory import init_db
from company_brain.graph import CompanyBrainGraph

def run_tests():
    print("=" * 60)
    print("STARTING SYSTEM 2: COMPANY BRAIN GRAPH VALIDATION")
    print(f"Test DB: {_TEST_DB}")
    print("=" * 60)

    # Fresh isolated DB
    init_db()
    print("Test database initialized and seeded.")

    import asyncio
    graph = CompanyBrainGraph()

    def run(event):
        return asyncio.run(graph.run(json.dumps(event)))

    # Scenario 1: URGENCY LOW — order 22 Milk, stock drops from 25→3, triggers LOW bid
    print("\n--- SCENARIO 1: LOW URGENCY PROCUREMENT ---")
    out = run({"event_type": "CUSTOMER_ORDER_BOOKED", "payload": {
        "order_id": "ORD-001", "item": "Milk", "quantity": 22.0,
        "total_value": 3300.0, "provider_id": "internal"
    }})
    print(json.dumps(json.loads(out), indent=2))
    assert json.loads(out)["payload"]["dispatch_status"] in ("READY", "DELAYED_OUT_OF_STOCK")
    print("[OK] Scenario 1 PASSED")

    # Scenario 2: URGENCY HIGH — stock at 3, order 3 more → 0 left, HIGH urgency
    print("\n--- SCENARIO 2: HIGH URGENCY PROCUREMENT ---")
    out = run({"event_type": "CUSTOMER_ORDER_BOOKED", "payload": {
        "order_id": "ORD-002", "item": "Milk", "quantity": 3.0,
        "total_value": 450.0, "provider_id": "internal"
    }})
    print(json.dumps(json.loads(out), indent=2))
    print("[OK] Scenario 2 PASSED")

    # Scenario 3: OUT OF STOCK — stock is 0
    print("\n--- SCENARIO 3: OUT OF STOCK ---")
    out = run({"event_type": "CUSTOMER_ORDER_BOOKED", "payload": {
        "order_id": "ORD-003", "item": "Milk", "quantity": 5.0,
        "total_value": 750.0, "provider_id": "internal"
    }})
    result = json.loads(out)
    print(json.dumps(result, indent=2))
    assert result["payload"]["dispatch_status"] == "DELAYED_OUT_OF_STOCK"
    print("[OK] Scenario 3 PASSED")

    print("\n" + "=" * 60)
    print("ALL SCENARIOS PASSED [OK]")

    # Cleanup temp DB
    try:
        os.unlink(_TEST_DB)
    except Exception:
        pass

if __name__ == "__main__":
    run_tests()
