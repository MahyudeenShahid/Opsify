import os
import json
from orchestrator.state import OpsifyState

def linguistic_intent_node(state: OpsifyState) -> OpsifyState:
    """
    Agent 1: Linguistic Intent Agent
    Parses natural language (English/Urdu/Roman Urdu) into structured intent.
    PRIMARY: Calls Gemini 2.5 Flash via Google GenAI SDK.
    FALLBACK: Keyword heuristic matching if API key missing or call fails.
    """
    state["agent_trace_logs"].append("[Intent Agent] Parsing input for intent...")
    state["execution_status"] = "PARSING_INTENT"

    raw = state["raw_input"]
    api_key = os.environ.get("GEMINI_API_KEY")

    # ── PRIMARY: Real Gemini LLM ──────────────────────────────────────────────
    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            prompt = f"""You are an intent extraction engine for a Pakistani ERP platform.
Parse the following customer message (may be English, Urdu, or Roman Urdu) and extract a JSON object.

Message: "{raw}"

Return ONLY a valid JSON object with EXACTLY these keys:
- "category": one of ["Electrician", "Plumber", "AC Technician", "Milk", "Unknown"]
- "location": one of ["Gulshan", "DHA", "Clifton", "Unknown"] — look for area names including Urdu ("gulshan", "defence", "dha")
- "time": "ASAP" or "Tomorrow" or "Today"
- "quantity": null or a string like "2kg" or "50 meters"
- "urgency_level": "HIGH" if words like urgent/emergency/jaldi/abhi/fauri present, else "MEDIUM"

Return only the JSON object, no explanation."""

            response = client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.0),
            )

            text = response.text.strip()
            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            text = text.strip()

            intent = json.loads(text)
            # Normalize keys to expected values
            intent.setdefault("category", "Unknown")
            intent.setdefault("location", "Unknown")
            intent.setdefault("time", "ASAP")
            intent.setdefault("quantity", "1")
            intent.setdefault("urgency_level", "MEDIUM")

            state["extracted_intent"] = intent
            state["agent_trace_logs"].append(f"[Intent Agent | Gemini] Extracted: {json.dumps(intent)}")
            return state

        except Exception as e:
            state["agent_trace_logs"].append(f"[Intent Agent] Gemini failed ({str(e)[:60]}), falling back to heuristics...")

    # ── FALLBACK: Keyword heuristics ─────────────────────────────────────────
    raw_lower = raw.lower()
    intent = {
        "category": "Unknown",
        "quantity": "1",
        "time": "ASAP",
        "location": "Unknown",
        "urgency_level": "MEDIUM",
    }

    if any(kw in raw_lower for kw in ["electrician", "bijli", "wire", "wiring"]):
        intent["category"] = "Electrician"
    elif any(kw in raw_lower for kw in ["plumber", "pani", "pipe", "leak", "pani ka"]):
        intent["category"] = "Plumber"
    elif any(kw in raw_lower for kw in ["ac", "cooling", "ac tech", "air condition"]):
        intent["category"] = "AC Technician"
    elif any(kw in raw_lower for kw in ["doodh", "milk", "dairy"]):
        intent["category"] = "Milk"

    if any(kw in raw_lower for kw in ["kal", "tomorrow"]):
        intent["time"] = "Tomorrow"
    elif any(kw in raw_lower for kw in ["aaj", "today"]):
        intent["time"] = "Today"

    if "kilo" in raw_lower or "kg" in raw_lower:
        intent["quantity"] = "2kg" if "2" in raw_lower else "1kg"
    elif "meter" in raw_lower or "meters" in raw_lower:
        for token in raw_lower.split():
            if token.isdigit():
                intent["quantity"] = f"{token} meters"
                break

    if "gulshan" in raw_lower:
        intent["location"] = "Gulshan"
    elif any(kw in raw_lower for kw in ["dha", "defence", "defense"]):
        intent["location"] = "DHA"
    elif "clifton" in raw_lower:
        intent["location"] = "Clifton"

    if any(kw in raw_lower for kw in ["urgent", "emergency", "jaldi", "abhi", "fauri", "asap"]):
        intent["urgency_level"] = "HIGH"

    state["extracted_intent"] = intent
    state["agent_trace_logs"].append(f"[Intent Agent | Heuristic] Extracted: {json.dumps(intent)}")
    return state
