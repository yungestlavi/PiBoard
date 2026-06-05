"""Endpoint per la cache foto: lista, upload, cancellazione, sync manuale.

Le immagini caricate restano a piena risoluzione (al massimo ridimensionate al
lato lungo configurato, mantenendo alta qualita'); per la galleria admin si usa
una miniatura. Gli endpoint che modificano richiedono l'admin (se c'e' password.)
"""
import json
import shutil
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from ..auth import require_admin
from ..config import settings
from ..db import get_session
from ..events import bus
from ..images import process_image, remove_thumb, thumb_url
from ..models import CachedPhoto, Setting
from ..scheduler import sync_all_sources

router = APIRouter(prefix="/api/photos", tags=["photos"])

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


@router.get("")
def list_photos(session: Session = Depends(get_session)):
    rows = session.exec(select(CachedPhoto).order_by(CachedPhoto.created_at.desc())).all()
    rotate_row = session.get(Setting, "rotate_seconds")
    try:
        rotate = int(json.loads(rotate_row.value)) if rotate_row and rotate_row.value else settings.rotate_seconds
    except (ValueError, TypeError):
        rotate = settings.rotate_seconds
    return {
        "rotate_seconds": rotate,
        "photos": [
            {
                "id": p.id,
                "url": f"/photos/{p.filename}",
                "thumb": thumb_url(p.filename),
                "mime": p.mime,
                "provider": p.provider,
            }
            for p in rows
        ],
    }


@router.post("/upload")
async def upload_photos(
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin),
):
    """Carica una o piu' immagini dall'admin."""
    saved = 0
    for f in files:
        ext = ("." + f.filename.rsplit(".", 1)[-1].lower()) if "." in (f.filename or "") else ""
        if ext not in IMAGE_EXT:
            continue
        filename = f"upload_{uuid.uuid4().hex}{ext}"
        dest = settings.photos_cache / filename
        with open(dest, "wb") as out:
            shutil.copyfileobj(f.file, out)
        session.add(CachedPhoto(
            provider="upload", remote_id=filename, filename=filename,
            mime=f.content_type or "image/jpeg",
        ))
        session.commit()
        process_image(filename)   # ridimensiona se enorme + crea miniatura
        saved += 1
    await bus.broadcast("photos", {"added": saved})
    return {"ok": True, "added": saved}


@router.delete("/{photo_id}")
async def delete_photo(
    photo_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(require_admin),
):
    p = session.get(CachedPhoto, photo_id)
    if not p:
        raise HTTPException(404, "foto non trovata")
    (settings.photos_cache / p.filename).unlink(missing_ok=True)
    remove_thumb(p.filename)
    session.delete(p)
    session.commit()
    await bus.broadcast("photos", {})
    return {"ok": True}


@router.post("/reprocess")
async def reprocess(
    session: Session = Depends(get_session), _: None = Depends(require_admin)
):
    """Riapplica la risoluzione massima alle foto gia' in cache (solo riduce)."""
    n = 0
    for p in session.exec(select(CachedPhoto)).all():
        process_image(p.filename)
        n += 1
    await bus.broadcast("photos", {})
    return {"ok": True, "count": n}


@router.post("/sync")
async def trigger_sync(_: None = Depends(require_admin)):
    """Forza subito una sincronizzazione di tutte le sorgenti."""
    await sync_all_sources()
    return {"ok": True}
