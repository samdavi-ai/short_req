from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os
import logging
import warnings

logger = logging.getLogger(__name__)

_DEFAULT_SECRET = "supersecretjwtkeyforairportsurveillancesystem"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Project ---
    PROJECT_NAME: str = "Airport Security Intelligent Surveillance & Tracking"
    ENVIRONMENT: str = "development"
    VERSION: str = "3.0"
    DEBUG: bool = False

    # --- Database ---
    # Defaults to SQLite for local development; override with PostgreSQL URL in production .env
    DATABASE_URL: str = "sqlite:///./db.sqlite3"

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Milvus ---
    MILVUS_HOST: str = "localhost"
    MILVUS_PORT: int = 19530

    # --- JWT Auth ---
    SECRET_KEY: str = _DEFAULT_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:80",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ]

    # --- Camera Pipeline ---
    MAX_CAMERAS: int = 32
    INFERENCE_BATCH_SIZE: int = 4
    DETECTION_THRESHOLD: float = 0.5
    REID_THRESHOLD: float = 0.72
    FACE_MATCH_THRESHOLD: float = 0.48

    # --- Vector Storage ---
    REID_COLLECTION_NAME: str = "airport_reid_vectors"
    FACE_COLLECTION_NAME: str = "airport_face_vectors"

    # --- Hardware ---
    USE_GPU: bool = True
    USE_TENSORRT: bool = True

    # --- File Storage ---
    ASSETS_DIR: str = "assets"
    CROPS_DIR: str = "assets/crops"
    ALERTS_DIR: str = "assets/alerts"
    LAYOUTS_DIR: str = "assets/layouts"


settings = Settings()

# Warn at startup if the default insecure secret key is still in use
if settings.SECRET_KEY == _DEFAULT_SECRET and settings.ENVIRONMENT != "development":
    warnings.warn(
        "⚠️  SECURITY WARNING: SECRET_KEY is set to the default insecure value. "
        "Set a strong SECRET_KEY in your .env file before deploying to production!",
        stacklevel=1,
    )
elif settings.SECRET_KEY == _DEFAULT_SECRET:
    logger.warning(
        "SECRET_KEY is using the default development value. "
        "Set a strong SECRET_KEY in .env before production deployment."
    )

