"""Endpoint del Theming Engine e del layout dei widget.

Le PUT salvano e notificano il frontend via WebSocket ("config"), cosi' la
dashboard riapplica stili/posizioni in tempo reale senza ricaricare.
"""
import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import require_admin
from ..db import get_session
from ..events import bus
from ..models import Setting, Widget

router = APIRouter(prefix="/api", tags=["settings"])


# --- Theming globale (key/value JSON) --------------------------------------
@router.get("/settings")
def get_settings(session: Session = Depends(get_session)):
    return {s.key: json.loads(s.value or "null") for s in session.exec(select(Setting)).all()}


@router.put("/settings")
async def put_settings(payload: dict, session: Session = Depends(get_session), _: None = Depends(require_admin)):
    for key, value in payload.items():
        row = session.get(Setting, key) or Setting(key=key)
        row.value = json.dumps(value)
        session.add(row)
    session.commit()
    await bus.broadcast("config", {"scope": "settings"})
    return {"ok": True}


# --- Widget (layout gridstack + stile per-widget) --------------------------
class WidgetIn(BaseModel):
    id: int | None = None
    type: str
    x: int = 0
    y: int = 0
    w: int = 2
    h: int = 2
    z: int = 0
    enabled: bool = True
    config: dict = {}


@router.get("/widgets")
def get_widgets(session: Session = Depends(get_session)):
    rows = session.exec(select(Widget)).all()
    return [
        {
            "id": w.id, "type": w.type, "x": w.x, "y": w.y, "w": w.w, "h": w.h,
            "z": w.z, "enabled": w.enabled, "config": json.loads(w.config or "{}"),
        }
        for w in rows
    ]


@router.put("/widgets")
async def replace_widgets(widgets: list[WidgetIn], session: Session = Depends(get_session), _: None = Depends(require_admin)):
    """Sostituisce l'intero layout (semplice e robusto per il drag-and-drop)."""
    for old in session.exec(select(Widget)).all():
        session.delete(old)
    for w in widgets:
        session.add(Widget(
            type=w.type, x=w.x, y=w.y, w=w.w, h=w.h, z=w.z,
            enabled=w.enabled, config=json.dumps(w.config),
        ))
    session.commit()
    await bus.broadcast("config", {"scope": "widgets"})
    return {"ok": True}
