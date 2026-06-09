"""Connection manager per il WebSocket verso il frontend kiosk.

Quando l'admin cambia stile/widget o quando arrivano nuove foto in cache,
il backend invia un evento; il frontend (Fase 3) reagisce riapplicando gli
stili o ricaricando la lista immagini senza ricaricare la pagina.
"""
import asyncio
import json
from typing import Set

from fastapi import WebSocket


class EventBus:
    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def broadcast(self, event_type: str, payload: dict | None = None) -> None:
        message = json.dumps({"type": event_type, "payload": payload or {}})
        async with self._lock:
            dead = []
            for ws in self._clients:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self._clients.discard(ws)


bus = EventBus()
