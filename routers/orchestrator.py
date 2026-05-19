import asyncio
import os
import base64
from typing import Optional, List, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from orchestrator.graph import AntigravityGraph
from tools.database import get_all_providers, query_mock_provider_db as _search_providers
from agents.chat_scan_agent import (
    scan_chats_for_incomplete_orders,
    deep_scan_chats,
    load_scan_cursors,
    load_scan_sessions,
    save_scan_cursors,
    save_scan_session,
    save_rejected_order,
)

router = APIRouter()
customer_graph = AntigravityGraph()

# ── Location → Warehouse routing map ────────────────────────────────────────
_LOCATION_WAREHOUSE: dict = {
    "clifton":      1, "dha":         1, "saddar":      1, "pechs":       1,
    "gulshan":      1, "nazimabad":   1, "korangi":     1, "lyari":       1,
    "north karachi":1, "malir":       1, "landhi":      1,
    "lahore":       2, "johar town":  2, "dha lahore":  2, "gulberg":     2,
}

def _resolve_warehouse(location: str) -> int:
    """Return the closest warehouse ID for a given location string."""
    return _LOCATION_WAREHOUSE.get(location.lower().strip(), 1)


# ── Schemas ──────────────────────────────────────────────────────────────────
class VoiceRequest(BaseModel):
    audio_base64: str          # Base64-encoded audio bytes (WAV/OGG/MP3)
    mime_type: str = "audio/wav"
    language_hint: str = "en"  # "en", "ur", "roman_urdu"

class OrderRequest(BaseModel):
    message: str

class OrderResponse(BaseModel):
    execution_status: str
    trace_logs: list[str]
    intent: dict
    provider: dict

class ChatMessage(BaseModel):
    text: str

class ChatUser(BaseModel):
    name: str

class ChatPayloadItem(BaseModel):
    id: str
    users: List[ChatUser] = []
    messages: List[ChatMessage] = []

class EventPayload(BaseModel):
    event_type: str
    payload: dict

class DeepScanMessage(BaseModel):
    id: str
    text: str
    senderId: str = ""
    senderName: str = ""
    timestamp_iso: str = ""

class DeepScanChatItem(BaseModel):
    id: str
    users: List[Any] = []
    messages: List[DeepScanMessage] = []

class RejectOrderRequest(BaseModel):
    chat_id: str
    item: str
    quantity: float
    type: str


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/api/orchestrate", response_model=OrderResponse)
async def orchestrate_order(req: OrderRequest):
    try:
        final_state = customer_graph.run(req.message)
        
        if final_state["execution_status"] == "BOOKED":
            intent = final_state.get("extracted_intent", {})
            cat = intent.get("category", "")
            
            if cat in ["Milk", "Wire", "Pipe", "Bread"]:
                qty_str = intent.get("quantity", "1")
                try:
                    qty = float(''.join(c for c in qty_str if c.isdigit() or c == '.'))
                except ValueError:
                    qty = 1.0
                    
                price = float(final_state["selected_provider"].get("price_per_hr", 150.0)) * qty
                
                # ── Smart warehouse routing: pick nearest depot to customer zone
                warehouse_id = _resolve_warehouse(intent.get("location", "Unknown"))

                # Emit to Event Broker to let System 2 handle the ledger/bidding!
                event = EventPayload(
                    event_type="CUSTOMER_ORDER_BOOKED",
                    payload={
                        "order_id": f"ORD-{int(asyncio.get_event_loop().time())}",
                        "item": cat,
                        "quantity": qty,
                        "total_value": price,
                        "provider_id": "System 1 Auth",
                        "warehouse_id": warehouse_id,
                        "customer_zone": intent.get("location", "Unknown"),
                        "customer_name": "Autonomous S1 Client",
                        "customer_phone": "+92-300-8271039",
                    }
                )
                
                # Publish event to broker directly
                from broker.event_broker import broker
                from company_brain.graph import CompanyBrainGraph
                
                await broker.publish(event.event_type, "External", event.payload)
                
                # Run the Company Brain graph autonomously
                company_graph = CompanyBrainGraph()
                try:
                    payload_str = event.model_dump_json()
                except AttributeError:
                    payload_str = event.json()
                asyncio.create_task(company_graph.run(payload_str))
        
        return OrderResponse(
            execution_status=final_state["execution_status"],
            trace_logs=final_state["agent_trace_logs"],
            intent=final_state["extracted_intent"],
            provider=final_state.get("selected_provider", {})
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/voice/transcribe")
async def transcribe_voice(req: VoiceRequest):
    """
    Voice-to-text transcription endpoint.
    Accepts base64-encoded audio (WAV/OGG/MP3) and returns the transcribed text.
    Uses Gemini's multimodal audio capability.
    Supports English, Urdu, and Roman Urdu (auto-detected).
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not configured. Set it in your .env file to enable voice transcription."
        )
    try:
        audio_bytes = base64.b64decode(req.audio_base64)
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        lang_prompt = {
            "ur":          "The audio may be in Urdu. Transcribe exactly.",
            "roman_urdu":  "The audio may be in Roman Urdu (Urdu written in Latin script). Transcribe exactly.",
        }.get(req.language_hint, "The audio may be in English, Urdu, or Roman Urdu. Transcribe exactly.")

        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=req.mime_type),
                f"{lang_prompt} Return only the raw transcription text, no formatting.",
            ],
        )
        transcript = response.text.strip()
        return {"status": "success", "transcript": transcript, "length": len(transcript)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.get("/api/providers")
def api_list_providers():
    """Return the full provider registry (33 providers, 7 categories, 9 zones)."""
    return get_all_providers()


@router.get("/api/providers/search")
def api_search_providers(category: str, location: str = "Unknown", max_results: int = 10):
    """
    Zone-aware provider search with adjacency fallback.
    Returns providers sorted by rating desc, price asc.
    """
    return _search_providers(location=location, category=category, max_results=max_results)


@router.get("/api/providers/categories")
def api_provider_categories():
    """Return all available service categories."""
    from tools.database import MOCK_PROVIDERS
    cats = sorted({p["category"] for p in MOCK_PROVIDERS})
    return {"categories": cats}


@router.post("/api/agents/scan-chats")
def api_scan_chats(req: List[ChatPayloadItem]):
    try:
        # Convert Pydantic models to plain dicts for the agent
        raw = [item.model_dump() if hasattr(item, 'model_dump') else item.dict() for item in req]
        return scan_chats_for_incomplete_orders(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/agents/deep-scan")
def api_deep_scan_chats(req: List[DeepScanChatItem]):
    """
    System 1 deep scan: reads ALL messages per chat (since last cursor).
    Persists scan state to Firestore so next run only processes new messages.
    """
    import datetime
    try:
        raw_chats = []
        for chat in req:
            d = chat.model_dump() if hasattr(chat, 'model_dump') else chat.dict()
            raw_chats.append(d)

        # Load existing cursors from Firestore
        cursors = load_scan_cursors()

        # Run deep scan
        result = deep_scan_chats(raw_chats, scan_cursors=cursors)

        # Persist updated cursors
        if result["cursor_updates"]:
            save_scan_cursors(result["cursor_updates"])

        # Save scan session record
        metadata = result["scan_metadata"]
        session = {
            "scanned_at": metadata["scanned_at"],
            "total_chats": metadata["total_chats"],
            "total_messages_scanned": metadata["total_messages_scanned"],
            "new_messages_scanned": metadata["new_messages_scanned"],
            "orders_detected": len(result["detected_orders"]),
            "per_chat": metadata["per_chat"],
        }
        save_scan_session(session)

        return {
            "status": "ok",
            "detected_orders": result["detected_orders"],
            "scan_metadata": metadata,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/agents/scan-state")
def api_get_scan_state():
    """Return all scan cursors + recent scan sessions."""
    try:
        cursors = load_scan_cursors()
        sessions = load_scan_sessions(limit=15)
        return {"cursors": cursors, "sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/agents/reject-order")
def api_reject_order(req: RejectOrderRequest):
    """Mark a detected order as rejected so it won't resurface in future scans."""
    try:
        fingerprint = f"{req.chat_id}|{req.type}|{req.item}|{req.quantity}"
        save_rejected_order(fingerprint)
        return {"status": "ok", "fingerprint": fingerprint}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
