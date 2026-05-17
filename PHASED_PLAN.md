# File: PHASED_PLAN.md

## Purpose
Outline the step-by-step phased development plan for each independent system (Customer, Company, Action Brains) of Opsify.

## Responsibility
Serve as the master roadmap for the development team to scale Opsify from a hackathon MVP to a production-ready agentic orchestration system.

## Inputs
Hackathon requirements, system architecture specifications, user-defined agent/pipeline workflows.

## Outputs
A structured phase-by-step evolution path for each individual brain to ensure parallel, non-blocking development.

## Dependencies
None (standalone planning documentation).

## Notes
Adheres to clean architecture and modular system design rules. Each phase ensures the system is fully compilable, testable, and robust.

---

# 🗺️ Opsify Phased System Breakdown

To build a production-ready platform, each of the three "Brains" must evolve from a basic simulated prototype to an advanced automated agent. This document divides **each system into 3 distinct development phases** to help team members build and scale their modules independently.

---

## 📥 System 1: Customer Brain (Interaction & Order Intelligence)
**Primary Responsibility:** Capture user requests (text/voice, English/Urdu/Roman Urdu) and transform them into standardized structured JSON intents.

### 📍 Phase 1: Heuristic Parsing & State Scaffolding (Current MVP)
*   **Goal:** Build the State-Graph skeleton and implement lightweight heuristics to verify the state transitions.
*   **Tasks:**
    *   Establish `orchestrator/state.py` containing the Blackboard schema.
    *   Implement regex or keyword-based matching to parse common keywords (e.g., "electrician", "leak", "doodh").
    *   Integrate a mock provider database and booking simulation flow.
*   **Verification:** Run the FastAPI endpoint `/api/orchestrate` with simple queries to verify that the graph completes with state transition history.

### 📍 Phase 2: Multilingual LLM Integration (Production-Ready Extraction)
*   **Goal:** Upgrade the parser agent to handle messy natural language, Roman Urdu, Urdu script, and typos using an LLM.
*   **Tasks:**
    *   Swap the basic parser heuristic in `intent_agent.py` for a structured LLM call (e.g., using Gemini-Pro or GPT-4o-mini).
    *   Design a strict prompt template that forces the LLM to output structured JSON even if inputs are mixed-language:
        *   *Input:* `"yaar hamare DHA wale office mein AC cooling nahi kar raha, jaldi kisi ko bhej do"`
        *   *LLM Output:* `{"category": "AC Technician", "location": "DHA", "time": "ASAP"}`
*   **Verification:** Run a test suite containing 20 diverse multilingual strings. Verify extraction accuracy matches >95%.

### 📍 Phase 3: Multimodal Processing (Voice Node)
*   **Goal:** Allow informal sector users to speak via voice messages (WhatsApp audio notes) instead of typing.
*   **Tasks:**
    *   Integrate an Audio Processing Node at the start of the Customer Brain pipeline.
    *   Use a Speech-to-Text engine (e.g., Whisper API) to transcribe the audio note.
    *   Feed the transcribed text directly into the Phase 2 LLM extractor.
*   **Verification:** Upload a `.wav` or `.mp3` file to the ingestion endpoint and verify it generates a successfully booked order ticket.

---

## 📦 System 2: Company Brain (Business Operations)
**Primary Responsibility:** Track inventory, evaluate supplier prices, manage business triggers, and perform real-time accounting.

### 📍 Phase 1: Mock Stock & Trigger Rules (Parallel MVP)
*   **Goal:** Build in-memory rule engines that make business decisions based on customer orders.
*   **Tasks:**
    *   Create `company_brain/` folder with state management.
    *   Implement hardcoded thresholds (e.g., "If Milk stock drops below 5 liters, flag for auto-procurement").
    *   Write a mock supplier comparison tool that outputs mock supplier quotes.
*   **Verification:** Input a mock JSON order ticket with `quantity: 10kg`. Verify that the system outputs a `"procurement_needed": true` flag.

### 📍 Phase 2: Live Relational Database Sync & Automated Procurement APIs
*   **Goal:** Integrate persistent storage and connect to real-world wholesale supplier APIs.
*   **Tasks:**
    *   Integrate PostgreSQL or Supabase to persist inventory and record transactions.
    *   Develop a dynamic procurement tool that fetches live prices from external vendor APIs/scrapers.
    *   Create a Decision Agent that selects the lowest-priced supplier that can deliver within the deadline.
*   **Verification:** Run mock ordering simulations while inspecting DB tables to ensure inventory levels drop accurately.

### 📍 Phase 3: Demand Forecasting & ML Forecasting
*   **Goal:** Move from reactive ordering to proactive business management.
*   **Tasks:**
    *   Add an Analytics Agent that processes historical transaction logs.
    *   Implement a lightweight ML predictor (e.g., linear regression or simple time-series analysis) to forecast demand spikes (e.g., higher milk/AC repair demand on hot weekends).
    *   Auto-order stock 24 hours *before* the shortage is expected to occur.
*   **Verification:** Simulate historical order logs and verify the system automatically generates purchase orders *before* stock runs dry.

---

## 🚚 System 3: Action Brain (Logistics & Execution)
**Primary Responsibility:** Assign delivery riders, generate optimized navigation routing, and coordinate status notifications.

### 📍 Phase 1: Booking & Communication Simulator
*   **Goal:** Establish a mock execution runner that simulates physical delivery tracking.
*   **Tasks:**
    *   Create `action_brain/` folder.
    *   Simulate notifications using console print/logger trace outputs.
    *   Implement simulated ETAs using simple distance math.
*   **Verification:** Inject a dispatched order package into the Action Brain and verify it outputs an simulated ETA and successful "Rider Dispatched" state.

### 📍 Phase 2: Geolocation & Route Optimization APIs
*   **Goal:** Enable real geographical route solving and intelligent dispatcher assignment.
*   **Tasks:**
    *   Integrate a routing engine API (e.g., Google Maps Distance Matrix API or Open Source Routing Machine - OSRM).
    *   Implement a matching heuristic that assigns the order to the closest active rider using latitude/longitude telemetry.
    *   Optimize multi-stop routes for a single rider to minimize fuel cost.
*   **Verification:** Inject three orders in DHA Karachi. Verify that the routing agent calculates the most optimal path sequence and assigns a single nearby rider.

### 📍 Phase 3: Notification Gateway & Payment Sandboxes
*   **Goal:** Hook the system up to real execution APIs for standard notifications and payment tracking.
*   **Tasks:**
    *   Replace mock notifications with real WhatsApp Business API / SMS Gateways (e.g., Twilio).
    *   Send real-time interactive tracking links to the customer's phone.
    *   Integrate mobile payment sandboxes (e.g., EasyPaisa, JazzCash, or Stripe) to handle automated payouts to technicians/riders once a job is finished.
*   **Verification:** Initiate an order flow. Verify a real text message arrives on a test phone with the booking details and tracking link.
