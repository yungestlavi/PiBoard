"""Provider delle sorgenti foto.

Tre implementazioni dietro un'interfaccia comune:

  onedrive       -> Microsoft Graph, device-code flow (ideale per appliance
                    headless: nessun redirect URI da registrare). Sync
                    automatico e perpetuo di una cartella OneDrive.
  google_photos  -> Picker API. Dopo le restrizioni di marzo 2025 e' l'unica
                    via per la libreria utente: l'utente seleziona le foto,
                    noi le scarichiamo subito in cache (resta tutto offline).
  local          -> cartella locale o NAS montata via fstab (Samba/NFS). La
                    sorgente piu' resiliente: nessuna dipendenza da internet.

Ogni token viene salvato cifrato; il refresh e' automatico (vedi token_*).
"""
from __future__ import annotations

import hashlib
import json
import mimetypes
import re
import shutil
import uuid
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from sqlmodel import Session, select

from .config import settings
from .db import decrypt, encrypt
from .images import process_image
from .models import Account, CachedPhoto, Setting

# --------------------------------------------------------------------------
# Endpoint
# --------------------------------------------------------------------------
GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
PICKER_BASE = "https://photospicker.googleapis.com/v1"
DRIVE_BASE = "https://www.googleapis.com/drive/v3"
MS_AUTHORITY = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0"
MS_DEVICECODE = MS_AUTHORITY + "/devicecode"
MS_TOKEN = MS_AUTHORITY + "/token"
GRAPH_ROOT = "https://graph.microsoft.com/v1.0"

IMAGE_MIMES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"}


# --------------------------------------------------------------------------
# Utilita' comuni
# --------------------------------------------------------------------------
def _save_tokens(account: Account, tok: dict) -> None:
    """Aggiorna access/refresh token e scadenza da una risposta OAuth."""
    if tok.get("access_token"):
        account.access_token_enc = encrypt(tok["access_token"])
    if tok.get("refresh_token"):  # Google non lo rimanda sempre: conserviamo il vecchio
        account.refresh_token_enc = encrypt(tok["refresh_token"])
    if tok.get("expires_in"):
        account.expires_at = datetime.utcnow() + timedelta(seconds=int(tok["expires_in"]) - 60)


def _ext_for(mime: str, fallback: str = ".jpg") -> str:
    return mimetypes.guess_extension(mime) or fallback


async def _download_to_cache(
    client: httpx.AsyncClient,
    url: str,
    provider: str,
    remote_id: str,
    mime: str,
    session: Session,
    headers: dict | None = None,
) -> bool:
    """Scarica un'immagine in /data/photos_cache se non e' gia' presente."""
    exists = session.exec(
        select(CachedPhoto).where(
            CachedPhoto.provider == provider, CachedPhoto.remote_id == remote_id
        )
    ).first()
    if exists:
        return False

    filename = f"{provider}_{uuid.uuid4().hex}{_ext_for(mime)}"
    dest: Path = settings.photos_cache / filename
    async with client.stream("GET", url, headers=headers or {}) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as fh:
            async for chunk in resp.aiter_bytes(64 * 1024):
                fh.write(chunk)

    session.add(
        CachedPhoto(provider=provider, remote_id=remote_id, filename=filename, mime=mime)
    )
    session.commit()
    process_image(filename)
    return True


def _prune_cache(session: Session) -> None:
    """Tiene al massimo max_cache_items foto SCARICATE DAL CLOUD (FIFO).

    Le foto caricate dall'admin ('upload') e quelle locali/NAS ('local') sono
    curate dall'utente: non vengono mai cancellate automaticamente.
    """
    rows = session.exec(
        select(CachedPhoto)
        .where(CachedPhoto.provider.in_(["onedrive", "google_photos", "gdrive", "gdrive_link", "dropbox_link"]))
        .order_by(CachedPhoto.created_at.desc())
    ).all()
    for old in rows[settings.max_cache_items:]:
        try:
            (settings.photos_cache / old.filename).unlink(missing_ok=True)
        except OSError:
            pass
        session.delete(old)
    session.commit()


# --------------------------------------------------------------------------
# OneDrive / Microsoft Graph  (device code flow)
# --------------------------------------------------------------------------
async def onedrive_start_device_flow() -> dict:
    """Avvia il device-code flow: torna user_code + verification_uri da mostrare."""
    url = MS_DEVICECODE.format(tenant=settings.ms_tenant)
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        r = await client.post(
            url, data={"client_id": settings.ms_client_id, "scope": settings.ms_scopes}
        )
        r.raise_for_status()
        return r.json()


async def onedrive_poll_device_flow(device_code: str, interval: int, session: Session) -> Account | None:
    """Esegue il polling finche' l'utente non autorizza, poi salva l'account."""
    import asyncio

    url = MS_TOKEN.format(tenant=settings.ms_tenant)
    data = {
        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
        "client_id": settings.ms_client_id,
        "device_code": device_code,
    }
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        while True:
            await asyncio.sleep(interval)
            r = await client.post(url, data=data)
            tok = r.json()
            if r.status_code == 200:
                account = Account(provider="onedrive", display_name="OneDrive")
                _save_tokens(account, tok)
                session.add(account)
                session.commit()
                session.refresh(account)
                return account
            if tok.get("error") in ("authorization_pending", "slow_down"):
                continue
            return None  # expired_token / declined / errore


async def _onedrive_token(account: Account, session: Session) -> str:
    """Restituisce un access token valido, rinnovandolo se scaduto."""
    if account.expires_at and account.expires_at > datetime.utcnow():
        return decrypt(account.access_token_enc)

    url = MS_TOKEN.format(tenant=settings.ms_tenant)
    data = {
        "grant_type": "refresh_token",
        "client_id": settings.ms_client_id,
        "scope": settings.ms_scopes,
        "refresh_token": decrypt(account.refresh_token_enc),
    }
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        r = await client.post(url, data=data)
        r.raise_for_status()
        _save_tokens(account, r.json())
    session.add(account)
    session.commit()
    return decrypt(account.access_token_enc)


async def onedrive_sync(account: Account, session: Session) -> int:
    """Scarica le nuove immagini dalla cartella OneDrive configurata."""
    token = await _onedrive_token(account, session)
    headers = {"Authorization": f"Bearer {token}"}
    folder = settings.onedrive_folder.strip("/")
    url = f"{GRAPH_ROOT}/me/drive/root:/{folder}:/children?$top=200"
    downloaded = 0
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        while url:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            data = r.json()
            for item in data.get("value", []):
                file_info = item.get("file") or {}
                mime = file_info.get("mimeType", "")
                dl = item.get("@microsoft.graph.downloadUrl")  # URL pre-autenticato
                if mime in IMAGE_MIMES and dl:
                    if await _download_to_cache(client, dl, "onedrive", item["id"], mime, session):
                        downloaded += 1
            url = data.get("@odata.nextLink")
    _prune_cache(session)
    return downloaded


# --------------------------------------------------------------------------
# Google Photos  (Picker API, auth-code flow)
# --------------------------------------------------------------------------
def google_auth_url() -> str:
    from urllib.parse import urlencode

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": settings.google_picker_scope,
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{GOOGLE_AUTH}?{urlencode(params)}"


async def google_exchange_code(code: str, session: Session) -> Account:
    """Scambia il code per i token e crea/aggiorna l'account Google Photos."""
    data = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        r = await client.post(GOOGLE_TOKEN, data=data)
        r.raise_for_status()
        tok = r.json()
    account = session.exec(
        select(Account).where(Account.provider == "google_photos")
    ).first() or Account(provider="google_photos", display_name="Google Photos")
    _save_tokens(account, tok)
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


async def _google_token(account: Account, session: Session) -> str:
    if account.expires_at and account.expires_at > datetime.utcnow():
        return decrypt(account.access_token_enc)
    data = {
        "grant_type": "refresh_token",
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "refresh_token": decrypt(account.refresh_token_enc),
    }
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        r = await client.post(GOOGLE_TOKEN, data=data)
        r.raise_for_status()
        _save_tokens(account, r.json())
    session.add(account)
    session.commit()
    return decrypt(account.access_token_enc)


async def google_create_picker_session(account: Account, session: Session) -> dict:
    """Crea una sessione Picker: torna il pickerUri che l'utente deve aprire."""
    token = await _google_token(account, session)
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        r = await client.post(f"{PICKER_BASE}/sessions", headers=headers, json={})
        r.raise_for_status()
        data = r.json()
    extra = json.loads(account.extra or "{}")
    extra["picker_session_id"] = data.get("id")
    account.extra = json.dumps(extra)
    session.add(account)
    session.commit()
    return data  # contiene id, pickerUri, pollingConfig, mediaItemsSet


async def google_sync(account: Account, session: Session) -> int:
    """Se l'utente ha selezionato foto nella sessione Picker, le scarica.

    Le baseUrl del Picker richiedono il Bearer token e scadono in ~60 min,
    ma noi salviamo subito i byte: una volta in cache restano disponibili
    anche offline. Quando l'utente vuole nuove foto, ricrea una sessione.
    """
    extra = json.loads(account.extra or "{}")
    sid = extra.get("picker_session_id")
    if not sid:
        return 0

    token = await _google_token(account, session)
    headers = {"Authorization": f"Bearer {token}"}
    downloaded = 0
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        s = await client.get(f"{PICKER_BASE}/sessions/{sid}", headers=headers)
        if s.status_code != 200 or not s.json().get("mediaItemsSet"):
            return 0  # l'utente non ha ancora finito di selezionare

        page_token = None
        while True:
            params = {"sessionId": sid, "pageSize": 100}
            if page_token:
                params["pageToken"] = page_token
            r = await client.get(f"{PICKER_BASE}/mediaItems", headers=headers, params=params)
            r.raise_for_status()
            data = r.json()
            for item in data.get("mediaItems", []):
                mf = item.get("mediaFile", {})
                mime = mf.get("mimeType", "image/jpeg")
                base_url = mf.get("baseUrl")
                if base_url and mime in IMAGE_MIMES:
                    # "=d" scarica il file originale; serve l'header Authorization
                    ok = await _download_to_cache(
                        client, base_url + "=d", "google_photos", item["id"], mime, session, headers
                    )
                    if ok:
                        downloaded += 1
            page_token = data.get("nextPageToken")
            if not page_token:
                break
    _prune_cache(session)
    return downloaded


# --------------------------------------------------------------------------
# Cartella locale / NAS
# --------------------------------------------------------------------------
async def local_sync(account: Account, session: Session) -> int:
    """Copia in cache le immagini da una cartella locale o NAS (LOCAL_PHOTOS_PATH).

    Copia sempre i file (mai hard link): process_image potrebbe ridimensionarli
    e non vogliamo toccare gli originali.
    """
    if not settings.local_photos_path:
        return 0
    base = Path(settings.local_photos_path)
    if not base.exists():
        return 0
    existing = {
        p.remote_id
        for p in session.exec(
            select(CachedPhoto).where(CachedPhoto.provider == "local")
        ).all()
    }
    downloaded = 0
    for path in sorted(base.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {
            ".jpg", ".jpeg", ".png", ".gif", ".webp"
        }:
            continue
        remote_id = str(path.relative_to(base))
        if remote_id in existing:
            continue
        filename = f"local_{uuid.uuid4().hex}{path.suffix.lower()}"
        dest = settings.photos_cache / filename
        shutil.copy2(path, dest)
        mime = mimetypes.guess_type(str(path))[0] or "image/jpeg"
        session.add(CachedPhoto(
            provider="local", remote_id=remote_id, filename=filename, mime=mime,
        ))
        session.commit()
        process_image(filename)
        downloaded += 1
    _prune_cache(session)
    return downloaded


# --------------------------------------------------------------------------
# Google Drive (sincronizzazione di una cartella per nome)
# --------------------------------------------------------------------------
async def _gdrive_token(account: Account, session: Session) -> str:
    """Restituisce un access token valido per Google Drive, rinnovandolo se scaduto."""
    if account.expires_at and account.expires_at > datetime.utcnow():
        return decrypt(account.access_token_enc)
    data = {
        "grant_type": "refresh_token",
        "client_id": settings.gdrive_client_id,
        "client_secret": settings.gdrive_client_secret,
        "refresh_token": decrypt(account.refresh_token_enc),
    }
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        r = await client.post(GOOGLE_TOKEN, data=data)
        r.raise_for_status()
        _save_tokens(account, r.json())
    session.add(account)
    session.commit()
    return decrypt(account.access_token_enc)

async def gdrive_sync(account: Account, session: Session) -> int:
    """Scarica le immagini da una cartella specifica di Google Drive sfruttando la cache della dashboard."""
    token = await _gdrive_token(account, session)
    headers = {"Authorization": f"Bearer {token}"}
    folder_name = settings.gdrive_folder_name
    downloaded = 0

    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        # 1. Trova l'ID della cartella cercandola per nome
        r = await client.get(
            f"{DRIVE_BASE}/files",
            params={
                "q": f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                "fields": "files(id,name)"
            },
            headers={**headers}
        )
        r.raise_for_status()
        folders = r.json().get("files", [])
        if not folders:
            return 0  # Cartella non trovata, esce silenziosamente
        
        folder_id = folders[0]["id"]

        # 2. Ottieni i file dentro quella cartella
        r = await client.get(
            f"{DRIVE_BASE}/files",
            params={
                "q": f"'{folder_id}' in parents and mimeType contains 'image/' and trashed=false",
                "fields": "files(id,name,mimeType)",
                "pageSize": 100
            },
            headers={**headers}
        )
        r.raise_for_status()
        files = r.json().get("files", [])

        # 3. Scarica usando la pipeline nativa del progetto (_download_to_cache)
        for item in files:
            mime = item.get("mimeType", "image/jpeg")
            if mime in IMAGE_MIMES:
                # L'URL di download richiede il parametro alt=media
                dl_url = f"{DRIVE_BASE}/files/{item['id']}?alt=media"
                if await _download_to_cache(client, dl_url, "gdrive", item["id"], mime, session, headers):
                    downloaded += 1

    _prune_cache(session)
    return downloaded


# --------------------------------------------------------------------------
# Google Drive via LINK CONDIVISO + API key (senza login, auto-sync)
# --------------------------------------------------------------------------
def extract_drive_folder_id(link: str) -> str:
    """Ricava l'ID cartella da un link di Google Drive (o accetta l'ID nudo)."""
    link = (link or "").strip()
    m = re.search(r"/folders/([A-Za-z0-9_-]+)", link)
    if m:
        return m.group(1)
    m = re.search(r"[?&]id=([A-Za-z0-9_-]+)", link)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{20,}", link):
        return link
    return ""


def _gdrive_api_key(session: Session) -> str:
    """API key: prima dal DB (impostata da admin), poi dal .env."""
    row = session.get(Setting, "gdrive_api_key")
    if row and row.value:
        try:
            return json.loads(row.value) or ""
        except Exception:
            return ""
    return settings.gdrive_api_key


async def gdrive_link_sync(account: Account, session: Session) -> int:
    """Scarica le immagini di una cartella Drive condivisa 'con chiunque abbia il link'.

    Usa solo una API key: niente OAuth, niente token che scadono. Se aggiungi
    foto alla cartella, alla sincronizzazione successiva compaiono da sole.
    """
    extra = json.loads(account.extra or "{}")
    folder_id = extra.get("folder_id", "")
    api_key = _gdrive_api_key(session)
    if not folder_id or not api_key:
        return 0

    downloaded = 0
    page_token = None
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        while True:
            params = {
                "q": f"'{folder_id}' in parents and trashed=false and mimeType contains 'image/'",
                "key": api_key,
                "fields": "nextPageToken,files(id,name,mimeType)",
                "pageSize": 1000,
                "supportsAllDrives": "true",
                "includeItemsFromAllDrives": "true",
            }
            if page_token:
                params["pageToken"] = page_token
            r = await client.get(f"{DRIVE_BASE}/files", params=params)
            r.raise_for_status()
            data = r.json()
            for item in data.get("files", []):
                mime = item.get("mimeType", "")
                if mime in IMAGE_MIMES:
                    dl = f"{DRIVE_BASE}/files/{item['id']}?alt=media&key={api_key}&supportsAllDrives=true"
                    if await _download_to_cache(client, dl, "gdrive_link", item["id"], mime, session):
                        downloaded += 1
            page_token = data.get("nextPageToken")
            if not page_token:
                break

    _prune_cache(session)
    return downloaded


# --------------------------------------------------------------------------
# Dropbox via LINK CONDIVISO (zip della cartella, senza login)
# --------------------------------------------------------------------------
_DROPBOX_IMG_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}


def _dropbox_force_download(link: str) -> str:
    """Forza il download diretto del link Dropbox (dl=1)."""
    parts = urlparse(link.strip())
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    q.pop("dl", None)
    q.pop("raw", None)
    q["dl"] = "1"
    return urlunparse(parts._replace(query=urlencode(q)))


def is_dropbox_link(link: str) -> bool:
    return "dropbox.com/" in (link or "")


def _cache_bytes(provider: str, remote_id: str, ext: str, data, session: Session) -> bool:
    """Salva in cache un'immagine gia' scaricata (da uno stream/file)."""
    exists = session.exec(
        select(CachedPhoto).where(
            CachedPhoto.provider == provider, CachedPhoto.remote_id == remote_id
        )
    ).first()
    if exists:
        return False
    filename = f"{provider}_{uuid.uuid4().hex}{ext}"
    dest: Path = settings.photos_cache / filename
    with open(dest, "wb") as out:
        shutil.copyfileobj(data, out)
    mime = mimetypes.guess_type(filename)[0] or "image/jpeg"
    session.add(
        CachedPhoto(provider=provider, remote_id=remote_id, filename=filename, mime=mime)
    )
    session.commit()
    process_image(filename)
    return True


def _ingest_dropbox_zip(zip_path: Path, session: Session) -> int:
    """Estrae le immagini da uno zip di cartella Dropbox, saltando i duplicati."""
    n = 0
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            ext = Path(info.filename).suffix.lower()
            if ext not in _DROPBOX_IMG_EXT:
                continue
            with zf.open(info) as src:
                if _cache_bytes("dropbox_link", info.filename, ext, src, session):
                    n += 1
    return n


async def dropbox_link_sync(account: Account, session: Session) -> int:
    """Sincronizza una cartella Dropbox condivisa via link (scarica lo zip).

    Niente login ne' token: basta che il link sia condiviso. Se aggiungi foto
    alla cartella, alla sincronizzazione successiva compaiono da sole.
    """
    extra = json.loads(account.extra or "{}")
    link = extra.get("link", "")
    if not link:
        return 0

    url = _dropbox_force_download(link)
    tmp = settings.photos_cache.parent / f"_dropbox_{uuid.uuid4().hex}.bin"
    hasher = hashlib.sha256()
    try:
        async with httpx.AsyncClient(
            timeout=settings.http_timeout, follow_redirects=True
        ) as client:
            async with client.stream("GET", url) as resp:
                resp.raise_for_status()
                with open(tmp, "wb") as fh:
                    async for chunk in resp.aiter_bytes(64 * 1024):
                        fh.write(chunk)
                        hasher.update(chunk)

        # Niente da fare se il contenuto non e' cambiato dall'ultima volta.
        digest = hasher.hexdigest()
        if extra.get("last_hash") == digest:
            return 0

        with open(tmp, "rb") as fh:
            head = fh.read(4)
        if head[:2] == b"PK":  # zip = cartella
            n = _ingest_dropbox_zip(tmp, session)
        elif head[:3] == b"\xff\xd8\xff" or head[:4] in (b"\x89PNG", b"GIF8", b"RIFF"):
            ext = mimetypes.guess_extension(
                "image/jpeg" if head[:3] == b"\xff\xd8\xff" else "image/png"
            ) or ".jpg"
            with open(tmp, "rb") as fh:
                n = 1 if _cache_bytes("dropbox_link", link, ext, fh, session) else 0
        else:
            raise RuntimeError(
                "il link non restituisce un file/zip scaricabile: controlla che sia "
                "condiviso pubblicamente ('Chiunque con il link')"
            )

        extra["last_hash"] = digest
        account.extra = json.dumps(extra)
        session.add(account)
        session.commit()
        _prune_cache(session)
        return n
    finally:
        tmp.unlink(missing_ok=True)


# Registro: provider -> funzione di sync
SYNC_FUNCS = {
    "onedrive": onedrive_sync,
    "google_photos": google_sync,
    "local": local_sync,
    "gdrive": gdrive_sync,
    "gdrive_link": gdrive_link_sync,
    "dropbox_link": dropbox_link_sync,
}