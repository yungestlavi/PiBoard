"""Autenticazione del pannello admin.

Se ADMIN_PASSWORD e' vuota, l'autenticazione e' disattivata (comportamento
come prima). Se impostata, gli endpoint che modificano qualcosa richiedono un
cookie firmato (HMAC con la chiave segreta gia' presente in /data/db).
Le GET di sola lettura restano aperte: servono al display in modalita' kiosk,
che non puo' fare login.
"""
import hashlib
import hmac
import time

from fastapi import HTTPException, Request

from .config import settings
from .db import _load_key

SECRET = _load_key()
COOKIE = "sd_auth"
MAX_AGE = 30 * 86400  # 30 giorni


def _sign(ts: str) -> str:
    sig = hmac.new(SECRET, ts.encode(), hashlib.sha256).hexdigest()
    return f"{ts}.{sig}"


def make_token() -> str:
    return _sign(str(int(time.time())))


def valid_token(token: str) -> bool:
    try:
        ts = token.rsplit(".", 1)[0]
        if not hmac.compare_digest(_sign(ts), token):
            return False
        return (int(time.time()) - int(ts)) < MAX_AGE
    except Exception:
        return False


def auth_required() -> bool:
    return bool(settings.admin_password)


def is_authed(request: Request) -> bool:
    if not auth_required():
        return True
    return valid_token(request.cookies.get(COOKIE, ""))


def require_admin(request: Request) -> None:
    """Dependency per gli endpoint che modificano dati."""
    if not is_authed(request):
        raise HTTPException(status_code=401, detail="Autenticazione richiesta")
