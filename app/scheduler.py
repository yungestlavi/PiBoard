"""Job periodici: sincronizza le sorgenti foto e rinnova i token in scadenza.

Usa APScheduler (AsyncIOScheduler) per girare dentro l'event loop di FastAPI.
A ogni ciclo: per ogni account chiama la sua funzione di sync (che gestisce da
sola il refresh del token) e, se sono arrivate foto nuove, notifica il frontend.
"""
import logging
import time

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select

from .config import settings
from .db import engine
from .events import bus
from .models import Account
from .providers import SYNC_FUNCS

log = logging.getLogger("scheduler")
scheduler = AsyncIOScheduler()

# Stato osservabile dall'admin (GET /api/status)
STATUS = {"started": time.time(), "last_sync": None, "last_error": None}


async def sync_all_sources() -> None:
    total = 0
    errors = []
    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
        for account in accounts:
            func = SYNC_FUNCS.get(account.provider)
            if not func:
                continue
            try:
                total += await func(account, session)
            except Exception as exc:  # un provider rotto non deve fermare gli altri
                log.warning("sync %s fallito: %s", account.provider, exc)
                errors.append(f"{account.provider}: {exc}")
        # La sorgente locale puo' esistere anche senza un record Account.
        if settings.local_photos_path and not any(a.provider == "local" for a in accounts):
            try:
                total += await SYNC_FUNCS["local"](Account(provider="local"), session)
            except Exception as exc:
                log.warning("sync local fallito: %s", exc)
                errors.append(f"local: {exc}")

    STATUS["last_sync"] = time.strftime("%Y-%m-%d %H:%M")
    STATUS["last_error"] = "; ".join(errors) if errors else None
    if total:
        await bus.broadcast("photos", {"added": total})


def start_scheduler() -> None:
    scheduler.add_job(
        sync_all_sources,
        "interval",
        minutes=settings.photo_sync_minutes,
        next_run_time=None,  # parte al primo intervallo; usa /api/photos/sync per forzare
        id="sync_all_sources",
        replace_existing=True,
    )
    scheduler.start()
