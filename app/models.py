"""Schema del database SQLite (via SQLModel).

Quattro tabelle:
  - Account      : credenziali OAuth per ogni sorgente cloud (token cifrati)
  - Setting      : key/value per il theming globale (colori, font, CSS custom...)
  - Widget       : layout drag-and-drop in stile gridstack + stile per-widget
  - CachedPhoto  : indice delle immagini scaricate in /data/photos_cache
"""
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    provider: str = Field(index=True)          # "onedrive" | "google_photos" | "local"
    display_name: str = ""
    access_token_enc: str = ""                 # cifrato con Fernet
    refresh_token_enc: str = ""                # cifrato con Fernet
    expires_at: Optional[datetime] = None      # scadenza access token (UTC)
    extra: str = "{}"                          # stato extra provider-specifico (JSON)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Setting(SQLModel, table=True):
    """Store key/value per il Theming Engine.

    Esempi di chiavi: "palette", "fonts", "custom_css", "background",
    "glassmorphism". I valori sono JSON serializzati.
    """
    key: str = Field(primary_key=True)
    value: str = ""                            # valore JSON


class Widget(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    type: str                                  # clock | weather | calendar | rss | text
    x: int = 0
    y: int = 0
    w: int = 2
    h: int = 2
    z: int = 0
    enabled: bool = True
    # Config + stile del singolo widget (font, colore, opacità, blur, URL feed/GIF...)
    config: str = "{}"                         # JSON


class CachedPhoto(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    provider: str = Field(index=True)
    remote_id: str = Field(default="", index=True)  # id remoto, per deduplica
    filename: str                              # nome file dentro /data/photos_cache
    mime: str = "image/jpeg"
    width: int = 0
    height: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
