import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
import httpx

from ..db import get_session
from ..config import settings
from ..models import Account
from .. import providers

router = APIRouter(prefix="/api/gdrive", tags=["gdrive"])

REDIRECT_URI = "http://localhost:8080/api/gdrive/callback"
SCOPES       = "https://www.googleapis.com/auth/drive.readonly"

@router.get("/connect")
def gdrive_connect():
    """Avvia il flusso OAuth per Google Drive."""
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.gdrive_client_id}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={SCOPES}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return RedirectResponse(url)

@router.get("/callback")
async def gdrive_callback(code: str, session: Session = Depends(get_session)):
    """Riceve il codice, richiede i token a Google e delega il salvataggio cifrato a providers.py."""
    data = {
        "code": code,
        "client_id": settings.gdrive_client_id,
        "client_secret": settings.gdrive_client_secret,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        r = await client.post(providers.GOOGLE_TOKEN, data=data)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="Impossibile riscattare il codice di autenticazione")
        tok = r.json()

    account = session.exec(
        select(Account).where(Account.provider == "gdrive")
    ).first() or Account(provider="gdrive", display_name="Google Drive")
    
    # Sfrutta la funzione nativa che cifra e calcola la scadenza
    providers._save_tokens(account, tok)
    
    session.add(account)
    session.commit()
    return RedirectResponse("/admin/?gdrive=ok")

@router.post("/sync")
async def gdrive_sync(session: Session = Depends(get_session)):
    """Avvia la sincronizzazione della cartella di Google Drive."""
    account = session.exec(select(Account).where(Account.provider == "gdrive")).first()
    if not account:
        raise HTTPException(status_code=400, detail="Google Drive non connesso")
    
    # Avvia la sincronizzazione nativa
    downloaded = await providers.gdrive_sync(account, session)
    return {"ok": True, "nuove_foto_scaricate": downloaded}