# 🚀 Opsify Team Development Guide

This guide is designed for the hackathon team to build the **Opsify** platform in parallel. By dividing the system into 3 independent "Brains", each team member can build, test, and debug their system entirely on their own without waiting for others.

---

## 🏗️ Core Principle: API Contracts
To work independently, you don't need the other team member's code to be finished. You only need to agree on the **API Contract** (the JSON format) that passes between your systems.

**The Flow:**
`Customer Brain` ➔ (JSON Order) ➔ `Company Brain` ➔ (JSON Dispatch) ➔ `Action Brain`

---

## 🛠️ Phase 1: Customer Brain (Interaction & Intelligence)
**Goal:** Turn messy WhatsApp/voice messages into a structured order ticket.

### How to build independently:
1. **Focus Area:** NLP, Intent Extraction, Provider Matching.
2. **Setup:** Run your own FastAPI server (`main.py`).
3. **Input:** Raw string (e.g., `"Kal 2 kilo doodh bhej dena"`).
4. **Expected Output (The API Contract):**
```json
{
  "order_id": "ORD-123",
  "category": "Milk",
  "quantity": "2kg",
  "time": "Tomorrow",
  "status": "EXTRACTED"
}
```
### How to test:
- You don't need the frontend or the other brains. Use Postman or `curl` to send text to your local endpoint and ensure it returns the correct JSON.
- **Tools:** Use LangChain/LangGraph, mock LLM calls, and a mock provider database.

---

## 📦 Phase 2: Company Brain (Business Operations)
**Goal:** Track inventory, manage business logic, and auto-procure items.

### How to build independently:
1. **Focus Area:** Inventory logic, Supplier logic, Analytics.
2. **Setup:** Create a new folder `company_brain/` with its own `state.py` and `graph.py`.
3. **Mock the Input:** **DO NOT WAIT** for Phase 1 to finish. Hardcode a mock JSON order (like the one shown in Phase 1) and feed it to your system.
4. **Expected Output (The API Contract):**
```json
{
  "order_id": "ORD-123",
  "inventory_status": "DEDUCTED",
  "dispatch_ready": true,
  "procurement_needed": false
}
```
### How to test:
- Create unit tests that feed fake orders into your Company Brain. 
- Ensure that if an order takes the inventory of Milk below 5 units, your system triggers a "Procurement Needed" flag.

---

## 🚚 Phase 3: Action Brain (Logistics & Execution)
**Goal:** Optimize routes, assign riders, and send customer notifications.

### How to build independently:
1. **Focus Area:** Routing logic, SMS simulation, Provider assignment.
2. **Setup:** Create a new folder `action_brain/` with its own graph.
3. **Mock the Input:** **DO NOT WAIT** for Phase 1 or 2. Hardcode a mock JSON dispatch (like the one shown in Phase 2).
4. **Expected Output:**
```json
{
  "order_id": "ORD-123",
  "rider_assigned": "Ali",
  "eta": "10:30 AM",
  "notification_sent": true
}
```
### How to test:
- Pass a list of 5 fake dispatch orders.
- Verify your graph correctly calculates routes (or assigns providers) and generates the correct "WhatsApp Sent" simulation logs.

---

## 🔗 Phase 4: The Great Merge
Once all 3 brains are working independently:

1. **Create the Master Orchestrator:**
   Create a master `app.py` that imports all 3 graphs.
2. **Chain them together:**
   ```python
   # 1. Customer sends message
   order_intent = customer_brain.run(user_message)
   
   # 2. Pass intent to Company Brain
   inventory_result = company_brain.run(order_intent)
   
   # 3. If ready for dispatch, pass to Action Brain
   if inventory_result["dispatch_ready"]:
       logistics_result = action_brain.run(inventory_result)
   ```
3. **Connect Flutter:**
   Update the Flutter app to display the logs from all 3 brains in real-time as the order flows through the master pipeline.

---

### 💡 Hackathon Tips for the Team
- **Use Mock Tools:** Don't waste time setting up a real Postgres DB yet. Use Python dictionaries in a `mock_db.py` file.
- **Trace Logs:** Make sure every Agent in every Brain appends to a `trace_logs` array. This makes debugging incredibly easy and looks amazing for hackathon demos!
- **Version Control:** Create Git branches for `feature/customer-brain`, `feature/company-brain`, and `feature/action-brain`. Merge into `main` only when your independent system passes tests.
