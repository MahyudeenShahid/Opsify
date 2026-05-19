"""
System 1: Deep Chat Scan Agent
Scans full message history per chat to detect incomplete/unbooked orders.
Tracks per-chat scan cursors so each run only processes NEW messages.
"""
import os
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional


# ─── Firestore scan-state helpers ────────────────────────────────────────────

def _firestore_db():
    """Return Firestore client (reuses existing Firebase app). Returns None if unavailable."""
    try:
        import firebase_admin
        from firebase_admin import firestore as fs
        if not firebase_admin._apps:
            return None
        return fs.client()
    except Exception:
        return None


SCAN_STATE_COLLECTION = "scan_state"
SCAN_SESSIONS_COLLECTION = "scan_sessions"


def load_scan_cursors() -> Dict[str, Any]:
    """
    Load the last scanned cursor per chat_id from Firestore.
    Returns: { chat_id: {last_scanned_message_id, last_scanned_at_iso} }
    """
    db = _firestore_db()
    if not db:
        return {}
    try:
        docs = db.collection(SCAN_STATE_COLLECTION).stream()
        return {doc.id: doc.to_dict() for doc in docs}
    except Exception as e:
        print(f"[ScanState] load error: {e}")
        return {}


def save_scan_cursors(cursor_updates: Dict[str, Any]) -> None:
    """
    Persist updated cursors back to Firestore.
    cursor_updates: { chat_id: {last_scanned_message_id, last_scanned_at_iso, messages_scanned} }
    """
    db = _firestore_db()
    if not db:
        return
    try:
        batch = db.batch()
        for chat_id, data in cursor_updates.items():
            ref = db.collection(SCAN_STATE_COLLECTION).document(chat_id)
            batch.set(ref, data, merge=True)
        batch.commit()
    except Exception as e:
        print(f"[ScanState] save error: {e}")


def save_scan_session(session: Dict[str, Any]) -> None:
    """Append a new scan session record to Firestore."""
    db = _firestore_db()
    if not db:
        return
    try:
        db.collection(SCAN_SESSIONS_COLLECTION).add(session)
    except Exception as e:
        print(f"[ScanSession] save error: {e}")


def load_scan_sessions(limit: int = 10) -> List[Dict[str, Any]]:
    """Load recent scan session history."""
    db = _firestore_db()
    if not db:
        return []
    try:
        docs = (
            db.collection(SCAN_SESSIONS_COLLECTION)
            .order_by("scanned_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        return [{**doc.to_dict(), "session_id": doc.id} for doc in docs]
    except Exception as e:
        print(f"[ScanSession] load error: {e}")
        return []


def load_rejected_orders() -> set:
    """Load set of rejected order fingerprints from Firestore."""
    db = _firestore_db()
    if not db:
        return set()
    try:
        doc = db.collection(SCAN_STATE_COLLECTION).document("__rejected__").get()
        if doc.exists:
            return set(doc.to_dict().get("fingerprints", []))
        return set()
    except Exception:
        return set()


def save_rejected_order(fingerprint: str) -> None:
    """Mark an order fingerprint as rejected so it won't resurface."""
    db = _firestore_db()
    if not db:
        return
    try:
        ref = db.collection(SCAN_STATE_COLLECTION).document("__rejected__")
        doc = ref.get()
        existing = []
        if doc.exists:
            existing = doc.to_dict().get("fingerprints", [])
        if fingerprint not in existing:
            existing.append(fingerprint)
        ref.set({"fingerprints": existing}, merge=True)
    except Exception as e:
        print(f"[Rejected] save error: {e}")


def _order_fingerprint(order: Dict[str, Any]) -> str:
    """Create a stable fingerprint for deduplication."""
    return f"{order.get('chat_id')}|{order.get('type')}|{order.get('item')}|{order.get('quantity')}"


# ─── Core deep-scan logic ─────────────────────────────────────────────────────

def deep_scan_chats(
    chats_with_messages: List[Dict[str, Any]],
    scan_cursors: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Full deep-scan: reads all messages per chat (new ones only based on cursor).
    Uses Gemini AI if available, falls back to heuristics.

    Input:
      chats_with_messages: [
        {
          id: str,
          users: [{name, uid}],
          messages: [
            {id, text, senderId, senderName, timestamp_iso}
          ]
        }
      ]
      scan_cursors: loaded from Firestore (optional, auto-loaded if None)

    Returns:
      {
        detected_orders: [...],
        scan_metadata: {
          total_chats: int,
          total_messages_scanned: int,
          new_messages_scanned: int,
          per_chat: [{chat_id, contact_name, messages_scanned, is_incremental}],
        },
        cursor_updates: {chat_id: {...}}
      }
    """
    if scan_cursors is None:
        scan_cursors = load_scan_cursors()

    rejected = load_rejected_orders()
    api_key = os.environ.get("GEMINI_API_KEY")

    total_new_messages = 0
    per_chat_meta = []
    cursor_updates: Dict[str, Any] = {}
    all_detected: List[Dict[str, Any]] = []

    for chat in chats_with_messages:
        chat_id = chat.get("id", "")
        messages: List[Dict[str, Any]] = chat.get("messages", [])
        users = chat.get("users", [])
        contact_name = users[0].get("name", "Unknown") if users else "Unknown"

        # Determine which messages are new (after the cursor)
        cursor = scan_cursors.get(chat_id, {})
        last_ts = cursor.get("last_scanned_at_iso")

        new_messages = messages
        if last_ts:
            # Filter to messages AFTER the cursor timestamp
            new_messages = [
                m for m in messages
                if _ts_after(m.get("timestamp_iso", ""), last_ts)
            ]

        if not new_messages:
            per_chat_meta.append({
                "chat_id": chat_id,
                "contact_name": contact_name,
                "messages_scanned": 0,
                "total_messages": len(messages),
                "is_incremental": True,
                "status": "UP_TO_DATE",
            })
            continue

        total_new_messages += len(new_messages)
        per_chat_meta.append({
            "chat_id": chat_id,
            "contact_name": contact_name,
            "messages_scanned": len(new_messages),
            "total_messages": len(messages),
            "is_incremental": bool(last_ts),
            "status": "SCANNED",
        })

        # Build the message text block for AI
        msg_block = "\n".join(
            f"[{m.get('senderName', m.get('senderId', '?'))}] {m.get('text', '')}"
            for m in new_messages
        )

        # ── Try Gemini AI ─────────────────────────────────────────────────
        chat_orders = []
        if api_key:
            chat_orders = _gemini_scan(
                chat_id=chat_id,
                contact_name=contact_name,
                msg_block=msg_block,
                new_messages=new_messages,
                api_key=api_key,
            )
        if not chat_orders:
            chat_orders = _heuristic_scan(chat_id, contact_name, new_messages)

        # Filter out rejected fingerprints
        chat_orders = [
            o for o in chat_orders
            if _order_fingerprint(o) not in rejected
        ]
        all_detected.extend(chat_orders)

        # Update cursor to last message in this batch
        if new_messages:
            last_msg = new_messages[-1]
            cursor_updates[chat_id] = {
                "last_scanned_message_id": last_msg.get("id", ""),
                "last_scanned_at_iso": last_msg.get("timestamp_iso", datetime.now(timezone.utc).isoformat()),
                "messages_scanned": len(new_messages),
                "contact_name": contact_name,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

    return {
        "detected_orders": all_detected,
        "scan_metadata": {
            "total_chats": len(chats_with_messages),
            "total_messages_scanned": sum(c.get("messages_scanned", 0) for c in per_chat_meta),
            "new_messages_scanned": total_new_messages,
            "per_chat": per_chat_meta,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
        },
        "cursor_updates": cursor_updates,
    }


def _ts_after(ts: str, cursor_ts: str) -> bool:
    """Return True if ts is strictly after cursor_ts."""
    try:
        return ts > cursor_ts  # ISO-8601 strings compare correctly lexicographically
    except Exception:
        return True  # include if we can't compare


def _gemini_scan(
    chat_id: str,
    contact_name: str,
    msg_block: str,
    new_messages: List[Dict[str, Any]],
    api_key: str,
) -> List[Dict[str, Any]]:
    """Use Gemini to detect pending orders in the message block."""
    try:
        from google import genai

        client = genai.Client(api_key=api_key)

        prompt = f"""You are an intelligent ERP order-detection agent for a business.

CHAT ID: {chat_id}
CONTACT: {contact_name}

RECENT MESSAGES:
{msg_block}

Your task: Find any UNBOOKED purchase/sale/restock intents. An intent is "unbooked" if:
- A customer wants to BUY something but no confirmation/booking exists.
- A supplier proposes a RESTOCK but it hasn't been approved.
- Stock ADJUSTMENT is needed based on the conversation.

Return a JSON array (empty [] if nothing found). Each item must have:
{{
  "chat_id": "{chat_id}",
  "type": "SALE" | "RESTOCK" | "ADJUSTMENT",
  "contact_name": "{contact_name}",
  "item": "the product name",
  "quantity": (number),
  "value": (estimated total Rs value, number),
  "warehouse_id": 1,
  "reason": "one sentence explaining why this is unbooked",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "source_message": "the exact message that triggered this detection"
}}

Respond with ONLY a valid JSON array. No markdown, no explanation."""

        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[prompt],
        )
        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = "\n".join(text.split("\n")[1:-1])
        result = json.loads(text)
        if isinstance(result, dict):
            return [result]
        return result if isinstance(result, list) else []
    except Exception as e:
        print(f"[Gemini Scan] {chat_id}: {e}")
        return []


def _heuristic_scan(
    chat_id: str,
    contact_name: str,
    messages: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Keyword-based fallback scanner when Gemini is unavailable."""
    found = []
    name_lower = contact_name.lower()

    SALE_KEYWORDS = ["buy", "order", "need", "want", "purchase", "chahiye", "dena", "send"]
    RESTOCK_KEYWORDS = ["reorder", "stock", "supply", "restock", "out of", "low on", "replenish", "bhejo"]
    ITEMS = {
        "milk": ("Milk", 100.0),
        "wire": ("Wire", 45.0),
        "copper wire": ("Wire", 45.0),
        "pipe": ("Pipe", 200.0),
        "bread": ("Bread", 80.0),
    }

    for msg in messages:
        text = msg.get("text", "").lower()

        detected_item = None
        unit_price = 0.0
        for keyword, (item_name, price) in ITEMS.items():
            if keyword in text:
                detected_item = item_name
                unit_price = price
                break

        if not detected_item:
            continue

        # Extract quantity (look for numbers)
        import re
        nums = re.findall(r"\b(\d+(?:\.\d+)?)\b", text)
        qty = float(nums[0]) if nums else 1.0

        tx_type = "SALE"
        for kw in RESTOCK_KEYWORDS:
            if kw in text:
                tx_type = "RESTOCK"
                break

        found.append({
            "chat_id": chat_id,
            "type": tx_type,
            "contact_name": contact_name,
            "item": detected_item,
            "quantity": qty,
            "value": round(qty * unit_price, 2),
            "warehouse_id": 1,
            "reason": f"Heuristic detected: '{msg.get('text', '')[:80]}' in chat with {contact_name}",
            "confidence": "LOW",
            "source_message": msg.get("text", ""),
        })

    return found


# ─── Legacy single-message scan (kept for backward compat) ───────────────────

def scan_chats_for_incomplete_orders(chats_payload: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Legacy endpoint — wraps deep_scan_chats for backward compatibility.
    Treats each chat's 'messages' field as a single-entry list.
    """
    enriched = []
    for chat in chats_payload:
        msgs = chat.get("messages", [])
        enriched_msgs = [
            {"id": f"legacy_{i}", "text": m.get("text", ""), "senderName": "unknown", "timestamp_iso": ""}
            for i, m in enumerate(msgs)
        ]
        enriched.append({**chat, "messages": enriched_msgs})

    result = deep_scan_chats(enriched, scan_cursors={})
    return result["detected_orders"]
