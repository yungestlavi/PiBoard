"""Inizializzazione del database e cifratura dei token a riposo."""
from cryptography.fernet import Fernet
from sqlmodel import Session, SQLModel, create_engine

from .config import settings

engine = create_engine(
    f"sqlite:///{settings.db_path}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    from . import models  # noqa: F401  (registra le tabelle)
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


# --- Cifratura token (Fernet) ---------------------------------------------
def _load_key() -> bytes:
    path = settings.secret_key_path
    if not path.exists():
        path.write_bytes(Fernet.generate_key())
        path.chmod(0o600)
    return path.read_bytes()


_fernet = Fernet(_load_key())


def encrypt(text: str) -> str:
    return _fernet.encrypt(text.encode()).decode() if text else ""


def decrypt(token: str) -> str:
    return _fernet.decrypt(token.encode()).decode() if token else ""
