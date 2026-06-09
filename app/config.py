"""Configurazione centrale dell'applicazione.

Tutti i valori sono sovrascrivibili da variabili d'ambiente o da un file .env
(vedi .env.example). I percorsi di persistenza puntano di default a /data, la
partizione che in Fase 4 escluderemo dall'OverlayFS di sola lettura.
"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Rete / runtime ---
    host: str = "0.0.0.0"
    port: int = 8080
    data_dir: Path = Path("/data")

    # --- OneDrive / Microsoft Graph (device code flow) ---
    # Registra un'app "public client" su Entra (Azure) e incolla qui l'ID.
    ms_client_id: str = ""
    ms_tenant: str = "common"
    ms_scopes: str = "Files.Read offline_access"
    onedrive_folder: str = "/Photos"  # cartella nella OneDrive dell'utente

    # --- Google Photos (Picker API, auth-code flow) ---
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8080/api/accounts/google/callback"
    google_picker_scope: str = (
        "https://www.googleapis.com/auth/photospicker.mediaitems.readonly"
    )

    gdrive_client_id:     str = ""
    gdrive_client_secret: str = ""
    gdrive_folder_name:   str = "PiBoard"
    # Chiave API per leggere una CARTELLA CONDIVISA via link (senza login).
    gdrive_api_key:       str = ""

    # --- Sorgente locale / NAS (montata via fstab Samba/NFS) ---
    local_photos_path: str = ""  # es. /mnt/nas/foto ; vuoto = disabilitata

    # --- Sicurezza / immagini ---
    admin_password: str = ""          # vuoto = admin senza password (come prima)
    max_image_dim: int = 2560         # lato lungo max (0 = nessun ridimensionamento)
    thumb_dim: int = 360              # lato lungo delle miniature per la galleria

    # --- Cache e rotazione foto ---
    photo_sync_minutes: int = 30      # ogni quanto sincronizzare le sorgenti
    rotate_seconds: int = 60          # cadenza di rotazione (usata dal frontend)
    max_cache_items: int = 300        # tetto di foto in cache (FIFO)
    http_timeout: float = 30.0

    @property
    def db_path(self) -> Path:
        return self.data_dir / "db" / "dashboard.db"

    @property
    def photos_cache(self) -> Path:
        return self.data_dir / "photos_cache"

    @property
    def secret_key_path(self) -> Path:
        return self.data_dir / "db" / "secret.key"

    @property
    def fonts_dir(self) -> Path:
        return self.data_dir / "fonts"

    @property
    def thumbs_dir(self) -> Path:
        return self.data_dir / "thumbs"


settings = Settings()

# Garantisce l'esistenza delle directory persistenti all'avvio.
settings.db_path.parent.mkdir(parents=True, exist_ok=True)
settings.photos_cache.mkdir(parents=True, exist_ok=True)
settings.fonts_dir.mkdir(parents=True, exist_ok=True)
settings.thumbs_dir.mkdir(parents=True, exist_ok=True)
