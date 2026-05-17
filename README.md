# Opsify 🚀
**AI Service Orchestrator for the Informal Economy**

Opsify is an advanced, AI-native orchestrator designed to streamline operations for the informal economy (electricians, plumbers, AC technicians, etc.). Built on a Blackboard/State-Graph "Antigravity" architecture, it acts as a digital manager that runs the business 24/7.

## The 3 Brains of Opsify (Systems)

Opsify is architected into 3 interconnected "Brains" (Systems). We are building **System 1** first for the hackathon MVP, laying the groundwork to easily snap in Systems 2 and 3.

### 1. 📥 Interaction & Order Intelligence System ("Customer Brain" Layer)
**Status: In Progress**

This system handles everything coming from customers, turning messy human communication into clean business data.
- **What it does:**
  - Reads WhatsApp, Facebook, SMS messages.
  - Understands Urdu, Roman Urdu, English.
  - Processes voice notes into text (Future integration).
  - Detects buying intent automatically and extracts structured order data.
- **Example Flow:**
  - *Customer:* "Kal 2 kilo doodh bhej dena"
  - *AI Extraction:* Product: Milk | Quantity: 2kg | Delivery: Tomorrow
  - *Output:* Creates order ticket, sends confirmation, updates dashboard.

### 2. 📦 Business Operations System ("Company Brain" Layer)
**Status: Planned (Phase 2)**

This is the core decision-making engine that runs the business like a human manager (but faster and 24/7).
- **What it does:**
  - **Inventory Intelligence:** Tracks stock, predicts shortages, identifies fast-selling items.
  - **Procurement Engine:** Finds suppliers, compares prices, auto-orders when safe.
  - **Business Analytics:** Generates sales reports, profit tracking, demand forecasting.

### 3. 🚚 Logistics & Execution System ("Action Brain" Layer)
**Status: Planned (Phase 3)**

This system turns AI decisions into real-world action.
- **What it does:**
  - **Delivery Optimization:** Groups nearby orders, creates routes, assigns riders.
  - **Customer Communication:** Sends ETAs, confirms orders, shares receipts.
  - **Workflow Execution:** Executes procurement orders, updates stock after delivery.

---

## 🛠️ Architecture (Antigravity State-Graph)

We use a State-Graph (Blackboard) architecture. The central `OmniState` (the Blackboard) is passed between highly specialized Agent nodes.

### Current Pipeline (Customer Brain)
1. **Linguistic Intent Agent:** Parses multi-lingual text into structured JSON.
2. **Hyperlocal Matching Agent:** Queries the provider database for available technicians.
3. **Decision & Ranking Agent:** Evaluates providers and selects the best one with reasoning.
4. **Action Simulation Agent:** Books the selected provider.

### Project Layout
```
opsify/
├── main.py                       # FastAPI entry point
├── orchestrator/                 # Graph definitions and State schema
├── agents/                       # AI Agent nodes
├── tools/                        # Tools used by agents (DB queries, booking)
└── systems/                      # The 3 Brains (Phased approach)
```
