import requests
import asyncio
from typing import Optional
from company_brain.firestore_inventory import get_push_token

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"

def send_push_notification(user_id: str, title: str, body: str, data: Optional[dict] = None):
    """
    Sends an Expo push notification synchronously.
    In a real production environment, this should be pushed to a message queue or background task.
    """
    token = get_push_token(user_id)
    if not token:
        return  # User has no push token

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
