import sys, os, tempfile
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import company_brain.inventory as inv
inv.DB_PATH = tempfile.mktemp(suffix=".db")

from company_brain.inventory import init_db, get_demand_predictions, get_reorder_suggestions

init_db()

preds = get_demand_predictions()
print(f"Demand Predictions: {len(preds)} items")
for p in preds:
    name = p["name"]
    wh = p["warehouse_name"]
    v = p["daily_velocity"]
    t = p["trend"]
    c = p["confidence"]
    m = p["forecast_model"]
    print(f"  {name} ({wh}): velocity={v} trend={t} confidence={c} model={m}")

assert len(preds) > 0, "No predictions"
assert all("trend" in p for p in preds), "Missing trend"
assert all("confidence" in p for p in preds), "Missing confidence"

sugs = get_reorder_suggestions()
print(f"Reorder Suggestions: {len(sugs)} items")
for s in sugs:
    u = s["urgency"]
    pn = s["product_name"]
    q = s["suggested_reorder_qty"]
    dsr = s["days_of_stock_remaining"]
    print(f"  [{u}] {pn} - suggest {q} units, {dsr} days remaining")

# Urgency sort check (CRITICAL should come before MEDIUM if present)
urgency_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
assert all(
    urgency_order.get(sugs[i]["urgency"], 99) <= urgency_order.get(sugs[i+1]["urgency"], 99)
    for i in range(len(sugs)-1)
), "Suggestions not sorted by urgency"

os.unlink(inv.DB_PATH)
print("=== SES FORECAST TEST PASSED ===")
