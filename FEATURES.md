# 🌟 Opsify — Complete Feature Catalogue

> A living reference of every feature across the Opsify platform, organised by System, Module, and Screen. Each entry describes what the feature does, how it works technically, and where to find it in the codebase.

---

## 📑 Index

- [System 1 — Customer Brain](#-system-1--customer-brain)
- [System 2 — Company Brain (ERP)](#-system-2--company-brain-erp)
- [System 3 — Action Brain (Logistics)](#-system-3--action-brain-logistics)
- [OpsBot — AI ERP Assistant](#-opsbot--ai-erp-assistant)
- [OmniChat — Firebase Realtime Messaging](#-omnichat--firebase-realtime-messaging)
- [Agri-Bridge — Agricultural Logistics](#-agri-bridge--agricultural-logistics)
- [Notifications System](#-notifications-system)
- [Authentication & Onboarding](#-authentication--onboarding)
- [Account & Settings](#-account--settings)
- [Mobile App Shell & UX](#-mobile-app-shell--ux)
- [Backend Infrastructure](#-backend-infrastructure)

---

## 🧠 System 1 — Customer Brain

> **Screen:** `CustomerBrainScreen.tsx` · **Backend:** `orchestrator/`, `agents/`, `routers/orchestrator.py`

---

### 1.1 Deep Chat Scanner (AI)

**What it does:** Automatically reads all Firebase OmniChat conversations and uses Gemini AI to detect SALE, RESTOCK, and ADJUSTMENT orders embedded in natural language messages (e.g. "bhai 20kg milk chahiye" → detected as SALE 20kg Milk).

**How it works:**
- Calls `FirebaseChatService.getAllChatsWithMessages()` to pull all messages for the logged-in user
- Sends the full message blocks to `POST /api/agents/deep-scan`
- Backend runs `gemini-2.5-flash-lite` with a structured JSON extraction prompt
- Falls back to keyword-based heuristic scanner if Gemini is unavailable

**File:** `agents/chat_scan_agent.py`, `routers/orchestrator.py`

---

### 1.2 Incremental Scan Cursors

**What it does:** Only scans messages written **since the last scan**, not the full history every time. Makes repeated scans fast even in busy chats.

**How it works:**
- Stores a per-chat cursor (last seen message ID + timestamp) in Firestore `users/{uid}/scan_state/{chat_id}`
- On next scan, filters messages newer than the cursor timestamp
- Marks scans as `(incremental)` in the progress UI

**File:** `agents/chat_scan_agent.py` → `load_scan_cursors()`, `save_scan_cursors()`

---

### 1.3 Order Detection with Confidence Levels

**What it does:** Each detected order carries a machine-confidence score — HIGH, MEDIUM, or LOW — shown as a colour-coded pill on the order card.

| Level | Colour | Meaning |
|---|---|---|
| HIGH | 🟢 Green | Gemini extracted a clear, unambiguous order |
| MEDIUM | 🟡 Yellow | Order detected but phrasing was indirect |
| LOW | 🟠 Orange | Heuristic fallback match; review before approving |

**File:** `agents/chat_scan_agent.py`, `CustomerBrainScreen.tsx` → `CONFIDENCE_CONFIG`

---

### 1.4 Order Approval Workflow

**What it does:** Lets the business owner approve or reject each AI-detected order before it hits the ledger.

**On Approve:**
1. Looks up the matching product in the Firestore inventory by name/SKU (with partial-match fallback)
2. Calls `POST /api/transactions/{sale|restock}` to update stock
3. Calls `POST /api/orders/add` to create a visible ERP order record
4. Deletes the pending order from Firestore `pending_scan_orders`

**On Reject:**
- Saves the order fingerprint (MD5 of chat_id+item+quantity) to `__rejected__` Firestore document
- The order will never be surfaced again in any future scan

**File:** `CustomerBrainScreen.tsx` → `handleApprove()`, `handleReject()`

---

### 1.5 Inline Order Editing

**What it does:** Any AI-detected order can be edited before approval — correct item name, quantity, value, warehouse ID, or transaction type.

**Validation rules:**
- Item name cannot be empty
- Quantity must be a positive number
- Value must be ≥ 0
- Warehouse ID must be a positive integer

**File:** `CustomerBrainScreen.tsx` → `OrderCard` component → `handleSaveClick()`

---

### 1.6 Order Persistence Across Sessions

**What it does:** Detected orders that have neither been approved nor rejected are saved to Firestore and reloaded the next time the app is opened.

**How it works:** `POST /api/agents/deep-scan` saves all new orders to `users/{uid}/pending_scan_orders/{fingerprint}`. On screen mount, `loadPersistedOrders()` calls `GET /api/agents/pending-orders` to restore them.

**File:** `agents/chat_scan_agent.py` → `save_pending_orders()`, `CustomerBrainScreen.tsx` → `loadPersistedOrders()`

---

### 1.7 Scan Progress Visualiser

**What it does:** While a scan is running, shows a per-chat animated progress list — each chat card shows contact name, number of messages scanned, whether it was an incremental or full scan, and a pulsing dot for the active chat.

**File:** `CustomerBrainScreen.tsx` → `ScanProgressItem` component

---

### 1.8 Scan History & Session Log

**What it does:** Every scan run creates a timestamped session record. The user can view all past sessions (date, chats scanned, orders found) and delete individual sessions or clear all history.

**File:** `CustomerBrainScreen.tsx` → session history section, `routers/orchestrator.py` → `DELETE /api/agents/scan-sessions`

---

### 1.9 Cursor Management UI

**What it does:** Shows all chats being tracked (with their cursor positions). User can:
- Reset a single chat's cursor → next scan will fully re-read that chat
- Reset all cursors → next scan is a complete fresh scan of all chats

**File:** `CustomerBrainScreen.tsx` → tracked chats section, `routers/orchestrator.py` → `DELETE /api/agents/scan-cursors`

---

### 1.10 Source Message Reveal

**What it does:** Each detected order card has a collapsible "Source message" toggle that shows the exact chat message the AI extracted the order from.

**File:** `CustomerBrainScreen.tsx` → `OrderCard` → `showSource` state

---

### 1.11 Manual Order Entry (Text Override)

**What it does:** A text input at the bottom of the Brain screen lets the user type a natural-language order manually and run it through the full Customer Brain pipeline (`POST /api/orchestrate`). Returns trace logs in the terminal.

**File:** `CustomerBrainScreen.tsx` → `handleSend()`

---

### 1.12 Voice Order Entry

**What it does:** Tap the microphone icon to record a voice order. On stop, the audio is base64-encoded and sent to `POST /api/voice/transcribe` (Gemini multimodal). The transcript fills the text input for review before sending.

**How it works:** Uses Expo AV library (`expo-av`) for recording, `FileReader` for base64 conversion, and Gemini's multimodal model for transcription.

**File:** `CustomerBrainScreen.tsx` → `handleVoice()`, `routers/orchestrator.py` → `/api/voice/transcribe`

---

### 1.13 Live AI Trace Terminal

**What it does:** A scrolling monospaced terminal widget displays real-time AI thought logs — each step of the pipeline (fetching chats, running Gemini, booking order) is appended as a timestamped log line.

**File:** `widgets/TraceTerminal.tsx`, `CustomerBrainScreen.tsx` → `traceLogs` state

---

### 1.14 NLP Intent Extraction (AntigravityGraph)

**What it does:** The orchestration pipeline at `/api/orchestrate` processes any text through a 4-node Blackboard graph:
1. **Intent Node** — Gemini extracts category, location, time, quantity, urgency
2. **Matching Node** — Finds providers in the 33-entry database with zone adjacency fallback
3. **Ranking Node** — Scores by rating + price, generates AI reasoning string
4. **Simulation Node** — Books the provider, emits `CUSTOMER_ORDER_BOOKED` event

Supports **English**, **Urdu**, and **Roman Urdu** input.

**File:** `orchestrator/graph.py`, `agents/intent_agent.py`

---

### 1.15 Scan State Dashboard Card

**What it does:** A persistent summary card at the top of the Brain screen showing:
- Number of chats currently being tracked (cursor count)
- Total past scan sessions
- Time of last scan
- Quick-access buttons to expand tracked chats or session history

**File:** `CustomerBrainScreen.tsx` → `scanState` display block

---

## 📦 System 2 — Company Brain (ERP)

> **Screen:** `InventoryDashboardScreen.tsx`, `ERPAgentScreen.tsx` · **Backend:** `company_brain/`, `routers/company.py`

---

### 2.1 Multi-Tenant Firestore Inventory

**What it does:** Every user gets a completely isolated inventory namespace in Firestore. No data leaks between users.

**Collections:** `warehouses`, `products`, `suppliers`, `transactions`, `orders`, `activity_log`, `notifications`

**File:** `company_brain/firestore_inventory.py` → `_col(user_id, collection_name)`

---

### 2.2 Warehouse Management

**What it does:** Create, update, and delete warehouse locations. Each warehouse has a name, physical address/location, and optional capacity.

**CRUD Endpoints:** `GET /api/warehouses`, `POST /api/warehouses/add`, `PUT /api/warehouses/{id}`, `DELETE /api/warehouses/{id}`

**File:** `components/inventory/WarehouseManager.tsx`, `routers/company.py`

---

### 2.3 Product Catalog Management

**What it does:** Full product CRUD with fields: name, SKU, category, variant, unit, cost price, selling price, current stock, reorder threshold, linked supplier, linked warehouse.

**Features:**
- Stock level shown with colour-coded indicator (green/yellow/red)
- Bulk view across all warehouses
- Inline editing form with validation

**File:** `components/inventory/ProductManager.tsx`, `routers/company.py`

---

### 2.4 Sales Recording

**What it does:** Record a product sale — selects product, warehouse, quantity, and value. Automatically reduces stock and logs to the transaction ledger.

**Endpoint:** `POST /api/transactions/sale`

**File:** `components/inventory/SalesManager.tsx`

---

### 2.5 Restock Recording

**What it does:** Record incoming stock — selects product, warehouse, quantity, and cost. Increases stock and logs to the ledger.

**Endpoint:** `POST /api/transactions/restock`

---

### 2.6 Stock Adjustment

**What it does:** Record a manual stock correction (e.g. spoilage, count correction) with a mandatory reason field. Can increase or decrease stock.

**Endpoint:** `POST /api/transactions/adjustment`

---

### 2.7 Full Transaction Ledger

**What it does:** Chronological history of every stock movement — SALE, RESTOCK, ADJUSTMENT — with product, warehouse, quantity, value, and timestamp.

**File:** `components/inventory/TransactionManager.tsx`, `GET /api/transactions`

---

### 2.8 Order Management

**What it does:** Customer order tracking with status lifecycle: `PENDING → PROCESSING → SHIPPED → DELIVERED → CANCELLED`.

**Features:**
- Create orders (manual or auto-created by Brain approval)
- Update order status
- Dispatch an order (assign courier name + phone)
- Delete orders
- Brain-approved orders automatically appear here with `BRAIN-{TYPE}-{timestamp}` reference

**File:** `components/inventory/OrderManager.tsx`, `routers/company.py`

---

### 2.9 Supplier Network Management

**What it does:** Maintain a database of suppliers with name, contact, star rating (1-5), reliability score (%), and lead time (days).

**Features:**
- Add/edit/delete individual suppliers
- Bulk delete all suppliers
- Suppliers auto-added from ERP Agent "Find Nearby Supplier" results
- Push notification sent on supplier add/edit/delete

**File:** `components/inventory/SupplierManager.tsx`, `ERPAgentScreen.tsx`

---

### 2.10 SES Demand Forecasting

**What it does:** Predicts next-period demand for every product using **Single Exponential Smoothing (alpha=0.4)** on 13 weekly sales buckets from the last 90 days.

**Outputs per product:**
- Predicted daily demand (units/day)
- Trend direction: UP 📈 / DOWN 📉 / STABLE ➡️
- Confidence: HIGH / MEDIUM / LOW
- Estimated stock-out date (current stock ÷ daily demand)

**Endpoint:** `GET /api/inventory/predictions`

**File:** `company_brain/firestore_inventory.py` → `get_demand_predictions()`, `components/inventory/PredictiveDashboard.tsx`

---

### 2.11 AI Reorder Suggestions

**What it does:** Identifies products that have fallen below their reorder threshold and calculates the recommended reorder quantity, factoring in:
- Supplier lead time demand (daily velocity × lead days)
- 20% safety buffer

**Urgency ladder:**
| Level | Condition |
|---|---|
| 🚨 CRITICAL | Stock < 25% of threshold |
| ⚠️ HIGH | Stock 25–60% of threshold |
| 🟡 MEDIUM | Stock 60–100% of threshold |

**Endpoint:** `GET /api/inventory/suggestions`

**File:** `company_brain/firestore_inventory.py` → `get_reorder_suggestions()`

---

### 2.12 ERP Intelligence Agent (ERPAgentScreen)

**What it does:** An autonomous procurement intelligence dashboard with 4 sections:

#### 2.12.1 Alert Section
- Displays all low-stock alerts from the reorder suggestions engine
- Shows current stock, threshold, days of stock remaining, and suggested order quantity
- Configurable location picker for supplier search (default: Karachi)

#### 2.12.2 Find Nearby Supplier
- Per-alert "Find Nearby Supplier" button searches `GET /api/vendors/search`
- Returns up to 5 ranked results with name, address, rating, distance, price, phone
- One-tap "Add to Supplier List" converts a search result into a managed supplier
- Duplicate detection (by normalised name) prevents adding the same supplier twice

#### 2.12.3 Profit Analytics Section
- Portfolio KPIs: total revenue, total profit, profit margin %, low stock count
- Per-product profitability breakdown: revenue, cost, profit, quantity sold, margin %
- Visual margin progress bar (green ≥20%, yellow <20%)

#### 2.12.4 Suppliers Section
- Full supplier list with edit/delete per supplier
- "Add Supplier Manually" toggle opens a premium glassmorphic form
- Bulk "Delete All" button with confirmation

#### 2.12.5 Warehouses Section
- Warehouse cards listing all stocked products per location
- Shows product name, variant, SKU, current stock, and minimum threshold

**File:** `ERPAgentScreen.tsx`

---

### 2.13 Procurement Approval Workflow (AI)

**What it does:** AI automatically suggests nearby suppliers for any product that needs restocking. The user can approve with one tap to simultaneously add the supplier and record the restock transaction.

**Endpoint:** `POST /api/procurement/suggest` → user reviews → `POST /api/procurement/approve`

**File:** `components/inventory/ProcurementApproval.tsx`, `agents/bidding_agent.py`

---

### 2.14 Profit Summary Analytics

**What it does:** Calculates a full P&L report across the entire portfolio: total revenue (selling price × qty sold), total cost (cost price × qty sold), gross profit, and overall margin %.

**Endpoint:** `GET /api/analytics/profit`

**File:** `company_brain/firestore_inventory.py` → `get_profit_summary()`

---

### 2.15 Activity Log

**What it does:** Every ERP action (product add, stock update, order created, supplier added, etc.) is appended to a timestamped activity log. Viewable in the "Activity" tab of the ERP Hub.

**Endpoint:** `GET /api/activity-log`

**File:** `components/inventory/ActivityLogViewer.tsx`

---

### 2.16 CSV Export

**What it does:** Exports the complete ERP ledger (inventory + transactions + suppliers) as a downloadable CSV file.

**Endpoint:** `GET /api/export/csv` (public, no auth header needed — UID passed as query param)

**File:** `AccountSettingsScreen.tsx` → export button, `routers/company.py`

---

### 2.17 Google Sheets Sync

**What it does:** Syncs inventory data to/from a connected Google Sheet using the `gspread` library.

**Endpoint:** `POST /api/sheets/sync`

---

### 2.18 ERP Overview Dashboard

**What it does:** At-a-glance KPI cards on the ERP Hub home tab:
- Total stock value (cost price × units in stock)
- Total number of products
- Low-stock product count
- Total order count

**File:** `components/inventory/OverviewDashboard.tsx`

---

### 2.19 Shared AppData Context

**What it does:** All ERP screens (ERPAgentScreen, InventoryDashboardScreen) share a single global data context — no duplicate API calls when switching tabs.

**Shared data:** `products`, `suppliers`, `warehouses`, `suggestions` (reorder alerts), `profitSummary`

**File:** `core/AppDataContext.tsx`

---

## 🚚 System 3 — Action Brain (Logistics)

> **Screen:** `LogisticsScreen.tsx` · **Backend:** `action_brain/`, `routers/action.py`

---

### 3.1 Rider Dispatch Console

**What it does:** Full dispatch form to create a new delivery job:
- Order ID (auto-generated random string, editable)
- Destination zone (chip picker: Gulshan, Clifton, DHA, Saddar, PECHS, Nazimabad)
- Item category (chip picker: Milk, Wire, Pipe, Bread, General)
- Customer name + phone number

On dispatch, the system calculates the optimal rider and route before creating the job.

**Endpoint:** `POST /api/action/dispatch`

**File:** `LogisticsScreen.tsx` → `handleDispatch()`

---

### 3.2 OSRM Road-Network Routing

**What it does:** Computes real road-distance and travel-time using the Open Source Routing Machine (OSRM) public API — no API key required.

**Primary URL:** `http://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}`

**Returns:** `distance_km`, `eta_minutes`, `source: "OSRM (Live Road Network)"`

**File:** `action_brain/geo.py` → `_osrm_route()`

---

### 3.3 Haversine Fallback Routing

**What it does:** If OSRM is unavailable (timeout/network error), falls back to the Haversine formula (great-circle distance) with a 1.35× urban road correction factor.

**Returns:** `distance_km`, `eta_minutes` (assuming 30 km/h average), `source: "Haversine (Straight-Line Estimate)"`

**File:** `action_brain/geo.py` → `_haversine()`

---

### 3.4 Smart Rider Allocation

**What it does:** Automatically selects the best available rider for a dispatch by computing the OSRM ETA from each rider's home depot to the destination zone, then picking the fastest available rider.

**Rider fields:** `name`, `phone`, `vehicle`, `rating`, `depot`, `zone`, `status (AVAILABLE/BUSY)`

**File:** `action_brain/riders.py` → `allocate_rider()`

---

### 3.5 5-State Job Lifecycle

**What it does:** Each dispatch job progresses through a 5-stage lifecycle, persisted to Firestore:

```
DISPATCHED → EN_ROUTE → ARRIVED → JOB_STARTED → JOB_COMPLETED
```

Every state transition is timestamped in a `timeline` array.

**Advance State Endpoint:** `POST /api/action/jobs/{job_id}/advance`

**File:** `action_brain/state_machine.py`

---

### 3.6 Animated State Pipeline Visualiser

**What it does:** Each job card shows a horizontal 5-node pipeline with a colour-coded animated progress bar showing the current position in the job lifecycle.

- Completed states shown in their accent colour with matching icon
- Current state node has a glow pulse shadow effect
- Animated bar transitions on state advance

**File:** `LogisticsScreen.tsx` → `StatePipeline` component

---

### 3.7 Rider Geolocation MiniMap (3 modes)

**What it does:** Visual map showing origin depot, destination (client), and current rider position animated along the route.

**3 rendering modes (switchable on web):**
| Mode | Implementation |
|---|---|
| **Vector Grid** | Custom SVG canvas with cyber-grid background, dashed route line, and dot markers |
| **OSM Interactive** | Embedded OpenStreetMap iframe via `/api/map/render` endpoint |
| **Google Maps** | Google Maps Embed API iframe (requires API key) |

On native (iOS/Android): vector mode only, with a "Open Live Google Maps Navigation" deep-link button.

**Rider position:** Animated along the line based on job status (0% dispatched, 50% en route, 100% arrived/started/completed).

**File:** `LogisticsScreen.tsx` → `RiderMiniMap` component

---

### 3.8 Dynamic Fuel Surcharge Engine

**What it does:** Calculates a dynamic delivery cost per job using a live petrol price API.

**Formula:** `Base (Rs 50) + (distance_km × surcharge_per_km)`

**Live data source:** `GET /api/petrol/price` — fetches current petrol price and pre-calculated per-km surcharge.

**File:** `LogisticsScreen.tsx` → fuel surcharge block, `main.py` → `/api/petrol/price`

---

### 3.9 Route Intelligence Card

**What it does:** Per-job card showing route metrics:
- Distance (km)
- ETA (minutes, rounded up)
- Routing engine source (OSRM or Haversine)

**File:** `LogisticsScreen.tsx` → `JobCard` → route card section

---

### 3.10 Zone & Depot Registry

**What it does:** Maintains a lookup table of 13 Karachi zones with GPS coordinates, and 3 depot hubs (Gulshan, DHA/Clifton, Saddar).

**Endpoints:** `GET /api/action/zones`, `GET /api/action/depots`, `GET /api/action/nearest-depot`

**File:** `action_brain/geo.py` → `ZONE_COORDS`, `DEPOTS`

---

### 3.11 Live Job Tracker

**What it does:** Scrollable list of all active dispatch jobs, newest first. Each job shows full details: job ID, state badge, pipeline, map, route stats, fuel surcharge, rider info, and advance button. Refresh button re-fetches from Firestore.

**File:** `LogisticsScreen.tsx` → job list section

---

### 3.12 Autonomous Dispatch (Event-Driven)

**What it does:** When `BUSINESS_DISPATCH_CONFIRMED` event is published with `dispatch_status=READY`, the backend automatically calls the full dispatch pipeline without any user interaction.

**File:** `main.py` → `BUSINESS_DISPATCH_CONFIRMED` listener → `auto_dispatch_s3()`

---

## 🤖 OpsBot — AI ERP Assistant

> **Screen:** `ChatScreen.tsx` · **Backend:** `agents/chat_agent.py`, `routers/company.py`

---

### 4.1 Gemini Function-Calling ERP Chat

**What it does:** A conversational AI assistant that can query and act on your live business data. The user can ask natural language questions about stock, orders, suppliers — and the AI fetches live data to answer.

**Supported queries (examples):**
- "How much milk is left in the Gulshan warehouse?"
- "Show me my last 10 sales"
- "Which suppliers have a reliability score above 90%?"
- "Restock 50kg of sugar from warehouse 1"

**File:** `agents/chat_agent.py`, `ChatScreen.tsx`

---

### 4.2 Live Database Tool Calling (8 Tools)

| Tool | Action |
|---|---|
| `tool_get_stock_levels` | Fetches current stock from Firestore |
| `tool_get_recent_orders` | Fetches last N transactions |
| `tool_get_suppliers` | Full supplier list |
| `tool_get_warehouses` | All warehouse details |
| `tool_find_suppliers_nearby` | Google Maps Places API search |
| `tool_stage_restock` | Returns ActionCard to confirm a restock |
| `tool_stage_sale` | Returns ActionCard to confirm a sale |
| `tool_stage_adjustment` | Returns ActionCard to confirm an adjustment |

**File:** `agents/chat_agent.py` → `TOOL_DECLARATIONS`

---

### 4.3 ActionCard Pattern (Safe Confirmation)

**What it does:** "Staging" tools never execute changes directly. Instead they return a special `ActionCard` JSON payload that the app renders as a confirmation card with "Confirm" and "Cancel" buttons. Only on confirm does the actual API call happen.

**File:** `ChatScreen.tsx` → ActionCard rendering, `agents/chat_agent.py` → `tool_stage_*` functions

---

### 4.4 Multi-Model Priority Chain

**What it does:** The OpsBot tries models in priority order, automatically retrying the next model on quota exhaustion:

1. `gemini-2.5-flash-lite`
2. `gemini-2.5-flash`
3. `gemma-4-26b`
4. `gemma-4-31b`

Reads `retryDelay` from API error responses to respect rate-limit backoff.

**File:** `agents/chat_agent.py` → `_get_client_with_fallback()`

---

### 4.5 Persistent Multi-Turn Conversation

**What it does:** Maintains the full conversation history in the frontend state. Each message is passed to the API as a messages array, so Gemini retains context across turns.

**File:** `ChatScreen.tsx` → `messages` state, `POST /api/chat` → `body.messages`

---

### 4.6 Floating OpsBot Button

**What it does:** A glowing green floating action button (FAB) visible on all tabs except OpsBot and OmniChat. Tapping it opens OpsBot in a 92%-height bottom sheet modal.

**File:** `App.tsx` → floating chat button + modal

---

## 💬 OmniChat — Firebase Realtime Messaging

> **Screen:** `OmniChat/OmniChatScreen.tsx`, `ChatListScreen.tsx`, `ChatRoomScreen.tsx` · **Backend:** `company_brain/ops_chat.py`, Firebase Firestore

---

### 5.1 Realtime Chat Rooms

**What it does:** Create and join chat rooms with customers, suppliers, or any contact. Messages are stored in Firestore and delivered in real-time via `onSnapshot` listener.

**File:** `OmniChat/ChatRoomScreen.tsx`, `services/firebaseChatService.ts`

---

### 5.2 Chat List with Search

**What it does:** Shows all conversations sorted by most recent message, with contact name, last message preview, and timestamp. A search bar filters chats by contact name.

**File:** `OmniChat/ChatListScreen.tsx`

---

### 5.3 New Chat Creation

**What it does:** Start a new conversation by entering a contact name. Creates a new Firestore chat document with the current user as participant.

**File:** `OmniChat/ChatListScreen.tsx` → new chat form

---

### 5.4 Chat Messages as Order Source

**What it does:** Every message sent through OmniChat is stored with full metadata (sender, timestamp, content). The Customer Brain Scanner reads these messages directly from Firestore to detect orders.

**File:** `services/firebaseChatService.ts` → `getAllChatsWithMessages()`

---

### 5.5 User Presence & Firestore Document Management

**What it does:** On login, a user document is created/updated in Firestore with display name and email, enabling cross-user chat lookups.

**File:** `services/firebaseChatService.ts` → `createUser()`, called in `App.tsx` → `onAuthStateChanged`

---

## 🌾 Agri-Bridge — Agricultural Logistics

> **Screen:** `DeliveryIntelligenceScreen.tsx` · **Backend:** `agents/agri_agent.py`, `routers/agri.py`

---

### 6.1 Simulated Street Vendor Demand Feed

**What it does:** Simulates 50 WhatsApp-style crop order messages from street vendors within a 5km radius of a Karachi market location, demonstrating the potential for hyperlocal aggregation.

**Crops tracked:** Organic Tomatoes, Sindhri Mangoes, Red Onions, Fresh Potatoes, Spinach

**File:** `agents/agri_agent.py` → `build_demand_feed()`

---

### 6.2 Aggregate Demand Dashboard

**What it does:** Aggregates the 50 vendor messages into a per-crop demand summary (total kg requested, number of vendors ordering, average price per kg).

**Endpoint:** `GET /api/agri/demand-feed`

---

### 6.3 Shared Logistics Optimisation

**What it does:** Computes the savings from consolidating 50 individual vendor deliveries into 1 shared multi-drop route.

| Metric | Individual | Shared |
|---|---|---|
| Total Distance | ~300 km | ~34.8 km |
| Savings | — | ~88% |

**Endpoint:** `POST /api/agri/dispatch-shared`

**File:** `agents/agri_agent.py` → `dispatch_shared_logistics()`

---

### 6.4 Per-Vendor E-Invoice Generation

**What it does:** Generates a digital invoice for each vendor showing:
- Cargo value (items × price)
- Logistics cost (shared route allocation)
- Profit after logistics
- % profit improvement vs individual delivery

**File:** `agents/agri_agent.py`, `DeliveryIntelligenceScreen.tsx`

---

## 🔔 Notifications System

> **Backend:** `company_brain/notifications.py` · **Screen:** `NotificationsScreen.tsx`

---

### 7.1 Expo Push Notifications

**What it does:** Sends real push notifications to the user's device via the Expo Push API (`https://exp.host/--/api/v2/push/send`).

**Triggers:** Supplier added/updated/deleted, critical stock alerts, order dispatch confirmations.

**File:** `company_brain/notifications.py` → `send_push_notification()`

---

### 7.2 Push Notification Token Management

**What it does:** On login, the app registers for push notifications, gets an Expo push token, and saves it to the backend (`POST /api/users/push-token`). The backend uses this token for all future push sends.

**File:** `services/NotificationService.ts`, `App.tsx` → `onAuthStateChanged`

---

### 7.3 Notification History (Firestore)

**What it does:** Every push notification is also saved as a Firestore record (regardless of whether a push token exists), creating a persistent notification inbox the user can browse.

**Collection:** `users/{uid}/notifications`

**File:** `company_brain/notifications.py` → `_save_notification_record()`

---

### 7.4 Auto Notification Type Classification

**What it does:** Each notification is auto-classified by title keywords into one of: `supplier`, `order`, `stock`, `alert`, `procurement`, `system`. Each type renders with a different icon and colour in the inbox.

**File:** `company_brain/notifications.py` → `_infer_type()`, `NotificationsScreen.tsx`

---

### 7.5 Mark Read / Mark All Read

**What it does:** Individual notifications can be marked as read. A "Mark All Read" button batch-updates all unread notifications using a Firestore batch write.

**Endpoints:** `PATCH /api/users/notifications/{id}/read`, `POST /api/users/notifications/mark-all-read`

**File:** `company_brain/notifications.py` → `mark_notification_read()`, `mark_all_notifications_read()`

---

### 7.6 Unread Badge Counter

**What it does:** The bell icon in the top bar shows an animated red badge with the unread count. The count is polled every 60 seconds and refreshed whenever the notifications screen is closed.

**File:** `App.tsx` → `BellButton` component, `pollNotifications()` callback

---

### 7.7 Test Push Notification

**What it does:** A button in Account Settings sends a test push notification to verify the device's push token is correctly registered.

**Endpoint:** `POST /api/users/test-push`

---

## 🔐 Authentication & Onboarding

> **Screen:** `AuthScreen.tsx`, `OnboardingScreen.tsx` · **Backend:** Firebase Auth, `routers/company.py`

---

### 8.1 Firebase Email/Password Auth

**What it does:** Users register and log in with email and password. Firebase Auth handles token management and session persistence.

**File:** `AuthScreen.tsx`, `config/firebaseConfig.ts`

---

### 8.2 Auth State Listener

**What it does:** `onAuthStateChanged` in `App.tsx` automatically routes between AuthScreen (logged out), OnboardingScreen (first time), and the main tab app (authenticated).

**File:** `App.tsx` → `useEffect` auth listener

---

### 8.3 Onboarding — Seed Demo Data

**What it does:** On first login, the user is offered a choice:
- **"Load Sample Data"** → calls `POST /api/onboarding/seed` to populate warehouses, products, suppliers, and transactions with realistic demo data
- **"Start Fresh"** → calls `POST /api/onboarding/init` to create an empty workspace

**File:** `OnboardingScreen.tsx`

---

### 8.4 Onboarding Status Tracking

**What it does:** After onboarding, a Firestore flag records that the user has been onboarded. This prevents the onboarding screen from appearing on subsequent logins.

**Endpoint:** `GET /api/users/onboarding`

---

### 8.5 Auto User Document Creation

**What it does:** On every login, `FirebaseChatService.createUser()` is called to ensure the user's Firestore document (name, email) exists — used for OmniChat contact resolution.

**File:** `App.tsx` → `onAuthStateChanged` → `FirebaseChatService.createUser()`

---

## ⚙️ Account & Settings

> **Screen:** `AccountSettingsScreen.tsx`

---

### 9.1 User Profile Display

**What it does:** Shows the logged-in user's display name, email, and Firebase UID.

---

### 9.2 Reload Sample Data

**What it does:** Re-seeds all demo data (warehouses, products, suppliers, transactions) even if the user has already been onboarded. Useful for resetting to a known state.

**Endpoint:** `POST /api/onboarding/reseed`

---

### 9.3 CSV Ledger Export

**What it does:** Opens a browser link to download the full ERP ledger as a CSV file — all products, transactions, and suppliers in one file.

**Endpoint:** `GET /api/export/csv?uid={uid}`

---

### 9.4 Test Push Notification

**What it does:** Sends a test push to the registered device to verify the notification pipeline is working.

---

### 9.5 Sign Out

**What it does:** Calls `auth.signOut()` from Firebase, which triggers `onAuthStateChanged` → routes back to `AuthScreen`.

---

## 📱 Mobile App Shell & UX

> **File:** `App.tsx`, `src/core/theme.ts`

---

### 10.1 Glassmorphic Floating Navigation Bar

**What it does:** The primary navigation sits in a floating pill bar at the bottom of the screen, built with:
- `expo-blur` `BlurView` (dark tint, intensity 50)
- Linear gradient inner glow border
- Animated active pill background per tab
- Pill scale + text scale spring animations on tab change

**File:** `App.tsx` → `glassNav`, `NavButton` component

---

### 10.2 Animated Tab Transitions

**What it does:** Switching tabs triggers a parallel fade-out + scale-down (120ms) followed by fade-in + spring scale-up (220ms) of the screen content.

**File:** `App.tsx` → `switchTab()`, `fadeAnim` + `scaleAnim`

---

### 10.3 Animated Loading Splash Screen

**What it does:** While Firebase auth resolves, shows a premium splash with:
- Looping expanding ring animation
- Pulsing BrainCircuit icon on a gradient background
- Pulsing "Opsify" wordmark

**File:** `App.tsx` → `LoadingSplash` component

---

### 10.4 Per-Tab Error Boundaries

**What it does:** Each of the 6 tabs is wrapped in an `ErrorBoundary`. A crash in one tab (e.g. ERP Hub) does not affect other tabs.

**File:** `App.tsx`, `components/ErrorBoundary.tsx`

---

### 10.5 Staggered Animated Card Entries

**What it does:** List items (order cards, alert cards, supplier cards) animate in with a staggered fade + translateY spring — each card delayed by `index × staggerDuration` ms.

**File:** `ERPAgentScreen.tsx` → `AnimatedCard` component, `CustomerBrainScreen.tsx` → `OrderCard`

---

### 10.6 Neon Dark Theme Design System

**What it does:** A consistent, premium dark-mode design system defined in `theme.ts`.

| Token | Value |
|---|---|
| Background | `#0D1117` |
| Surface | `#161B22` |
| Primary | `#00E676` (neon green) |
| Secondary | `#00B0FF` (electric blue) |
| Warning | `#FFB800` |
| Error | `#FF4444` |
| Text Muted | `#8B949E` |
| Border | `rgba(255,255,255,0.1)` |

Animation configs: `spring`, `springFast`, `springBouncy`

**File:** `core/theme.ts`

---

### 10.7 Platform-Aware Rendering

**What it does:** Several features behave differently per platform:
- `Platform.OS === 'web'` → uses `window.confirm()` / `window.alert()` instead of React Native `Alert`
- MiniMap shows OSM/Google toggles on web only
- Android emulator uses `10.0.2.2` as API base URL
- Voice recording via `expo-av` (native only)

---

### 10.8 Bell Button with Shake Animation

**What it does:** When a new unread notification arrives (count increases), the bell icon plays a spring scale-up + scale-down bounce animation.

**File:** `App.tsx` → `BellButton` component

---

### 10.9 Top Control Bar

**What it does:** Fixed header area with Opsify brand logo (left) and a glassmorphic control group (right) containing the bell/badge button, a divider, and the settings gear icon.

**File:** `App.tsx` → `topControls` section

---

## 🏗️ Backend Infrastructure

> **Files:** `main.py`, `broker/event_broker.py`, `firebase_store.py`

---

### 11.1 FastAPI with Async Architecture

**What it does:** The entire backend runs on FastAPI + Uvicorn ASGI. All long-running AI tasks (graph pipeline, deep scan, S3 dispatch) are spawned as `asyncio.create_task()` background tasks, keeping the API responsive.

**File:** `main.py`

---

### 11.2 WebSocket Event Bus

**What it does:** Connected frontend clients subscribe to `ws://host:8000/ws/events` and receive all real-time `SYSTEM_LOG` events as agents process requests.

**File:** `broker/event_broker.py`, `main.py` → `/ws/events` endpoint

---

### 11.3 API Key Middleware

**What it does:** A Starlette `BaseHTTPMiddleware` intercepts all requests and checks for a valid `X-API-Key` header. Requests without a valid key get `401 Unauthorized`.

**Public bypass paths:** `/`, `/docs`, `/redoc`, `/openapi.json`, `/ws/events`, `/api/map/render`, `/api/petrol/price`, `/api/export/csv`

**File:** `main.py` → `APIKeyMiddleware`

---

### 11.4 Per-User Firestore Namespace

**What it does:** The `X-User-ID` header (set automatically by the mobile app from `auth.currentUser.uid`) scopes all Firestore reads/writes to the authenticated user's document tree.

**File:** `company_brain/firestore_inventory.py` → `_col(user_id, collection)`

---

### 11.5 Autonomous Event Chain

**What it does:** The backend publishes internal events and autonomously chains system responses:
- `CUSTOMER_ORDER_BOOKED` → triggers Company Brain
- `BUSINESS_DISPATCH_CONFIRMED (READY)` → triggers Action Brain dispatch

**File:** `main.py` → `POST /api/events/publish` handler

---

### 11.6 OSM Map Render Endpoint

**What it does:** Generates an OpenStreetMap static map image (via Folium/Leaflet) showing the route between two GPS points. Embedded as an iframe in the logistics MiniMap.

**Endpoint:** `GET /api/map/render?lat1=&lng1=&lat2=&lng2=`

---

### 11.7 Live Petrol Price Endpoint

**What it does:** Returns the current Pakistan petrol price and a calculated per-km delivery surcharge, used by the Logistics screen for dynamic fuel cost calculation.

**Endpoint:** `GET /api/petrol/price`

---

### 11.8 Multi-Database Architecture

| Store | Technology | Used For |
|---|---|---|
| Primary (User Data) | Firestore | All per-user ERP data, chat, notifications, scan state |
| Legacy (Providers) | SQLite (`opsify_business.db`) | 33-provider registry, legacy orders |
| Action DB | SQLite (`opsify_action.db`) | Legacy job store (superseded by Firestore) |

---

### 11.9 Automated Test Suite

**What it does:** `pytest` test suite covering:
- `test_api_crud.py` — Warehouse/Product/Supplier CRUD endpoint tests
- `test_company_brain.py` — Company Brain graph pipeline tests
- `test_forecast.py` — SES demand forecast accuracy tests
- `test_graph.py` — AntigravityGraph pipeline integration tests
- `test_inventory.py` — Inventory logic unit tests
- `test_provider_search.py` — Zone-aware provider search tests

**File:** `tests/`

---

### 11.10 Deployment Configurations

| Target | File |
|---|---|
| GCP App Engine | `app.yaml` |
| Heroku | `Procfile` |
| PowerShell Script | `deploy.ps1` |

---

*Last updated: May 2026 — Opsify Platform v2.0*
