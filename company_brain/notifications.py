import requests
import asyncio
import uuid
from typing import Optional
from company_brain.firestore_inventory import get_push_token, _col
from firebase_store import utc_now

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"

COL_NOTIFICATIONS = "notifications"


def _infer_type(title: str) -> str:
    """Heuristically determine notification type from its title."""
    t = title.lower()
    if any(k in t for k in ["supplier", "vendor"]): return "supplier"
    if any(k in t for k in ["order", "sale", "dispatch"]): return "order"
    if any(k in t for k in ["stock", "product", "restock", "procurement"]): return "stock"
    if any(k in t for k in ["alert", "critical", "urgent", "warning"]): return "alert"
    if any(k in t for k in ["warehouse"]): return "procurement"
    return "system"


def _save_notification_record(user_id: str, title: str, body: str):
    """Persist a notification to Firestore so the app can display a history."""
    try:
        doc_id = str(uuid.uuid4())
        _col(user_id, COL_NOTIFICATIONS).document(doc_id).set({
            "id": doc_id,
            "title": title,
            "body": body,
            "type": _infer_type(title),
            "read": False,
            "created_at": utc_now().isoformat(),
        })
    except Exception as e:
        print(f"[Notifications] Failed to save record: {e}")


def send_push_notification(user_id: str, title: str, body: str, data: Optional[dict] = None):
    """
    Sends an Expo push notification synchronously and persists a record to Firestore.
    """
    # Always save a record regardless of push token availability
    _save_notification_record(user_id, title, body)

    token = get_push_token(user_id)
    if not token:
        return  # No token — record saved, skip push

    payload = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {}
    }

    try:
        response = requests.post(EXPO_PUSH_API_URL, json=payload, timeout=5)
        if response.status_code != 200:
            print(f"[Push] Failed to send to {user_id}: {response.text}")
    except Exception as e:
        print(f"[Push] Exception sending notification: {e}")


async def send_push_notification_async(user_id: str, title: str, body: str, data: Optional[dict] = None):
    """Async wrapper for push notifications to avoid blocking the event loop."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, send_push_notification, user_id, title, body, data)


def get_notifications(user_id: str, limit: int = 50) -> list:
    """Fetch notification history for a user (most recent first)."""
    try:
        docs = (
            _col(user_id, COL_NOTIFICATIONS)
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        return [d.to_dict() for d in docs]
    except Exception as e:
        print(f"[Notifications] Failed to fetch: {e}")
        return []


def mark_notification_read(user_id: str, notif_id: str):
    """Mark a single notification as read."""
    try:
        _col(user_id, COL_NOTIFICATIONS).document(notif_id).update({"read": True})
    except Exception as e:
        print(f"[Notifications] Failed to mark read: {e}")


def mark_all_notifications_read(user_id: str):
    """Mark all unread notifications as read (batch write)."""
    try:
        db = _col(user_id, COL_NOTIFICATIONS)
        docs = db.where("read", "==", False).stream()
        from firebase_store import get_firestore_client
        batch = get_firestore_client().batch()
        count = 0
        for doc in docs:
            batch.update(doc.reference, {"read": True})
            count += 1
        if count:
            batch.commit()
    except Exception as e:
        print(f"[Notifications] Failed to mark all read: {e}")
