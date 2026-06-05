"""Applicazione FastAPI di PiBoard.

Avvio:
    uvicorn app.main:app --host 0.0.0.0 --port 8080

Espone:
    /                -> frontend kiosk (display)
    /admin           -> pannello di amministrazione
    /api/...         -> settings, widget, account, foto, dati widget, font
    /photos/...      -> immagini in cache (StaticFiles)
    /fonts/...       -> font custom caricati (StaticFiles)
    /ws              -> eventi realtime verso il frontend
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .routers import accounts, assets, gdrive, manage, photos, widget_data
from .config import settings
from .db import init_db
from .events import bus
from .routers import settings as settings_router
from .scheduler import start_scheduler


STATIC = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield


app = FastAPI(title="PiBoard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_cache_ui(request, call_next):
    """Evita che il browser mostri una versione vecchia di admin/display."""
    resp = await call_next(request)
    path = request.url.path
    if path == "/" or path.startswith("/admin") or path.endswith((".html", ".js", ".css")):
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp

# --- API ---
app.include_router(accounts.router)
app.include_router(settings_router.router)
app.include_router(photos.router)
app.include_router(widget_data.router)
app.include_router(assets.router)
app.include_router(manage.router)
app.include_router(gdrive.router)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await bus.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await bus.disconnect(ws)


# --- File statici (montati DOPO le rotte API) ---
app.mount("/photos", StaticFiles(directory=str(settings.photos_cache)), name="photos")
app.mount("/thumbs", StaticFiles(directory=str(settings.thumbs_dir)), name="thumbs")
app.mount("/fonts", StaticFiles(directory=str(settings.fonts_dir)), name="fonts")
app.mount("/admin", StaticFiles(directory=str(STATIC / "admin"), html=True), name="admin")
# Il display e' la catch-all su "/": va montato per ultimo.
app.mount("/", StaticFiles(directory=str(STATIC / "display"), html=True), name="display")
