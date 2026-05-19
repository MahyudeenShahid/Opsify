import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tools.database import query_mock_provider_db


print("=== Zone Search Tests ===")

# Exact zone
r = query_mock_provider_db("DHA", "Plumber")
print(f"Plumber/DHA: {len(r)} results - first={r[0]['name']} zone={r[0]['zone_match']}")
assert len(r) > 0, "Expected results"

# Adjacent zone fallback (Malir has no providers, should get DHA/Clifton adjacency)
r = query_mock_provider_db("Malir", "Electrician")
print(f"Electrician/Malir (adjacent fallback): {len(r)} results - first={r[0]['name']} zone={r[0]['zone_match']}")
assert len(r) > 0, "Expected adjacent results"
assert r[0]["zone_match"].lower() != "malir", "Expected fallback, not exact"

# Urdu category alias
r = query_mock_provider_db("Gulshan", "doodh")
print(f"doodh/Gulshan (alias->Milk): {len(r)} results - cat={r[0]['category']}")
assert r[0]["category"] == "Milk", "Category alias failed"

# Unknown zone city-wide fallback
r = query_mock_provider_db("Unknown", "Carpenter")
print(f"Carpenter/Unknown: {len(r)} results")
assert len(r) > 0, "Expected city-wide fallback"

# Sorting: highest rating first
r = query_mock_provider_db("Clifton", "Plumber")
ratings = [x["rating"] for x in r]
print(f"Best Plumber/Clifton: {r[0]['name']} rating={r[0]['rating']} zone={r[0]['zone_match']}")
assert ratings == sorted(ratings, reverse=True), "Results not sorted by rating"

print("=== ALL TESTS PASSED ===")
