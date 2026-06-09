"""Login admin, stato del sistema e backup/ripristino della configurazione."""
import json
import time

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from sqlmodel import Session, select

from ..auth import COOKIE, MAX_AGE, auth_required, is_authed, make_token, require_admin
from ..config import settings
from ..db import get_session
from ..events import bus
from ..models import Account, CachedPhoto, Setting, Widget
from ..scheduler import STATUS

router = APIRouter(prefix="/api", tags=["manage"])


# --- Autenticazione -------------------------------------------------------
@router.get("/me")
def me(request: Request):
    return {"required": auth_required(), "authed": is_authed(request)}


@router.post("/login")
def login(response: Response, payload: dict = Body(...)):
    if not auth_required():
        return {"ok": True}
    if payload.get("password") == settings.admin_password:
        response.set_cookie(
            COOKIE, make_token(), httponly=True, max_age=MAX_AGE, samesite="lax"
        )
        return {"ok": True}
    raise HTTPException(401, "Password errata")


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"ok": True}


# --- Stato del sistema ----------------------------------------------------
@router.get("/status")
def status(session: Session = Depends(get_session)):
    return {
        "uptime_s": int(time.time() - STATUS["started"]),
        "last_sync": STATUS["last_sync"],
        "last_error": STATUS["last_error"],
        "photos": len(session.exec(select(CachedPhoto)).all()),
        "accounts": len(session.exec(select(Account)).all()),
        "widgets": len(session.exec(select(Widget)).all()),
    }


# --- Backup / ripristino della configurazione -----------------------------
@router.get("/backup")
def backup(session: Session = Depends(get_session), _: None = Depends(require_admin)):
    return {
        "settings": {s.key: json.loads(s.value or "null") for s in session.exec(select(Setting)).all()},
        "widgets": [
            {"type": w.type, "x": w.x, "y": w.y, "w": w.w, "h": w.h, "z": w.z,
             "enabled": w.enabled, "config": json.loads(w.config or "{}")}
            for w in session.exec(select(Widget)).all()
        ],
    }


@router.post("/restore")
async def restore(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin),
):
    """Sostituisce impostazioni e widget con quelli del backup (non tocca foto/account)."""
    for old in session.exec(select(Setting)).all():
        session.delete(old)
    for key, value in (payload.get("settings") or {}).items():
        session.add(Setting(key=key, value=json.dumps(value)))
    for old in session.exec(select(Widget)).all():
        session.delete(old)
    for w in (payload.get("widgets") or []):
        session.add(Widget(
            type=w["type"], x=w.get("x", 0), y=w.get("y", 0), w=w.get("w", 3),
            h=w.get("h", 3), z=w.get("z", 0), enabled=w.get("enabled", True),
            config=json.dumps(w.get("config", {})),
        ))
    session.commit()
    await bus.broadcast("config", {"scope": "restore"})
    return {"ok": True}
