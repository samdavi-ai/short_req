"""
conftest.py — Test configuration for Airport Surveillance backend.

Strategy:
- Set DATABASE_URL=sqlite:// before any app import
- Build a minimal FastAPI test app (no lifespan, no Redis subscriber)
- Create all tables once per session; delete rows between tests
- Override get_db to use the SQLite test engine
"""

import os

# ── Must be set BEFORE any app module is imported ────────────────────────────
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["DEBUG"] = "false"

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import Base and get_db AFTER env var is set
from app.core.database import Base, get_db
from app.api.routes import cameras, tracks, zones, visitors, employees, alerts, layouts, analytics, audit
from app.api.routes.auth import router as auth_router
from app.api.websocket import ws_router

# ─── SQLite in-memory test engine ────────────────────────────────────────────

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Minimal test FastAPI app (no lifespan, no Redis) ────────────────────────

test_app = FastAPI(title="Airport Surveillance - Test Mode")
test_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Wire all routers
test_app.include_router(auth_router,       prefix="/auth",       tags=["Auth"])
test_app.include_router(cameras.router,    prefix="/cameras",    tags=["Cameras"])
test_app.include_router(tracks.router,     prefix="/tracks",     tags=["Tracks"])
test_app.include_router(zones.router,      prefix="/zones",      tags=["Zones"])
test_app.include_router(visitors.router,   prefix="/visitors",   tags=["Visitors"])
test_app.include_router(employees.router,  prefix="/employees",  tags=["Employees"])
test_app.include_router(alerts.router,     prefix="/alerts",     tags=["Alerts"])
test_app.include_router(layouts.router,    prefix="/layouts",    tags=["Layouts"])
test_app.include_router(analytics.router,  prefix="/analytics",  tags=["Analytics"])
test_app.include_router(audit.router,      prefix="/audit",      tags=["Audit"])
test_app.include_router(ws_router,                               tags=["WebSockets"])

# Override DB dependency for every route
test_app.dependency_overrides[get_db] = override_get_db

# Minimal health endpoints
@test_app.get("/")
def root():
    return {"status": "ONLINE", "service": "Test", "version": "3.0", "environment": "test"}

@test_app.get("/health")
def health():
    return {"status": "healthy"}


# ─── Session fixture: create schema ONCE ─────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def db_schema():
    """Drop all + create all exactly once at session start."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


# ─── Function fixture: wipe data between every test ──────────────────────────

@pytest.fixture(autouse=True)
def clean_db():
    """Delete all rows after each test in reverse FK order."""
    yield
    with test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


# ─── Shared test client ───────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def api_client():
    return TestClient(test_app, raise_server_exceptions=True)
