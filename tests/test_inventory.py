# File: tests/test_inventory.py
#
# ## Purpose
# Validate the SQLite inventory operations, predictive algorithms, and stock deduction logic of System 2.

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from company_brain.inventory import (
    init_db,
    get_suppliers,
    get_products,
    add_supplier,
    add_product,
    record_sale,
    record_restock,
    record_adjustment,
    get_transactions,
    get_demand_predictions,
    get_reorder_suggestions
)

def run_tests():
    print("=" * 60)
    print("STARTING SYSTEM 2: ADVANCED INVENTORY VALIDATION")
    print("=" * 60)

    # 1. Clean previous runs
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'opsify_business.db'))
    if os.path.exists(db_path):
        os.remove(db_path)
        print("Removed old test database.")

    # 2. Init and Seed DB
    init_db()
    print("Database initialized and seeded.")

    # 3. View Suppliers
    print("\nSuppliers:")
    for sup in get_suppliers():
        print(f"  [{sup['id']}] {sup['name']} (Rating: {sup['rating']}, Reliability: {sup['reliability_score']})")

    # 4. View Products
    print("\nInitial Products:")
    for prod in get_products():
        print(f"  [{prod['id']}] {prod['name']} ({prod['variant']}) - Stock: {prod['stock']} {prod['unit']}")

    # 5. Record a Sale
    print("\nExecuting Sale: Selling 10 units of Product ID 1...")
    res = record_sale(1, 10.0, 1500.0) # Selling 10 Milk
    print(f"  Result: {res['status']}, Remaining: {res.get('remaining_stock')}, Warning: {res.get('reorder_warning')}")

    # 6. Record a Restock
    print("\nExecuting Restock: Adding 50 units of Product ID 1...")
    res = record_restock(1, 50.0, 4500.0)
    print(f"  Result: {res['status']}, Remaining: {res.get('remaining_stock')}")

    # 7. Record an Adjustment (Damage)
    print("\nExecuting Adjustment: Lost 2 units of Product ID 1...")
    res = record_adjustment(1, -2.0, "Damaged in transit")
    print(f"  Result: {res['status']}, Remaining: {res.get('remaining_stock')}")

    # 8. View Transactions
    print("\nTransactions Ledger:")
    for tx in get_transactions():
        reason = f" (Reason: {tx['reason']})" if tx['reason'] else ""
        print(f"  [{tx['timestamp']}] {tx['type']}{reason} - {tx['product_name']} | Qty: {tx['quantity']} | Value: {tx['total_value']}")

    # 9. Predictive Engine
    print("\nDemand Predictions (30-day velocity):")
    for pred in get_demand_predictions():
        print(f"  [{pred['product_id']}] {pred['name']}: {pred['daily_velocity']} {pred['unit']}/day -> Stock-out: {pred['estimated_stockout_date']}")

    # 10. Reorder Suggestions
    print("\nAI Reorder Suggestions:")
    for sug in get_reorder_suggestions():
        print(f"  [ALERT] [{sug['urgency']}] {sug['message']}")

if __name__ == "__main__":
    run_tests()
