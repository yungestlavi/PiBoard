"""Endpoint per collegare/scollegare gli account cloud dal pannello admin."""
import asyncio
import json

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select

from ..db import engine, get_session
from ..models import Account, Setting
from ..auth import require_admin
from .. import providers

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("")
def list_accounts(session: Session = Depends(get_session)):
    out = []
    for a in session.exec(select(Account)).all():
        out.append({
            "id": a.id,
            "provider": a.provider,
            "display_name": a.display_name,
            "connected": bool(a.access_token_enc),
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        })
    return out


@router.delete("/{account_id}")
def delete_account(account_id: int, session: Session = Depends(get_session), _: None = Depends(require_admin)):
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(404, "account non trovato")
    session.delete(account)
    session.commit()
    return {"ok": True}


# --- OneDrive: device code flow -------------------------------------------
@router.post("/onedrive/connect")
async def onedrive_connect(_: None = Depends(require_admin)):
    """Avvia il device flow. Il pannello mostra user_code + URL; il polling
    avviene in background e l'account compare in GET /api/accounts a fine auth."""
    flow = await providers.onedrive_start_device_flow()

    async def _poll():
        with Session(engine) as session:
            await providers.onedrive_poll_device_flow(
                flow["device_code"], int(flow.get("interval", 5)), session
            )

    asyncio.create_task(_poll())
    return {
        "verification_uri": flow.get("verification_uri"),
        "user_code": flow.get("user_code"),
        "message": flow.get("message"),
        "expires_in": flow.get("expires_in"),
    }


# --- Dropbox: cartella condivisa via link (zip, no login) -----------------
@router.post("/dropbox-link")
async def dropbox_link_connect(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin),
):
    """Collega una cartella Dropbox condivisa tramite link."""
    link = (payload.get("link") or "").strip()
    if not providers.is_dropbox_link(link):
        raise HTTPException(400, "Inserisci un link di Dropbox valido")

    account = session.exec(
        select(Account).where(Account.provider == "dropbox_link")
    ).first() or Account(provider="dropbox_link", display_name="Dropbox (cartella condivisa)")
    account.extra = json.dumps({"link": link})
    session.add(account)
    session.commit()
    session.refresh(account)

    try:
        n = await providers.dropbox_link_sync(account, session)
    except Exception as exc:
        raise HTTPException(
            400,
            "Cartella collegata ma la sincronizzazione e' fallita: assicurati che il "
            f"link sia condiviso con 'Chiunque con il link'. Dettaglio: {exc}",
        )
    return {"ok": True, "downloaded": n}


# --- Google Drive: cartella condivisa via link (API key, no login) --------
@router.post("/gdrive-link")
async def gdrive_link_connect(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin),
):
    """Collega una cartella Drive condivisa 'con chiunque abbia il link'."""
    folder_id = providers.extract_drive_folder_id(payload.get("link", ""))
    if not folder_id:
        raise HTTPException(400, "Link della cartella non valido")

    api_key = (payload.get("api_key") or "").strip()
    if api_key:
        row = session.get(Setting, "gdrive_api_key") or Setting(key="gdrive_api_key", value="")
        row.value = json.dumps(api_key)
        session.add(row)
        session.commit()

    account = session.exec(
        select(Account).where(Account.provider == "gdrive_link")
    ).first() or Account(provider="gdrive_link", display_name="Google Drive (cartella condivisa)")
    account.extra = json.dumps({"folder_id": folder_id, "link": payload.get("link", "")})
    session.add(account)
    session.commit()
    session.refresh(account)

    try:
        n = await providers.gdrive_link_sync(account, session)
    except Exception as exc:
        raise HTTPException(
            400,
            "Cartella collegata ma la sincronizzazione e' fallita: controlla che la "
            "cartella sia condivisa con 'chiunque abbia il link' e che la chiave API "
            f"sia valida. Dettaglio: {exc}",
        )
    return {"ok": True, "folder_id": folder_id, "downloaded": n}


# --- Google Photos: auth-code flow + Picker --------------------------------
@router.get("/google/connect")
def google_connect(_: None = Depends(require_admin)):
    return {"auth_url": providers.google_auth_url()}


@router.get("/google/callback")
async def google_callback(code: str, session: Session = Depends(get_session)):
    """Google reindirizza qui col code: salviamo i token, creiamo la sessione
    Picker e mostriamo all'utente il link per selezionare le foto."""
    account = await providers.google_exchange_code(code, session)
    picker = await providers.google_create_picker_session(account, session)
    picker_uri = picker.get("pickerUri", "")
    return HTMLResponse(
        f"""
        <html><body style="font-family:sans-serif;max-width:32rem;margin:3rem auto">
          <h2>Google Photos collegato</h2>
          <p>Ora seleziona le foto/album da mostrare nel photoframe:</p>
          <p><a href="{picker_uri}" target="_blank"
                style="font-size:1.1rem">Apri il selettore Google Photos &rarr;</a></p>
          <p>Quando hai finito di selezionare, le foto verranno scaricate
             automaticamente entro pochi minuti (o premi "Sincronizza ora"
             nel pannello).</p>
        </body></html>
        """
    )
