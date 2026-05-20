# Running Opsify Locally

This guide gets both the **backend** (FastAPI) and the **frontend** (React Native / Expo) running on your machine in under 10 minutes.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Comes with Node.js |
| Git | any | [git-scm.com](https://git-scm.com) |

---

## 1 — Clone the Repo

```bash
git clone https://github.com/YOUR_USERNAME/Opsify.git
cd Opsify
```

---

## 2 — Backend Setup (FastAPI)

### 2a — Create a virtual environment

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python -m venv .venv
source .venv/bin/activate
```

### 2b — Install dependencies

```bash
pip install -r requirements.txt
```

### 2c — Configure environment variables

```bash
# Copy the template
cp .env.example .env
```

Now open `.env` and fill in your actual values:

```env
# Required — get from Google AI Studio
GEMINI_API_KEY=your_gemini_api_key_here

# Required — any strong random string (used to protect the API)
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
OPSIFY_API_KEY=your_strong_api_key_here

# Optional — enables real map routing (falls back to demo mode if missing)
GOOGLE_MAPS_API_KEY=your_google_maps_key_here
```

### 2d — Add Firebase credentials

Place your Firebase service account JSON file in the project root as either:
- `firebase-adminsdk.json`  ← preferred
- `service_account.json`

> **Where to get it:**  
> Firebase Console → Project Settings → Service Accounts → Generate new private key

The app will automatically find and use the file. **Never commit this file to git** — it's already in `.gitignore`.

### 2e — Start the backend

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

Visit **http://localhost:8000** — you should see:
```json
{"status": "Opsify Antigravity Engine is running."}
```

Visit **http://localhost:8000/docs** for the full interactive API documentation (Swagger UI).

---

## 3 — Frontend Setup (React Native / Expo)

### 3a — Install dependencies

```bash
cd react_native_app
npm install
```

### 3b — Configure the API key (optional)

If you set `OPSIFY_API_KEY` in the backend `.env`, the frontend also needs it.

Create `react_native_app/.env`:

```env
EXPO_PUBLIC_OPSIFY_API_KEY=same_key_you_set_in_backend
```

### 3c — Start the app

#### Web (fastest — no emulator needed)

```bash
npm run web
```

Opens the app in your browser at **http://localhost:8081**

#### iOS Simulator (macOS only)

```bash
npm run ios
```

#### Android Emulator

```bash
npm run android
```

#### Expo Go (physical device — scan QR code)

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your phone.

---

## 4 — First-Time Setup (Onboarding)

1. Open the app in your browser or on your device
2. Tap **"Sign Up"** and create an account with your email
3. The onboarding wizard will appear — enter your company name and business type
4. Tap **"Seed Demo Data"** to populate your account with sample products, orders, and suppliers
5. You're ready to go!

---

## 5 — Project Structure at a Glance

```
Opsify/
│
├── main.py                    ← FastAPI app entry point
├── requirements.txt           ← Python dependencies (pinned)
├── Procfile                   ← Cloud Run / Heroku start command
├── app.yaml                   ← Google App Engine config
├── .env.example               ← Environment variable template
├── firebase_store.py          ← Firestore client (singleton)
│
├── routers/                   ← API route handlers
│   ├── orchestrator.py        ← System 1: Customer Brain API
│   ├── company.py             ← System 2: ERP / Inventory API
│   ├── action.py              ← System 3: Delivery / Logistics API
│   └── agri.py                ← Agricultural intelligence API
│
├── agents/                    ← AI agent implementations (Gemini)
│   ├── chat_agent.py          ← OpsBot conversational AI
│   ├── chat_scan_agent.py     ← Chat message order detection
│   ├── intent_agent.py        ← NL → structured order intent
│   ├── matching_agent.py      ← Intent → best supplier match
│   ├── ranking_agent.py       ← Multi-supplier ranking
│   ├── bidding_agent.py       ← Supplier bidding logic
│   ├── agri_agent.py          ← Agricultural market intelligence
│   └── simulation_agent.py    ← Order scenario simulation
│
├── company_brain/             ← ERP business logic
│   ├── firestore_inventory.py ← All Firestore CRUD operations
│   ├── notifications.py       ← Push notification + Firestore history
│   ├── graph.py               ← LangGraph workflow for S2 automation
│   └── ops_chat.py            ← Chat context injection
│
├── action_brain/              ← Logistics engine
│   ├── riders.py              ← Zone-based rider allocation
│   ├── geo.py                 ← Routing & ETA calculation
│   ├── state_machine.py       ← Delivery job lifecycle
│   └── firestore_db.py        ← Job persistence
│
├── broker/                    ← Real-time WebSocket event bus
│
└── react_native_app/          ← Expo React Native frontend
    ├── App.tsx                ← Root: auth, nav, floating bot
    └── src/
        ├── core/
        │   ├── theme.ts       ← Design system (colors, typography, animations)
        │   └── AppDataContext.tsx  ← Global ERP data cache (React Context)
        ├── screens/           ← One file per app tab/screen
        ├── components/
        │   └── inventory/     ← 10 ERP sub-components
        ├── services/
        │   ├── api.ts         ← All backend API calls (50+ methods)
        │   ├── firebaseChatService.ts  ← OmniChat Firestore client
        │   └── NotificationService.ts ← Expo push notifications
        └── config/
            └── firebaseConfig.ts ← Firebase JS SDK initialisation
```

---

## 6 — Common Issues

| Problem | Fix |
|---|---|
| `ModuleNotFoundError` on startup | Run `pip install -r requirements.txt` inside your activated venv |
| `RuntimeError: Firestore credentials not configured` | Add `firebase-adminsdk.json` to the project root (see Step 2d) |
| Frontend shows "Network request failed" | Make sure the backend is running on port 8000 |
| Android emulator can't reach backend | Change `localhost` to `10.0.2.2` in `src/services/api.ts` (already done by default) |
| `GEMINI_API_KEY` errors | Get a key from [Google AI Studio](https://aistudio.google.com) and add it to `.env` |
| Port 8000 already in use | Change the port: `uvicorn main:app --port 8001` and update `api.ts` |

---

## 7 — Useful URLs (while running)

| URL | Description |
|---|---|
| http://localhost:8000 | Backend health check |
| http://localhost:8000/docs | Swagger UI — interactive API explorer |
| http://localhost:8000/redoc | ReDoc — alternative API documentation |
| http://localhost:8000/ws/events | WebSocket event stream |
| http://localhost:8081 | React Native web app |
