import os
import logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import QueuePool, StaticPool

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


def _build_engine():
    """
    Build the SQLAlchemy engine.
    Reads DATABASE_URL from the environment directly so that tests can
    set os.environ["DATABASE_URL"] = "sqlite://" before importing this module.
    """
    # Prefer raw env var so test overrides work before pydantic-settings loads
    db_url = os.environ.get("DATABASE_URL", "")

    if not db_url:
        # Fall back to pydantic settings (production path)
        from app.core.config import settings
        db_url = settings.DATABASE_URL

    # Ensure psycopg3 driver prefix for PostgreSQL (leave sqlite:// untouched)
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

    is_sqlite = db_url.startswith("sqlite")

    if is_sqlite:
        # SQLite: single shared in-memory connection (for tests)
        return create_engine(
            db_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    else:
        # PostgreSQL: full connection pool
        debug = os.environ.get("DEBUG", "false").lower() == "true"
        return create_engine(
            db_url,
            poolclass=QueuePool,
            pool_size=10,
            max_overflow=20,
            pool_timeout=30,
            pool_recycle=1800,
            pool_pre_ping=True,
            echo=debug,
        )


engine = _build_engine()


@event.listens_for(engine, "connect")
def on_connect(dbapi_connection, connection_record):
    logger.debug("Database connection established")


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    """
    Dependency that yields a database session per request
    and ensures it is properly closed afterward.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
