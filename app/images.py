"""Elaborazione immagini con Pillow.

- Ridimensiona le foto troppo grandi al lato lungo `max_image_dim` (mantenendo
  alta qualita'): transizioni piu' fluide e meno memoria sul Pi.
- Genera una miniatura in /data/thumbs per velocizzare la galleria dell'admin.

Tutto e' "best effort": se Pillow non riesce (file non immagine, formato raro),
l'originale resta intatto e la miniatura semplicemente non viene creata.
"""
import logging

from .config import settings

log = logging.getLogger("images")

try:
    from PIL import Image
    _PIL = True
except Exception:  # Pillow non installato: si degrada senza errori
    _PIL = False


def _effective_max_dim() -> int:
    """Risoluzione massima: dal DB (impostata da admin) o dal default di config."""
    try:
        import json
        from sqlmodel import Session
        from .db import engine
        from .models import Setting
        with Session(engine) as s:
            row = s.get(Setting, "max_image_dim")
            if row and row.value:
                return int(json.loads(row.value))
    except Exception:
        pass
    return settings.max_image_dim


def process_image(filename: str) -> None:
    """Ridimensiona (se serve) il file in photos_cache e crea la miniatura."""
    if not _PIL:
        return
    src = settings.photos_cache / filename
    if not src.exists():
        return
    max_dim = _effective_max_dim()
    try:
        with Image.open(src) as im:
            is_animated = getattr(im, "is_animated", False)
            fmt = im.format

            # Ridimensiona solo immagini statiche (le GIF animate restano intatte)
            if not is_animated and max_dim and max(im.size) > max_dim:
                im.thumbnail((max_dim, max_dim), Image.LANCZOS)
                save_kwargs = {"quality": 90} if fmt in ("JPEG", "WEBP") else {}
                im.save(src, format=fmt, **save_kwargs)

            # Miniatura (sempre, dal primo frame)
            thumb = settings.thumbs_dir / filename
            tim = im.convert("RGB")
            tim.thumbnail((settings.thumb_dim, settings.thumb_dim), Image.LANCZOS)
            tim.save(thumb.with_suffix(".jpg"), format="JPEG", quality=80)
    except Exception as exc:
        log.info("process_image saltato per %s: %s", filename, exc)


def thumb_url(filename: str) -> str:
    """URL della miniatura se esiste, altrimenti l'immagine piena."""
    if (settings.thumbs_dir / filename).with_suffix(".jpg").exists():
        from pathlib import Path
        return f"/thumbs/{Path(filename).with_suffix('.jpg').name}"
    return f"/photos/{filename}"


def remove_thumb(filename: str) -> None:
    from pathlib import Path
    t = (settings.thumbs_dir / filename).with_suffix(".jpg")
    try:
        t.unlink(missing_ok=True)
    except OSError:
        pass
