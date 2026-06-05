"""Upload e gestione dei font custom.

I font caricati finiscono in /data/fonts (persistente, offline) e vengono
serviti staticamente su /fonts. Il display li usa via @font-face, cosi' i
caratteri personalizzati funzionano anche senza internet.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..auth import require_admin
from ..config import settings
from ..events import bus

router = APIRouter(prefix="/api/fonts", tags=["fonts"])

ALLOWED = {".ttf", ".otf", ".woff", ".woff2"}


@router.get("")
def list_fonts():
    files = sorted(
        f.name for f in settings.fonts_dir.iterdir()
        if f.suffix.lower() in ALLOWED
    )
    return [{"name": f, "url": f"/fonts/{f}"} for f in files]


@router.post("")
async def upload_font(file: UploadFile = File(...), _: None = Depends(require_admin)):
    suffix = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if suffix not in ALLOWED:
        raise HTTPException(400, "Formato non valido (ttf/otf/woff/woff2)")
    dest = settings.fonts_dir / file.filename
    with open(dest, "wb") as fh:
        fh.write(await file.read())
    await bus.broadcast("config", {"scope": "fonts"})
    return {"ok": True, "name": file.filename, "url": f"/fonts/{file.filename}"}
