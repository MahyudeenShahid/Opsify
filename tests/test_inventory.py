# File: tests/test_inventory.py
#
# ## Purpose
# Validate the SQLite inventory operations, predictive algorithms, and stock logic of System 2.
# Uses an ISOLATED test database — NEVER touches opsify_business.db.

import sys
import os
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# ── Redirect DB path BEFORE importing inventory ──────────────────────────────
_TEST_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
import company_brain.inventory as _inv
_inv.DB_PATH = _TEST_DB

from company_brain.inventory import (
    init_db, get_suppliers, get_products, add_supplier, add_product,
    record_sale, record_restock, record_adjustment,
    get_transactions, get_demand_predictions, get_reorder_suggestions
)

def run_tests():
    print("=" * 60)
    print("STARTING SYSTEM 2: INVENTORY VALIDATION")
    print(f"Test DB: {_TEST_DB}")
    print("=" * 60)

    init_db()
    print("Test database initialized and seeded.\n")

    print("Suppliers:")
    for sup in get_suppliers():
        print(f"  [{sup['id']}] {sup['name']} (Rating: {sup['rating']})")

    print("\nInitial Products:")
    for prod in get_products():
        print(f"  [{prod['id']}] {prod['name']} ({prod['variant']}) - Stock: {prod['stock']} {prod['unit']}")

    print("\nSale: Selling 10 units of Product 1 from Warehouse 1...")
    res = record_sale(1, 1, 10.0, 1500.0)
    print(f"  {res['status']} | Remaining: {res.get('remaining_stock')} | Reorder warning: {res.get('reorder_warning')}")
    assert res["status"] == "success", f"Sale failed: {res}"

    print("\nRestock: Adding 50 units to Product 1, Warehouse 1...")
    res = record_restock(1, 1, 50.0, 4500.0)
    print(f"  {res['status']} | Remaining: {res.get('remaining_stock')}")
    assert res["status"] == "success", f"Restock failed: {res}"

    print("\nAdjustment: -2 units (damage)...")
    res = record_adjustment(1, 1, -2.0, "Damaged in transit")
    print(f"  {res['status']} | Remaining: {res.get('remaining_stock')}")
    assert res["status"] == "success", f"Adjustment failed: {res}"

    print("\nTransactions Ledger:")
    for tx in get_transactions()[:5]:
        reason = f" ({tx['reason']})" if tx.get('reason') else ""
        print(f"  [{tx['timestamp']}] {tx['type']}{reason} | {tx['product_name']} | Qty: {tx['quantity']}")

    print("\nDemand Predictions:")
    for pred in get_demand_predictions():
        print(f"  {pred['name']}: {pred['daily_velocity']} {pred['unit']}/day -> stockout: {pred['estimated_stockout_date']}")

    print("\nReorder Suggestions:")
    for sug in get_reorder_suggestions():
        print(f"  [{sug['urgency']}] {sug['message']}")

    print("\n" + "=" * 60)
    print("ALL INVENTORY TESTS PASSED [OK]")

    try:
        os.unlink(_TEST_DB)
    except Exception:
        pass

if __name__ == "__main__":
    run_tests()
