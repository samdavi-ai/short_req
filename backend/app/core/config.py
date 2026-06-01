from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os


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
    DATABASE_URL: str = "postgresql+psycopg://postgres:airportsecuritypass123@localhost:5432/airport_surveillance"

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Milvus ---
    MILVUS_HOST: str = "localhost"
    MILVUS_PORT: int = 19530

    # --- JWT Auth ---
    SECRET_KEY: str = "supersecretjwtkeyforairportsurveillancesystem"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # --- CORS ---
    ALLOWED_ORIGINS: list[str] = ["*"]

    # --- Camera Pipeline ---
    MAX_CAMERAS: int = 32
    INFERENCE_BATCH_SIZE: int = 4
    DETECTION_THRESHOLD: float = 0.5
    REID_THRESHOLD: float = 0.72
    FACE_MATCH_THRESHOLD: float = 0.68

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
