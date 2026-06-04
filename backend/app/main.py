"""
Airport Security Intelligent Surveillance & Tracking — FastAPI Application Entry Point
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_client import make_asgi_app, Counter, Histogram
import os

from app.api.routes import cameras, tracks, zones, visitors, employees, alerts, layouts, analytics, enrollment
from app.api.routes.auth import router as auth_router
from app.api.websocket import ws_router, redis_subscriber
from app.core.config import settings
from app.core.database import engine, Base

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ─── App Lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # ── STARTUP ──
    logger.info("🚀 Starting Airport Surveillance Backend v%s", settings.VERSION)

    # Ensure asset directories exist
    for directory in [
        settings.ASSETS_DIR,
        settings.CROPS_DIR,
        settings.ALERTS_DIR,
        settings.LAYOUTS_DIR,
        "assets/visitors",
        "assets/employees",
    ]:
        os.makedirs(directory, exist_ok=True)

    # Create all DB tables (checkfirst avoids 'already exists' on restart)
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine, checkfirst=True)
    logger.info("Database tables ready ✓")

    # Start Redis → WebSocket subscriber as background task
    logger.info("Starting Redis pub/sub subscriber...")
    subscriber_task = asyncio.create_task(redis_subscriber())
    logger.info("WebSocket event relay started ✓")

    yield  # Application runs here

    # ── SHUTDOWN ──
    logger.info("Shutting down Airport Surveillance Backend...")
    subscriber_task.cancel()
    try:
        await subscriber_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutdown complete.")


# ─── FastAPI Application ───────────────────────────────────────────────────────

app = FastAPI(
    title="Airport Security Intelligent Surveillance & Tracking API",
    description=(
        "Backend API powering live video analytics, cross-camera Re-ID tracking, "
        "employee break compliance monitoring, visitor watchlist management, and "
        "building layout configuration."
    ),
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Prometheus Metrics ────────────────────────────────────────────────────────

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["method", "endpoint", "status"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request processing latency",
    ["method", "endpoint"],
)

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    latency = time.perf_counter() - start

    # Normalize path to avoid high-cardinality label explosion
    path = request.url.path
    REQUEST_COUNT.labels(method=request.method, endpoint=path, status=response.status_code).inc()
    REQUEST_LATENCY.labels(method=request.method, endpoint=path).observe(latency)

    return response

# Mount Prometheus metrics endpoint
prometheus_app = make_asgi_app()
app.mount("/metrics", prometheus_app)

# ─── Static Assets ─────────────────────────────────────────────────────────────

os.makedirs(settings.ASSETS_DIR, exist_ok=True)
app.mount("/assets", StaticFiles(directory=settings.ASSETS_DIR), name="assets")

# ─── API Routes ───────────────────────────────────────────────────────────────

API_PREFIX = ""  # Routes are at root for now; add /api/v1 prefix later if needed

app.include_router(auth_router,      prefix="/auth",      tags=["Auth"])
app.include_router(cameras.router,   prefix="/cameras",   tags=["Cameras"])
app.include_router(tracks.router,    prefix="/tracks",    tags=["Tracks"])
app.include_router(zones.router,     prefix="/zones",     tags=["Zones"])
app.include_router(visitors.router,  prefix="/visitors",  tags=["Visitors"])
app.include_router(employees.router, prefix="/employees", tags=["Employees"])
app.include_router(alerts.router,    prefix="/alerts",    tags=["Alerts"])
app.include_router(layouts.router,   prefix="/layouts",   tags=["Layouts"])
app.include_router(analytics.router,    prefix="/analytics",    tags=["Analytics"])
app.include_router(enrollment.router,   prefix="/enrollment",   tags=["Enrollment"])
app.include_router(ws_router,                                   tags=["WebSockets"])


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ONLINE",
        "service": "Airport Surveillance & Tracking Backend",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }

@app.get("/health", tags=["Health"])
def health_check():
    """Lightweight health probe for Docker Compose health checks."""
    return {"status": "healthy"}
