import asyncio
import json
from typing import List
from fastapi import WebSocket

class EventBroker:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.subscribers = [] # Internal python callbacks if needed

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    def subscribe(self, callback):
        """Register a python async callback to listen to events."""
        self.subscribers.append(callback)

    async def publish(self, event_type: str, source: str, payload: dict):
        """Broadcast event to all WebSocket clients and internal subscribers."""
        event = {
            "event_type": event_type,
            "source": source,
            "payload": payload
        }
        event_json = json.dumps(event)
        
        # Broadcast to external WebSocket clients (e.g., React Native Trace Terminal)
        for connection in self.active_connections:
            try:
                await connection.send_text(event_json)
            except Exception as e:
                print(f"WebSocket error: {e}")
                
        # Trigger internal Python subscribers (e.g., Company Brain Graph)
        for callback in self.subscribers:
            # We wrap in asyncio.create_task so a slow subscriber doesn't block the broker
            asyncio.create_task(callback(event_json))

# Global singleton broker instance
broker = EventBroker()
