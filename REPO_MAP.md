# File: REPO_MAP.md

## Purpose
Document every directory and file in the Opsify repository, explaining their structural necessity and specific functional purpose.

## Responsibility
Serve as a directory map and repository navigation guide for new developers on the team.

## Inputs
File paths and module assignments within the Opsify project workspace.

## Outputs
A clean, markdown-based directory hierarchy and file index with detailed purposes.

## Dependencies
All repository files.

## Notes
Updates dynamically when new files are introduced.

---

# 🗺️ Opsify Repository Structure & Map

This map outlines the complete directory layout of the Opsify repository. It explains **what** each file is, **why** it is needed, and **what** its exact purpose is.

---

## 📂 Visual Directory Tree

```text
opsify/
├── README.md                      # Consolidated Master Specifications
├── SYSTEM_1_CUSTOMER_BRAIN.md     # System 1 Deep-Dive Plan
├── SYSTEM_2_COMPANY_BRAIN.md     # System 2 Deep-Dive Plan
├── SYSTEM_3_ACTION_BRAIN.md     # System 3 Deep-Dive Plan
├── REPO_MAP.md                    # THIS FILE: Workspace manifest map
├── requirements.txt               # Backend Python library specifications
├── main.py                        # FastAPI web API gateway controller
├── test_graph.py                  # State-Graph pipeline CLI validator
├── orchestrator/
│   ├── state.py                   # Blackboard state schema schemas
│   └── graph.py                   # Antigravity State-Graph orchestrator loop
├── agents/
│   ├── intent_agent.py            # Node 1: Linguistic parsing module
│   ├── matching_agent.py          # Node 2: Database matching interface
│   ├── ranking_agent.py           # Node 3: Heuristic selection analyzer
│   └── simulation_agent.py        # Node 4: Provider booking dispatcher
├── tools/
│   ├── database.py                # Hyperlocal provider database query tool
│   └── booking.py                 # Simulated API client reservation tool
└── flutter_app/
    ├── pubspec.yaml               # Flutter environment & packages
    └── lib/
        └── main.dart              # Flutter dynamic trace log UI screen
```

---

## 📝 Detailed File Directory Manifest

### 1. Root Documentation Files
*   **[README.md](file:///e:/projects/Opsify/README.md)**
    *   *Why it is needed:* It is the central developer landing page.
    *   *Purpose:* Outlines the master integration loop, end-to-end event sequence diagrams, master chronological checklist, and premium Flutter UI styling/code templates.
*   **[SYSTEM_1_CUSTOMER_BRAIN.md](file:///e:/projects/Opsify/SYSTEM_1_CUSTOMER_BRAIN.md)**
    *   *Why it is needed:* Dedicated guide for the interaction intelligence system.
    *   *Purpose:* Guides development of the text-parsing LLM prompts, Whisper voice transcription nodes, and mock database queries.
*   **[SYSTEM_2_COMPANY_BRAIN.md](file:///e:/projects/Opsify/SYSTEM_2_COMPANY_BRAIN.md)**
    *   *Why it is needed:* Dedicated guide for business operations.
    *   *Purpose:* Details the in-memory rules, database syncs, and automated wholesaler bidding math.
*   **[SYSTEM_3_ACTION_BRAIN.md](file:///e:/projects/Opsify/SYSTEM_3_ACTION_BRAIN.md)**
    *   *Why it is needed:* Dedicated guide for logistics and route execution.
    *   *Purpose:* Details rider assignments, notification setups, and GPS route optimization methods.
*   **[REPO_MAP.md](file:///e:/projects/Opsify/REPO_MAP.md)** *(This file)*
    *   *Why it is needed:* Instantly onboard team members.
    *   *Purpose:* Acts as the official workspace index map.

### 2. Root Python Scripts & Backend Scaffolds
*   **[main.py](file:///e:/projects/Opsify/main.py)**
    *   *Why it is needed:* It binds the backend Python orchestrator to the web.
    *   *Purpose:* A FastAPI gateway exposing a POST endpoint (`/api/orchestrate`) so the Flutter app can stream text/voice triggers and receive trace logs.
*   **[test_graph.py](file:///e:/projects/Opsify/test_graph.py)**
    *   *Why it is needed:* Local validation loop (Rule 9 / STEP 7 Compliance).
    *   *Purpose:* Runs simulated customer prompts (in Urdu, English, and Roman Urdu) to verify that the State-Graph finishes processing correctly.
*   **[requirements.txt](file:///e:/projects/Opsify/requirements.txt)**
    *   *Why it is needed:* Declares project library dependencies.
    *   *Purpose:* Ensures uvicorn, fastapi, and pydantic install smoothly on all team environments.

### 3. The Orchestration Package (`orchestrator/`)
*   **[orchestrator/state.py](file:///e:/projects/Opsify/orchestrator/state.py)**
    *   *Why it is needed:* Defines the Blackboard structure.
    *   *Purpose:* A `TypedDict` schema tracking the current input, intents, candidate matches, final selections, and real-time execution status.
*   **[orchestrator/graph.py](file:///e:/projects/Opsify/orchestrator/graph.py)**
    *   *Why it is needed:* The core graph loop runner.
    *   *Purpose:* Sequentially executes each Agent node, passing state onward and handling execution failures.

### 4. Specialized Agents (`agents/`)
*   **[agents/intent_agent.py](file:///e:/projects/Opsify/agents/intent_agent.py)**
    *   *Why it is needed:* Linguistic parsing node.
    *   *Purpose:* Identifies the service requested, time schedules, and locations.
*   **[agents/matching_agent.py](file:///e:/projects/Opsify/agents/matching_agent.py)**
    *   *Why it is needed:* Database matcher node.
    *   *Purpose:* Calls matching tools to seek candidate technicians nearby.
*   **[agents/ranking_agent.py](file:///e:/projects/Opsify/agents/ranking_agent.py)**
    *   *Why it is needed:* Heuristic selection engine.
    *   *Purpose:* Ranks candidate options based on customer ratings versus hour charges.
*   **[agents/simulation_agent.py](file:///e:/projects/Opsify/agents/simulation_agent.py)**
    *   *Why it is needed:* Final reservation dispatcher.
    *   *Purpose:* Fires the booking tool and updates execution statuses to `"BOOKED"`.

### 5. Backend Operational Tools (`tools/`)
*   **[tools/database.py](file:///e:/projects/Opsify/tools/database.py)**
    *   *Why it is needed:* Seek active regional workers.
    *   *Purpose:* Simulates queries to active databases, returning ratings and prices.
*   **[tools/booking.py](file:///e:/projects/Opsify/tools/booking.py)**
    *   *Why it is needed:* Simulated reservation engine.
    *   *Purpose:* Generates fake booking confirmation IDs.

### 6. Mobile Application Package (`flutter_app/`)
*   **[flutter_app/pubspec.yaml](file:///e:/projects/Opsify/flutter_app/pubspec.yaml)**
    *   *Why it is needed:* Package environment manager for Flutter.
    *   *Purpose:* Imports the HTTP package, Provider library, and audio recording systems.
*   **[flutter_app/lib/main.dart](file:///e:/projects/Opsify/flutter_app/lib/main.dart)**
    *   *Why it is needed:* Immersive Client presentation view.
    *   *Purpose:* The main user interface, including a voice recorder and a real-time green scrollable "CLI log trace terminal".
