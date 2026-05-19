"""
agents/chat_agent.py
Gemini-powered ERP Assistant with database read access and action staging.
Uses google-generativeai (genai) with function calling to query live DB data
and suggest/stage transactional actions that the user confirms in the UI.
"""
import os
import json
import time
import re
from typing import List, Dict, Any
from company_brain.firestore_inventory import (
    get_products, get_transactions, get_suppliers, get_warehouses,
    record_restock, record_sale, record_adjustment, add_supplier
)
from agents.bidding_agent import generate_procurement_suggestions

# ─── DB Tool Functions ────────────────────────────────────────────────────────

def tool_get_stock_levels() -> str:
    """Returns current stock levels for all products across all warehouses."""
    products = get_products()
    summary = []
    for p in products:
        summary.append({
            "id": p["id"],
            "name": p["name"],
            "sku": p["sku"],
            "stock": p.get("stock", 0),
            "unit": p.get("unit", "units"),
            "reorder_threshold": p.get("reorder_threshold", 0),
            "warehouse": p.get("warehouse_name", "Default"),
            "supplier": p.get("supplier_name", "N/A"),
        })
    return json.dumps(summary, default=str)

def tool_get_recent_orders(limit: int = 20) -> str:
    """Returns recent transactions (sales, restocks, adjustments). Limit to last N entries."""
    txs = get_transactions()
    return json.dumps(txs[:limit], default=str)

def tool_get_suppliers() -> str:
    """Returns the full supplier list."""
    return json.dumps(get_suppliers(), default=str)

def tool_get_warehouses() -> str:
    """Returns all warehouse information."""
    return json.dumps(get_warehouses(), default=str)

def tool_find_suppliers_nearby(product_name: str, lat: float = 24.8607, lng: float = 67.0011) -> str:
    """Find nearby suppliers for a product using Google Maps. lat/lng default to Karachi."""
    suggestions = generate_procurement_suggestions(product_name, lat, lng)
    return json.dumps(suggestions, default=str)

# ─── Action Staging — these return ActionCard payloads for UI confirmation ──

def tool_stage_restock(product_id: int, warehouse_id: int, quantity: float, note: str = "") -> str:
    """Stages a restock action. Returns an ActionCard payload for user confirmation."""
    products = get_products()
    prod = next((p for p in products if p["id"] == product_id), None)
    warehouses = get_warehouses()
    wh = next((w for w in warehouses if w["id"] == warehouse_id), None)
    return json.dumps({
        "action_type": "RESTOCK",
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "quantity": quantity,
        "product_name": prod["name"] if prod else f"Product #{product_id}",
        "warehouse_name": wh["name"] if wh else f"Warehouse #{warehouse_id}",
        "note": note,
        "requires_confirmation": True,
    })

def tool_stage_sale(product_id: int, warehouse_id: int, quantity: float, note: str = "") -> str:
    """Stages a sale/stock-reduction. Returns an ActionCard payload for user confirmation."""
    products = get_products()
    prod = next((p for p in products if p["id"] == product_id), None)
    return json.dumps({
        "action_type": "SALE",
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "quantity": quantity,
        "product_name": prod["name"] if prod else f"Product #{product_id}",
        "note": note,
        "requires_confirmation": True,
    })

def tool_stage_adjustment(product_id: int, warehouse_id: int, quantity_diff: float, reason: str) -> str:
    """Stages a stock adjustment (positive or negative). Returns an ActionCard for user confirmation."""
    products = get_products()
    prod = next((p for p in products if p["id"] == product_id), None)
    return json.dumps({
        "action_type": "ADJUSTMENT",
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "quantity_diff": quantity_diff,
        "reason": reason,
        "product_name": prod["name"] if prod else f"Product #{product_id}",
        "requires_confirmation": True,
    })

# ─── Main Chat Entry Point ────────────────────────────────────────────────────

TOOL_MAP = {
    "tool_get_stock_levels":      tool_get_stock_levels,
    "tool_get_recent_orders":     tool_get_recent_orders,
    "tool_get_suppliers":         tool_get_suppliers,
    "tool_get_warehouses":        tool_get_warehouses,
    "tool_find_suppliers_nearby": tool_find_suppliers_nearby,
    "tool_stage_restock":         tool_stage_restock,
    "tool_stage_sale":            tool_stage_sale,
    "tool_stage_adjustment":      tool_stage_adjustment,
}

SYSTEM_PROMPT = """You are OpsBot, an intelligent ERP assistant for the Opsify platform.
You have access to the company's live database and can:
1. Answer questions about stock levels, orders, suppliers, and warehouses.
2. Find nearby suppliers using Google Maps Places API.
3. STAGE actions like restocking stock, recording sales, or adjusting inventory.

When staging actions, always call the appropriate `tool_stage_*` function which returns a confirmation card.
NEVER execute irreversible actions silently — always return an ActionCard so the user confirms.
Be concise, professional, and data-driven. Always reference specific numbers from the DB.
If you need data, call the appropriate tool first before answering.
Format responses clearly using bullet points when presenting lists of data."""

def run_chat(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Processes a conversation with the Gemini ERP assistant.
    Returns: { text, action_card (optional) }
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        return _fallback_response(messages)
    
    try:
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=api_key)
        
        # Build Gemini tools declaration
        tools_declaration = [
            types.FunctionDeclaration(
                name="tool_get_stock_levels",
                description="Returns current stock levels for all products across all warehouses.",
                parameters=types.Schema(type=types.Type.OBJECT, properties={}, required=[])
            ),
            types.FunctionDeclaration(
                name="tool_get_recent_orders",
                description="Returns recent transactions (sales, restocks, adjustments).",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={"limit": types.Schema(type=types.Type.INTEGER, description="Max number of records")},
                    required=[]
                )
            ),
            types.FunctionDeclaration(
                name="tool_get_suppliers",
                description="Returns the full supplier list with ratings and contact info.",
                parameters=types.Schema(type=types.Type.OBJECT, properties={}, required=[])
            ),
            types.FunctionDeclaration(
                name="tool_get_warehouses",
                description="Returns all warehouse information.",
                parameters=types.Schema(type=types.Type.OBJECT, properties={}, required=[])
            ),
            types.FunctionDeclaration(
                name="tool_find_suppliers_nearby",
                description="Find nearby suppliers for a product using Google Maps.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "product_name": types.Schema(type=types.Type.STRING, description="Product name to find suppliers for"),
                        "lat": types.Schema(type=types.Type.NUMBER, description="Latitude"),
                        "lng": types.Schema(type=types.Type.NUMBER, description="Longitude"),
                    },
                    required=["product_name"]
                )
            ),
            types.FunctionDeclaration(
                name="tool_stage_restock",
                description="Stage a restock of a product. Returns an ActionCard for user confirmation.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "product_id": types.Schema(type=types.Type.INTEGER, description="Product database ID"),
                        "warehouse_id": types.Schema(type=types.Type.INTEGER, description="Warehouse ID"),
                        "quantity": types.Schema(type=types.Type.NUMBER, description="Quantity to restock"),
                        "note": types.Schema(type=types.Type.STRING, description="Optional note"),
                    },
                    required=["product_id", "warehouse_id", "quantity"]
                )
            ),
            types.FunctionDeclaration(
                name="tool_stage_sale",
                description="Stage a sale / stock reduction. Returns an ActionCard for user confirmation.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "product_id": types.Schema(type=types.Type.INTEGER, description="Product database ID"),
                        "warehouse_id": types.Schema(type=types.Type.INTEGER, description="Warehouse ID"),
                        "quantity": types.Schema(type=types.Type.NUMBER, description="Quantity sold"),
                        "note": types.Schema(type=types.Type.STRING, description="Optional note"),
                    },
                    required=["product_id", "warehouse_id", "quantity"]
                )
            ),
            types.FunctionDeclaration(
                name="tool_stage_adjustment",
                description="Stage a stock adjustment. Returns an ActionCard for user confirmation.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "product_id": types.Schema(type=types.Type.INTEGER, description="Product database ID"),
                        "warehouse_id": types.Schema(type=types.Type.INTEGER, description="Warehouse ID"),
                        "quantity_diff": types.Schema(type=types.Type.NUMBER, description="Change in quantity (+/-)"),
                        "reason": types.Schema(type=types.Type.STRING, description="Reason for adjustment"),
                    },
                    required=["product_id", "warehouse_id", "quantity_diff", "reason"]
                )
            ),
        ]
        
        # Build conversation history
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
        
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=[types.Tool(function_declarations=tools_declaration)],
            temperature=0.4,
        )
        
        # Agentic loop: handle function calls with model-priority fallback
        max_iterations = 5
        action_card = None

        # Model priority can be configured via GEMINI_MODEL_PRIORITY env var (comma-separated)
        priority_env = os.environ.get('GEMINI_MODEL_PRIORITY', '')
        if priority_env:
            model_list = [m.strip() for m in priority_env.split(',') if m.strip()]
        else:
            model_list = [
                'gemini-2.5-flash-lite',
                'gemini-2.5-flash',
                'gemma-4-26b',
                'gemma-4-31b',
            ]

        for _ in range(max_iterations):
            candidate = None
            used_model = None

            # Try models in priority order; per-model retry on transient quota errors
            for model_name in model_list:
                response = None
                max_retries = 2
                for attempt in range(max_retries):
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=contents,
                            config=config,
                        )
                        used_model = model_name
                        break
                    except Exception as e:
                        msg = str(e)
                        # Detect quota exhausted / rate limit
                        if 'RESOURCE_EXHAUSTED' in msg or 'quota' in msg.lower() or '429' in msg:
                            # Try to parse a retry delay in seconds from the message
                            m = re.search(r'retry in\s*([0-9.]+)s', msg)
                            if not m:
                                m = re.search(r'retryDelay\W*\'?([0-9.]+)s', msg)
                            if m:
                                delay = float(m.group(1))
                            else:
                                delay = min(60, (2 ** attempt))

                            print(f"[OpsBot] Model {model_name} quota/rate limit hit, attempt {attempt+1}/{max_retries}, retrying in {delay}s...")
                            if attempt < max_retries - 1:
                                time.sleep(delay)
                                continue
                            else:
                                print(f"[OpsBot] Model {model_name} exhausted after {max_retries} attempts: {msg}")
                                # Try next model in priority list
                                break
                        elif 'UNAVAILABLE' in msg or '503' in msg:
                            delay = min(30, (2 ** attempt))
                            print(f"[OpsBot] Model {model_name} unavailable (503), retrying in {delay}s...")
                            if attempt < max_retries - 1:
                                time.sleep(delay)
                                continue
                            else:
                                print(f"[OpsBot] Model {model_name} unavailable after {max_retries} attempts: {msg}")
                                break
                        else:
                            # Non-quota error for this model — skip to next model
                            print(f"[OpsBot] Model {model_name} error: {e}")
                            break

                if response is not None and getattr(response, 'candidates', None):
                    candidate = response.candidates[0]
                    if candidate is None or getattr(candidate, 'content', None) is None:
                        print(f"[OpsBot] Model {model_name} returned empty candidate content.")
                        candidate = None
                    else:
                        print(f"[OpsBot] Using model: {used_model}")
                        break
                elif response is not None:
                    print(f"[OpsBot] Model {model_name} returned no candidates.")

            if candidate is None:
                # No model produced a response — fall back
                print('[OpsBot] No available model produced a response, using local fallback.')
                return _fallback_response(messages)
            
            # Check for function calls
            parts = candidate.content.parts or []
            fn_calls = [p for p in parts if getattr(p, 'function_call', None)]
            
            if not fn_calls:
                # Final text response
                text = "".join(p.text for p in parts if getattr(p, 'text', None))
                return {"text": text, "action_card": action_card}
            
            # Execute each function call
            fn_results = []
            for part in fn_calls:
                fc = part.function_call
                fn = TOOL_MAP.get(fc.name)
                if fn:
                    args = dict(fc.args) if fc.args else {}
                    result_str = fn(**args)
                    fn_results.append((fc.name, result_str))
                    
                    # Check if result is an ActionCard
                    try:
                        parsed = json.loads(result_str)
                        if parsed.get("requires_confirmation"):
                            action_card = parsed
                    except Exception:
                        pass
            
            # Append model's function call response to contents
            contents.append(candidate.content)
            
            # Append function results
            fn_response_parts = [
                types.Part(
                    function_response=types.FunctionResponse(name=name, response={"result": result})
                )
                for name, result in fn_results
            ]
            contents.append(types.Content(role="user", parts=fn_response_parts))
        
        return {"text": "I've processed your request.", "action_card": action_card}
        
    except Exception as e:
        print(f"[OpsBot] Gemini error: {e}")
        return _fallback_response(messages)

def _fallback_response(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """Simple keyword-based fallback when Gemini API is not available."""
    last_msg = messages[-1]["content"].lower() if messages else ""
    
    if any(k in last_msg for k in ["stock", "inventory", "level"]):
        products = get_products()
        lines = [f"• {p['name']}: **{p.get('stock', 0)} {p.get('unit', 'units')}** (Warehouse: {p.get('warehouse_name', 'N/A')})" for p in products[:8]]
        return {"text": "Current stock levels:\n" + "\n".join(lines), "action_card": None}
    
    elif any(k in last_msg for k in ["order", "transaction", "sale", "restock"]):
        txs = get_transactions()
        lines = [f"• {t.get('type')}: {t.get('quantity')} × {t.get('product_name', 'Item')} — Rs {t.get('total_value', 0)}" for t in txs[:8]]
        return {"text": "Recent transactions:\n" + "\n".join(lines), "action_card": None}
    
    elif any(k in last_msg for k in ["supplier", "vendor"]):
        sups = get_suppliers()
        lines = [f"• **{s['name']}** — ⭐ {s['rating']} | Lead: {s['lead_time_days']}d | {s['contact']}" for s in sups]
        return {"text": "Your suppliers:\n" + "\n".join(lines), "action_card": None}
    
    else:
        return {
            "text": (
                "I'm OpsBot, your Opsify ERP assistant. I can help you with:\n"
                "• **Stock levels** — ask 'What's my current inventory?'\n"
                "• **Orders & transactions** — ask 'Show recent sales'\n"
                "• **Suppliers** — ask 'Who are my suppliers?'\n"
                "• **Actions** — say 'Restock 50 units of Milk in Warehouse 1'\n\n"
                "*(Set GEMINI_API_KEY in your .env for full AI capabilities)*"
            ),
            "action_card": None,
        }
