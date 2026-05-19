import os
import sys
import pytest
from fastapi.testclient import TestClient

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

client = TestClient(app)

TEST_UID = "test-runner-12345"
API_KEY = os.environ.get("OPSIFY_API_KEY", "")
HEADERS = {
    "X-User-ID": TEST_UID,
    "X-API-Key": API_KEY
}

@pytest.fixture(scope="module", autouse=True)
def setup_test_workspace():
    # Initialize an empty workspace for the test user
    response = client.post("/api/onboarding/init", headers=HEADERS)
    assert response.status_code == 200, "Failed to init test workspace"
    yield
    # No teardown needed as the test user data is isolated

# ─── Suppliers ────────────────────────────────────────────────────────────────
def test_supplier_crud():
    import time
    unique = int(time.time() * 1000)
    # 1. Create
    res = client.post("/api/suppliers/add", json={
        "name": f"Test Supplier {unique}",
        "contact": "Alice",
        "rating": 4.5,
        "reliability_score": 90.0,
        "lead_time_days": 3
    }, headers=HEADERS)
    assert res.status_code == 200, f"Supplier create failed: {res.text}"
    supplier_id = res.json().get("id")
    assert supplier_id is not None

    # 2. Read
    res = client.get("/api/suppliers", headers=HEADERS)
    assert res.status_code == 200
    suppliers = res.json()
    assert any(s["id"] == supplier_id for s in suppliers)

    # 3. Update
    res = client.put(f"/api/suppliers/{supplier_id}", json={
        "contact": "Bob"
    }, headers=HEADERS)
    assert res.status_code == 200
    
    res = client.get("/api/suppliers", headers=HEADERS)
    updated = next(s for s in res.json() if s["id"] == supplier_id)
    assert updated["contact"] == "Bob"

    # 4. Delete
    res = client.delete(f"/api/suppliers/{supplier_id}", headers=HEADERS)
    assert res.status_code == 200

    res = client.get("/api/suppliers", headers=HEADERS)
    assert not any(s["id"] == supplier_id for s in res.json())

# ─── Warehouses ───────────────────────────────────────────────────────────────
def test_warehouse_crud():
    import time
    unique = int(time.time() * 1000)
    # 1. Create
    res = client.post("/api/warehouses/add", json={
        "name": f"Test Warehouse {unique}",
        "location": "Sector 7G"
    }, headers=HEADERS)
    assert res.status_code == 200, f"Warehouse create failed: {res.text}"
    wh_id = res.json().get("id")
    assert wh_id is not None

    # 2. Read
    res = client.get("/api/warehouses", headers=HEADERS)
    assert res.status_code == 200
    warehouses = res.json()
    assert any(w["id"] == wh_id for w in warehouses)

    # 3. Update
    res = client.put(f"/api/warehouses/{wh_id}", json={
        "location": "Sector 8G"
    }, headers=HEADERS)
    assert res.status_code == 200

    res = client.get("/api/warehouses", headers=HEADERS)
    updated = next(w for w in res.json() if w["id"] == wh_id)
    assert updated["location"] == "Sector 8G"

    # 4. Delete
    res = client.delete(f"/api/warehouses/{wh_id}", headers=HEADERS)
    assert res.status_code == 200

    res = client.get("/api/warehouses", headers=HEADERS)
    assert not any(w["id"] == wh_id for w in res.json())

# ─── Products & Stock ─────────────────────────────────────────────────────────
def test_product_crud():
    import time
    ts = int(time.time() * 1000)
    # Setup Warehouse for the product
    wh_res = client.post("/api/warehouses/add", json={"name": f"Prod WH {ts}", "location": "NY"}, headers=HEADERS)
    assert wh_res.status_code == 200, f"Warehouse create failed: {wh_res.text}"
    wh_id = wh_res.json()["id"]

    # 1. Create
    res = client.post("/api/products/add", json={
        "name": "Test Widget",
        "sku": f"TW-{ts}",
        "unit": "pcs",
        "cost_price": 10.0,
        "selling_price": 20.0,
        "warehouse_id": wh_id,
        "stock": 50.0,
        "reorder_threshold": 10.0
    }, headers=HEADERS)
    assert res.status_code == 200
    prod_id = res.json().get("id")
    assert prod_id is not None

    # 2. Read
    res = client.get("/api/products", headers=HEADERS)
    assert res.status_code == 200
    products = res.json()
    assert any(p["id"] == prod_id for p in products)

    # 3. Update
    res = client.put(f"/api/products/{prod_id}", json={
        "selling_price": 25.0
    }, headers=HEADERS)
    assert res.status_code == 200

    res = client.get("/api/products", headers=HEADERS)
    updated = next(p for p in res.json() if p["id"] == prod_id)
    assert updated["selling_price"] == 25.0

    # 4. Delete
    res = client.delete(f"/api/products/{prod_id}", headers=HEADERS)
    assert res.status_code == 200

    res = client.get("/api/products", headers=HEADERS)
    assert not any(p["id"] == prod_id for p in res.json())

# ─── Orders & Transactions ────────────────────────────────────────────────────
def test_orders_and_transactions():
    import time
    ts = int(time.time() * 1000)
    # Setup Warehouse & Product
    wh_res = client.post("/api/warehouses/add", json={"name": f"Order WH {ts}", "location": "TX"}, headers=HEADERS)
    assert wh_res.status_code == 200, f"Warehouse create failed: {wh_res.text}"
    wh_id = wh_res.json()["id"]
    prod_res = client.post("/api/products/add", json={
        "name": "Order Widget",
        "sku": f"OW-{ts}",
        "unit": "pcs",
        "warehouse_id": wh_id,
        "stock": 100.0,
        "reorder_threshold": 10.0,
        "cost_price": 5.0,
        "selling_price": 15.0
    }, headers=HEADERS)
    assert prod_res.status_code == 200, f"Failed to create product: {prod_res.text}"
    prod_id = prod_res.json()["id"]

    # 1. Add Order
    res = client.post("/api/orders/add", json={
        "customer_name": "Test Customer",
        "product_id": prod_id,
        "warehouse_id": wh_id,
        "quantity": 5.0,
        "unit_price": 15.0
    }, headers=HEADERS)
    assert res.status_code == 200
    order_id = res.json().get("id")
    assert order_id is not None

    # Verify Order in list
    res = client.get("/api/orders", headers=HEADERS)
    assert res.status_code == 200
    orders = res.json()
    created_order = next((o for o in orders if o["id"] == order_id), None)
    assert created_order is not None
    assert created_order["status"] == "PENDING"

    # 2. Update Order Status
    res = client.put(f"/api/orders/{order_id}/status", json={"status": "PACKED"}, headers=HEADERS)
    assert res.status_code == 200

    res = client.get("/api/orders", headers=HEADERS)
    updated_order = next(o for o in res.json() if o["id"] == order_id)
    assert updated_order["status"] == "PACKED"

    # 3. Dispatch Order
    res = client.post(f"/api/orders/{order_id}/dispatch", json={
        "courier_name": "SpeedyX",
        "courier_phone": "555-0199"
    }, headers=HEADERS)
    assert res.status_code == 200

    res = client.get("/api/orders", headers=HEADERS)
    dispatched_order = next(o for o in res.json() if o["id"] == order_id)
    assert dispatched_order["status"] == "DISPATCHED"
    assert dispatched_order["courier_name"] == "SpeedyX"

    # 4. Record Sale Transaction
    res = client.post("/api/transactions/sale", json={
        "product_id": prod_id,
        "warehouse_id": wh_id,
        "quantity": 10.0,
        "value": 150.0
    }, headers=HEADERS)
    assert res.status_code == 200
    
    # 5. Record Restock Transaction
    res = client.post("/api/transactions/restock", json={
        "product_id": prod_id,
        "warehouse_id": wh_id,
        "quantity": 20.0,
        "value": 100.0
    }, headers=HEADERS)
    assert res.status_code == 200

    # 6. Verify Transactions in Activity Log / Transactions
    res = client.get("/api/transactions", headers=HEADERS)
    assert res.status_code == 200
    transactions = res.json()
    assert len(transactions) >= 2
    types = [t["type"] for t in transactions]
    assert "SALE" in types
    assert "RESTOCK" in types

    # 7. Delete Order
    res = client.delete(f"/api/orders/{order_id}", headers=HEADERS)
    assert res.status_code == 200
