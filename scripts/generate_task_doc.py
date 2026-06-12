"""
Generate comprehensive project task completion documentation as Excel file.
Airport Intelligent Security & Surveillance Platform — ALPHA-2
"""
import openpyxl
from openpyxl.styles import (
    PatternFill, Font, Alignment, Border, Side, GradientFill
)
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference, PieChart
from openpyxl.chart.series import DataPoint
from datetime import datetime
import os

# ─── Color Palette ─────────────────────────────────────────────────────────────
DARK_BG       = "0D1117"
TEAL          = "00F0FF"
GREEN         = "10B981"
GREEN_LIGHT   = "D1FAE5"
AMBER         = "F59E0B"
AMBER_LIGHT   = "FEF3C7"
RED           = "EF4444"
RED_LIGHT     = "FEE2E2"
BLUE          = "3B82F6"
BLUE_LIGHT    = "DBEAFE"
PURPLE        = "8B5CF6"
PURPLE_LIGHT  = "EDE9FE"
GRAY_DARK     = "1E2736"
GRAY_MID      = "374151"
GRAY_LIGHT    = "F3F4F6"
WHITE         = "FFFFFF"
HEADER_BG     = "1A2535"
SUBHEADER_BG  = "243045"

def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def font(bold=False, color=WHITE, size=11, name="Calibri"):
    return Font(bold=bold, color=color, size=size, name=name)

def border_thin():
    thin = Side(style="thin", color="374151")
    return Border(left=thin, right=thin, top=thin, bottom=thin)

def align(h="left", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

def style_header_row(ws, row, start_col, end_col, bg=HEADER_BG, fg=TEAL, font_size=12, bold=True):
    for col in range(start_col, end_col + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = fill(bg)
        cell.font = font(bold=bold, color=fg, size=font_size)
        cell.alignment = align("center", "center")
        cell.border = border_thin()

def style_data_row(ws, row, start_col, end_col, bg=DARK_BG, fg=WHITE, wrap=True, h_align="left"):
    for col in range(start_col, end_col + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = fill(bg)
        cell.font = font(bold=False, color=fg, size=10)
        cell.alignment = align(h_align, "center", wrap)
        cell.border = border_thin()

# ══════════════════════════════════════════════════════════════════════════════
# DATA
# ══════════════════════════════════════════════════════════════════════════════

PROJECT_INFO = {
    "Project Name":   "Airport Intelligent Security & Surveillance Platform",
    "Codename":       "Chairman Requirement — ALPHA-2",
    "Domain":         "Airport Security & Operations",
    "Version":        "v3.0",
    "Environment":    "Development → Staging",
    "Date":           datetime.now().strftime("%d %B %Y"),
    "Branch":         "feat/video-testing-pipeline",
    "Tech Stack":     "FastAPI + SQLAlchemy + Redis | React + TypeScript + Zustand | SQLite→PostgreSQL",
}

# Status codes: DONE, IN_PROGRESS, PARTIAL, PENDING, BLOCKED
TASKS = [
    # ── INFRASTRUCTURE ─────────────────────────────────────────────────────────
    {
        "Module": "Infrastructure",
        "Feature": "FastAPI Backend",
        "Task": "Core app setup with lifespan, CORS, router mounting",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "All routers mounted: auth, cameras, alerts, analytics, visitors, employees, zones, layouts, sites, buildings, simulation, enrollment, tracks, websocket",
        "Completion": 100,
    },
    {
        "Module": "Infrastructure",
        "Feature": "Database (SQLAlchemy + SQLite)",
        "Task": "ORM models, migration (Alembic), SessionLocal, engine",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "SQLite for dev; DATABASE_URL env var overrides to PostgreSQL in production. All models defined in models.py.",
        "Completion": 100,
    },
    {
        "Module": "Infrastructure",
        "Feature": "Redis Pub/Sub",
        "Task": "Async Redis subscriber bridge to WebSocket",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "lifespan-managed subscriber task. ConnectionManager handles multi-client WS fan-out.",
        "Completion": 100,
    },
    {
        "Module": "Infrastructure",
        "Feature": "JWT Auth",
        "Task": "Login, token creation, decode, bcrypt password verification",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Jose JWT, bcrypt, 24h expiry. Security warning added for default SECRET_KEY.",
        "Completion": 100,
    },
    {
        "Module": "Infrastructure",
        "Feature": "Celery Workers",
        "Task": "Async task queue: purge stale tracks, break compliance, camera health, analytics export",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "All 4 tasks implemented with real DB queries. Beat schedule configured. Replace hardcoded CSV fixed.",
        "Completion": 100,
    },
    {
        "Module": "Infrastructure",
        "Feature": "Config & Environment",
        "Task": "Pydantic settings, .env support, secure defaults",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Default DB now SQLite. CORS restricted to localhost. SECRET_KEY warning added. .env.example needed.",
        "Completion": 90,
    },
    {
        "Module": "Infrastructure",
        "Feature": ".env.example",
        "Task": "Document all required environment variables for deployment",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "Need to create .env.example with all variables: DATABASE_URL, REDIS_URL, SECRET_KEY, ALLOWED_ORIGINS etc.",
        "Completion": 0,
    },
    {
        "Module": "Infrastructure",
        "Feature": "Docker Deployment",
        "Task": "docker-compose.yml, Dockerfiles, Nginx config for production",
        "Status": "PARTIAL",
        "Priority": "High",
        "Notes": "docker-compose.yml exists but needs validation. Production Dockerfile and Nginx config for frontend not finalized.",
        "Completion": 40,
    },

    # ── BACKEND API ────────────────────────────────────────────────────────────
    {
        "Module": "Backend API",
        "Feature": "Auth Routes",
        "Task": "POST /auth/login — form-based OAuth2 login",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Returns access_token, username, role, full_name.",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Camera Management",
        "Task": "CRUD cameras, bulk position update",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "GET/POST/PATCH/DELETE /cameras/, POST /cameras/positions/bulk",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Alert Management",
        "Task": "List, acknowledge single and bulk alerts",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Fixed URL mismatch: /alerts/bulk-acknowledge now matches frontend. Unacknowledged count endpoint working.",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Analytics Routes",
        "Task": "Stats, dashboard aggregation, entry/exit counts",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Fixed func.date_trunc (PG-only) → Python-side hourly bucketing. Works on SQLite+PostgreSQL.",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Visitor Management",
        "Task": "CRUD visitors, watchlist, status update, photo upload",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Full CRUD, watchlist query, photo upload endpoint, status (CLEARED/FLAGGED/WATCHLISTED).",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Employee Management",
        "Task": "CRUD employees, breaks start/end, compliance check",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Added /break-compliance alias to match frontend. Break start/end/history/compliance all implemented.",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Zone Management",
        "Task": "CRUD zones with coordinates, types, dwell thresholds",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "All zone types: RESTRICTED, DWELL, LOUNGE, WORK, ENTRY_EXIT, PUBLIC.",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Layout Management",
        "Task": "List/create/update layouts, upload floor plan images",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Image upload saves to assets/layouts/. Layout linked to floor number.",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Sites & Buildings",
        "Task": "CRUD sites, buildings, floors — hierarchical airport structure",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Full hierarchy: Site → Building → FloorLevel. Auto-creates ground floor on building creation.",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Simulation Engine",
        "Task": "Publish events, start/stop/tick simulation session",
        "Status": "DONE",
        "Priority": "Medium",
        "Notes": "Redis pub/sub bridge for simulation events. Used by frontend simulator to test live tracking without physical cameras.",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Track Management",
        "Task": "Active track query, track service, purge stale",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "GET /tracks/active returns current active tracks. Celery task purges tracks older than 24h.",
        "Completion": 100,
    },
    {
        "Module": "Backend API",
        "Feature": "Face Enrollment",
        "Task": "Upload + process face photo, extract embedding, store",
        "Status": "PARTIAL",
        "Priority": "High",
        "Notes": "Backend endpoint implemented (lazy-loads FaceEmbedder/FaceDetector). Requires processing/ workers with cv2, face detection model. Works when processing module present.",
        "Completion": 70,
    },

    # ── FRONTEND ───────────────────────────────────────────────────────────────
    {
        "Module": "Frontend",
        "Feature": "Auth Flow",
        "Task": "Login page, JWT token storage, auth state, demo mode",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Boot terminal animation, real login + demo mode. Token stored in Zustand store.",
        "Completion": 100,
    },
    {
        "Module": "Frontend",
        "Feature": "Dashboard",
        "Task": "KPI cards, alert feed, track count, analytics",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Fetches from /analytics/stats, /analytics/, /alerts/. Live WebSocket data reflected in counts.",
        "Completion": 100,
    },
    {
        "Module": "Frontend",
        "Feature": "Layout Editor",
        "Task": "Multi-floor canvas, camera drag-drop, zone drawing, FOV cones",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Konva-based canvas. Camera placement, FOV cone rendering, zone polygon drawing, 3D building overview mode.",
        "Completion": 95,
    },
    {
        "Module": "Frontend",
        "Feature": "Blueprint Dot Positions",
        "Task": "Fix camera dots appearing outside floor plan bounds (x=0,y=0 default)",
        "Status": "IN_PROGRESS",
        "Priority": "Critical",
        "Notes": "Cameras seeded with x=0,y=0 defaults appear at canvas origin (outside floor plan). Reseed DB with accurate blueprint_data.json coordinates.",
        "Completion": 20,
    },
    {
        "Module": "Frontend",
        "Feature": "Live Feeds",
        "Task": "Real camera list from DB, webcam preview, track overlay",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Now uses real cameras from store (fallback to demo only when DB empty). Removed hardcoded DEMO_CAMERAS from production path.",
        "Completion": 100,
    },
    {
        "Module": "Frontend",
        "Feature": "Alerts Page",
        "Task": "Alert list, acknowledge, filter, bulk acknowledge",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Fixed bulk acknowledge URL mismatch. Real-time via WebSocket. Filter by type/severity/ack status.",
        "Completion": 100,
    },
    {
        "Module": "Frontend",
        "Feature": "Visitors Page",
        "Task": "Visitor list, add/edit, photo upload, status management",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Full CRUD, photo upload, watchlist tab, status badge (CLEARED/FLAGGED/WATCHLISTED).",
        "Completion": 100,
    },
    {
        "Module": "Frontend",
        "Feature": "Employees Page",
        "Task": "Employee list, add/edit, break compliance dashboard",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Break compliance view shows overdue/on-break status. Real-time polling.",
        "Completion": 100,
    },
    {
        "Module": "Frontend",
        "Feature": "Camera Manager",
        "Task": "Add/edit/delete cameras, RTSP URL, floor assignment",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Full CRUD with modal form. Camera list with status badge.",
        "Completion": 100,
    },
    {
        "Module": "Frontend",
        "Feature": "Live Person Tracking Dots",
        "Task": "Render real-time person position dots on layout canvas from WebSocket tracks",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "WebSocket track data is received in store but not yet rendered as moving dots on the floor plan canvas in LayoutEditor.",
        "Completion": 10,
    },
    {
        "Module": "Frontend",
        "Feature": "Zone Occupancy Live Count",
        "Task": "Show live count badge per zone on the layout map",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "Zones are drawn but no live occupancy counter from WebSocket data is displayed on them.",
        "Completion": 5,
    },
    {
        "Module": "Frontend",
        "Feature": "Dwell Heatmap Overlay",
        "Task": "Toggle overlay showing dwell time heatmap on floor plan",
        "Status": "PENDING",
        "Priority": "Medium",
        "Notes": "Spec: green=short dwell, red=long dwell. Requires dwell_time data from track service.",
        "Completion": 0,
    },
    {
        "Module": "Frontend",
        "Feature": "Path Replay",
        "Task": "Click a tracked person → show their path across cameras/floors",
        "Status": "PENDING",
        "Priority": "Medium",
        "Notes": "Requires track history API endpoint and path drawing on canvas.",
        "Completion": 0,
    },
    {
        "Module": "Frontend",
        "Feature": "WebSocket Real-time State",
        "Task": "Live alerts, track count, camera status via WebSocket",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Full WebSocket bridge via Redis pub/sub. Store updates on every event. Topbar badge counts live.",
        "Completion": 100,
    },
    {
        "Module": "Frontend",
        "Feature": "Simulation Panel",
        "Task": "Trigger simulation events, speed control, seed config",
        "Status": "DONE",
        "Priority": "Medium",
        "Notes": "Frontend simulator engine drives events through /simulation/ API to Redis → WebSocket.",
        "Completion": 100,
    },

    # ── DATA / SEEDING ─────────────────────────────────────────────────────────
    {
        "Module": "Data & Seeding",
        "Feature": "Seed Script (seed_alpha2.py)",
        "Task": "Seed admin user, site, building, floors, cameras, zones",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Creates ALPHA-2 site+building+floors. Inserts default cameras with x=0,y=0. Admin user created.",
        "Completion": 100,
    },
    {
        "Module": "Data & Seeding",
        "Feature": "Accurate Blueprint Data",
        "Task": "Pixel-accurate camera+zone positions from DXF blueprints for all 3 floors",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "accurateBlueprintData.ts has 38 cameras + 60+ zones with pixel coords. Exported to blueprint_data.json.",
        "Completion": 100,
    },
    {
        "Module": "Data & Seeding",
        "Feature": "Reseed from JSON (reseed_from_json.py)",
        "Task": "Apply pixel-accurate blueprint_data.json to database",
        "Status": "IN_PROGRESS",
        "Priority": "Critical",
        "Notes": "Script ready. Must run against db.sqlite3 to fix the camera dot position issue. Needs to be run before demo.",
        "Completion": 80,
    },
    {
        "Module": "Data & Seeding",
        "Feature": "Export Accurate Data (export_accurate_data.ts)",
        "Task": "TypeScript script to re-export blueprint data to JSON",
        "Status": "DONE",
        "Priority": "Medium",
        "Notes": "Generates blueprint_data.json from accurateBlueprintData.ts. Already run — output exists at scripts/blueprint_data.json.",
        "Completion": 100,
    },

    # ── SECURITY & PRODUCTION ──────────────────────────────────────────────────
    {
        "Module": "Security & Production",
        "Feature": "Production Config",
        "Task": "Default DB SQLite, SECRET_KEY warning, CORS restricted",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Config now safe for local dev. Production requires .env with DATABASE_URL (PostgreSQL), strong SECRET_KEY, ALLOWED_ORIGINS.",
        "Completion": 100,
    },
    {
        "Module": "Security & Production",
        "Feature": "API URL Consistency",
        "Task": "Fix all frontend↔backend URL mismatches",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Fixed: /alerts/bulk-acknowledge, /employees/break-compliance alias added, bulkAcknowledge body format corrected.",
        "Completion": 100,
    },
    {
        "Module": "Security & Production",
        "Feature": "Dead Code Cleanup",
        "Task": "Remove stray files, hardcoded data, dead modules",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Deleted: Alpha2GroundFloor.tsx, cc.txt, dump.rdb, yolov8n.pt, base.py, Project_Task_Completion.csv/xlsx. .gitignore updated.",
        "Completion": 100,
    },
    {
        "Module": "Security & Production",
        "Feature": "Analytics SQLite Compatibility",
        "Task": "Replace PostgreSQL-only func.date_trunc with cross-DB solution",
        "Status": "DONE",
        "Priority": "Critical",
        "Notes": "Entry/exit endpoint now uses Python-side hourly bucketing — works on both SQLite (dev) and PostgreSQL (prod).",
        "Completion": 100,
    },
    {
        "Module": "Security & Production",
        "Feature": "Demo Mode Separation",
        "Task": "Ensure demo mode is clearly separated from live API calls",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "All API call sites guard with token !== 'demo-token'. Demo mode preserved as intentional offline preview feature.",
        "Completion": 100,
    },

    # ── AI / PROCESSING ────────────────────────────────────────────────────────
    {
        "Module": "AI Processing",
        "Feature": "YOLOv8 Person Detection",
        "Task": "Real-time person detection on camera frames",
        "Status": "PENDING",
        "Priority": "Critical",
        "Notes": "Requires processing/ worker with YOLOv8 model. Architecture defined. GPU hardware required.",
        "Completion": 5,
    },
    {
        "Module": "AI Processing",
        "Feature": "ByteTrack Multi-Object Tracking",
        "Task": "Per-camera tracking with track IDs",
        "Status": "PENDING",
        "Priority": "Critical",
        "Notes": "ByteTrack integration in processing/workers. Produces track events published to Redis.",
        "Completion": 5,
    },
    {
        "Module": "AI Processing",
        "Feature": "TransReID Body Re-ID",
        "Task": "Cross-camera re-identification using body appearance",
        "Status": "PENDING",
        "Priority": "Critical",
        "Notes": "Primary ID strategy for overhead cameras. Requires fine-tuned TransReID on top-down airport data.",
        "Completion": 0,
    },
    {
        "Module": "AI Processing",
        "Feature": "ArcFace Face Recognition",
        "Task": "Opportunistic face recognition at strategic camera points",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "Secondary ID (15-20% of cameras). ArcFace/AdaFace model. Face enrollment backend endpoint ready.",
        "Completion": 5,
    },
    {
        "Module": "AI Processing",
        "Feature": "Head-Top Appearance Analysis",
        "Task": "Hair color, style, headwear detection from overhead view",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "EfficientNet-B3 head-top embedder. Unique to overhead camera systems.",
        "Completion": 0,
    },
    {
        "Module": "AI Processing",
        "Feature": "Multi-Modal Fusion Engine",
        "Task": "Weighted fusion of body + head + face + spatial-temporal scores",
        "Status": "PENDING",
        "Priority": "Critical",
        "Notes": "Fusion weights per scenario: overhead=body 50%+head 30%+spatial 20%; face-cam=face 60%+body 25%+spatial 15%",
        "Completion": 0,
    },
    {
        "Module": "AI Processing",
        "Feature": "Milvus / FAISS Vector DB",
        "Task": "Store and search ReID + face embeddings",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "REID_COLLECTION_NAME and FACE_COLLECTION_NAME configured in settings. Milvus client ready.",
        "Completion": 10,
    },
    {
        "Module": "AI Processing",
        "Feature": "RTSP Stream Ingestion",
        "Task": "Connect to real camera RTSP streams for live video",
        "Status": "PENDING",
        "Priority": "Critical",
        "Notes": "Requires IP cameras with RTSP URLs configured. Camera heartbeat health check implemented in Celery.",
        "Completion": 0,
    },

    # ── SCRIPTS & TOOLING ──────────────────────────────────────────────────────
    {
        "Module": "Scripts & Tooling",
        "Feature": "Coverage Check (check_coverage.py)",
        "Task": "Verify camera FOV coverage for each floor",
        "Status": "DONE",
        "Priority": "Medium",
        "Notes": "Analyzes blueprint data for blind spots. 360° variant available.",
        "Completion": 100,
    },
    {
        "Module": "Scripts & Tooling",
        "Feature": "Verify Layout Alignment (verify_layout_alignment.py)",
        "Task": "Check camera positions align with DXF blueprints",
        "Status": "DONE",
        "Priority": "Medium",
        "Notes": "Validates pixel coordinates against DXF geometry.",
        "Completion": 100,
    },
    {
        "Module": "Scripts & Tooling",
        "Feature": "Start/Stop Scripts",
        "Task": "start.sh and stop.sh for local dev server management",
        "Status": "DONE",
        "Priority": "Medium",
        "Notes": "Starts backend (uvicorn) + frontend (vite) in background with PID tracking.",
        "Completion": 100,
    },
    {
        "Module": "Scripts & Tooling",
        "Feature": "Health Check Script",
        "Task": "health-check.sh to verify all services are running",
        "Status": "DONE",
        "Priority": "Medium",
        "Notes": "Checks backend, Redis, and frontend health endpoints.",
        "Completion": 100,
    },
    {
        "Module": "Scripts & Tooling",
        "Feature": "Download Models Script",
        "Task": "download-models.sh to fetch YOLOv8 + ArcFace model weights",
        "Status": "DONE",
        "Priority": "High",
        "Notes": "Script ready. Models not yet downloaded to production environment.",
        "Completion": 100,
    },
    {
        "Module": "Scripts & Tooling",
        "Feature": "TensorRT Engine Generation",
        "Task": "generate-trt-engines.sh to convert ONNX models to TensorRT",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "Requires NVIDIA GPU with TensorRT. Run after model download on target hardware.",
        "Completion": 0,
    },

    # ── NEXT SPRINT ────────────────────────────────────────────────────────────
    {
        "Module": "Next Sprint",
        "Feature": "Run reseed_from_json.py",
        "Task": "Apply accurate camera+zone pixel coordinates to SQLite database",
        "Status": "IN_PROGRESS",
        "Priority": "Critical",
        "Notes": "This fixes the blue dots appearing outside floor plan. Run: python3 scripts/reseed_from_json.py",
        "Completion": 50,
    },
    {
        "Module": "Next Sprint",
        "Feature": "Live Track Dots on Canvas",
        "Task": "Render WebSocket track positions as animated dots on the layout floor plan",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "Track data comes from WS store. Need to map global_id → canvas (x,y) using camera homography or stored coords.",
        "Completion": 0,
    },
    {
        "Module": "Next Sprint",
        "Feature": "Zone Occupancy Badges",
        "Task": "Display real-time occupancy count per zone on layout canvas",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "Zone occupancy = count of active tracks whose last known position falls inside zone polygon.",
        "Completion": 0,
    },
    {
        "Module": "Next Sprint",
        "Feature": ".env.example File",
        "Task": "Create documented .env.example with all required variables",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "Required for deployment onboarding. Include: DATABASE_URL, REDIS_URL, SECRET_KEY, ALLOWED_ORIGINS, MILVUS_HOST.",
        "Completion": 0,
    },
    {
        "Module": "Next Sprint",
        "Feature": "Production Docker Validation",
        "Task": "Validate docker-compose.yml end-to-end with all services",
        "Status": "PENDING",
        "Priority": "High",
        "Notes": "Test full stack: backend + frontend + Redis + PostgreSQL in containers.",
        "Completion": 0,
    },
]

# ─── Status styling ──────────────────────────────────────────────────────────
STATUS_STYLES = {
    "DONE":        (GREEN,       GREEN_LIGHT,   "✅ DONE"),
    "IN_PROGRESS": (AMBER,       AMBER_LIGHT,   "🔄 IN PROGRESS"),
    "PARTIAL":     (BLUE,        BLUE_LIGHT,    "⚡ PARTIAL"),
    "PENDING":     (GRAY_MID,    GRAY_LIGHT,    "⬜ PENDING"),
    "BLOCKED":     (RED,         RED_LIGHT,     "🔴 BLOCKED"),
}

PRIORITY_STYLES = {
    "Critical": (RED,    "🔴 Critical"),
    "High":     (AMBER,  "🟡 High"),
    "Medium":   (BLUE,   "🔵 Medium"),
    "Low":      (GREEN,  "🟢 Low"),
}

# ══════════════════════════════════════════════════════════════════════════════
# BUILD WORKBOOK
# ══════════════════════════════════════════════════════════════════════════════

wb = openpyxl.Workbook()
wb.remove(wb.active)

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 1: COVER PAGE
# ─────────────────────────────────────────────────────────────────────────────
ws_cover = wb.create_sheet("📋 Cover")
ws_cover.sheet_view.showGridLines = False
ws_cover.column_dimensions["A"].width = 3
ws_cover.column_dimensions["B"].width = 32
ws_cover.column_dimensions["C"].width = 65

# Title block
ws_cover.row_dimensions[2].height = 60
ws_cover.row_dimensions[3].height = 36
for row in range(1, 30):
    ws_cover.row_dimensions[row].height = ws_cover.row_dimensions[row].height or 22

# Main title
title_cell = ws_cover["B2"]
title_cell.value = "✈  AIRPORT INTELLIGENT SECURITY & SURVEILLANCE PLATFORM"
title_cell.font = Font(bold=True, color=TEAL, size=18, name="Calibri")
title_cell.fill = fill(DARK_BG)
title_cell.alignment = align("left", "center")
ws_cover.merge_cells("B2:C2")

# Subtitle
sub_cell = ws_cover["B3"]
sub_cell.value = "Project Task Completion Report — ALPHA-2 Building"
sub_cell.font = Font(bold=False, color="AAAAAA", size=12, name="Calibri")
sub_cell.fill = fill(DARK_BG)
sub_cell.alignment = align("left", "center")
ws_cover.merge_cells("B3:C3")

# Separator
for col in range(2, 4):
    c = ws_cover.cell(row=4, column=col)
    c.fill = fill(TEAL)
    c.value = ""
ws_cover.row_dimensions[4].height = 3

# Info block
ws_cover.row_dimensions[6].height = 28
ws_cover.cell(row=6, column=2).value = "PROJECT DETAILS"
ws_cover.cell(row=6, column=2).font = Font(bold=True, color=TEAL, size=11, name="Calibri")
ws_cover.cell(row=6, column=2).fill = fill(HEADER_BG)

row_num = 7
for k, v in PROJECT_INFO.items():
    ws_cover.row_dimensions[row_num].height = 22
    label_cell = ws_cover.cell(row=row_num, column=2)
    label_cell.value = k
    label_cell.font = Font(bold=True, color="AAAAAA", size=10, name="Calibri")
    label_cell.fill = fill(GRAY_DARK)
    label_cell.alignment = align("left", "center")
    label_cell.border = border_thin()

    val_cell = ws_cover.cell(row=row_num, column=3)
    val_cell.value = v
    val_cell.font = Font(bold=False, color=WHITE, size=10, name="Calibri")
    val_cell.fill = fill(DARK_BG)
    val_cell.alignment = align("left", "center")
    val_cell.border = border_thin()
    row_num += 1

# Summary stats
done_count = sum(1 for t in TASKS if t["Status"] == "DONE")
inprog_count = sum(1 for t in TASKS if t["Status"] in ("IN_PROGRESS", "PARTIAL"))
pending_count = sum(1 for t in TASKS if t["Status"] == "PENDING")
blocked_count = sum(1 for t in TASKS if t["Status"] == "BLOCKED")
total = len(TASKS)
avg_completion = round(sum(t["Completion"] for t in TASKS) / total, 1)

stats = [
    ("Total Tasks",      total,         TEAL),
    ("✅ Completed",     done_count,    GREEN),
    ("🔄 In Progress",   inprog_count,  AMBER),
    ("⬜ Pending",       pending_count, GRAY_MID),
    ("Overall Progress", f"{avg_completion}%", BLUE),
]

row_num += 2
ws_cover.cell(row=row_num, column=2).value = "SUMMARY STATISTICS"
ws_cover.cell(row=row_num, column=2).font = Font(bold=True, color=TEAL, size=11, name="Calibri")
ws_cover.cell(row=row_num, column=2).fill = fill(HEADER_BG)
ws_cover.merge_cells(f"B{row_num}:C{row_num}")
row_num += 1

for stat_label, stat_val, stat_color in stats:
    ws_cover.row_dimensions[row_num].height = 24
    lc = ws_cover.cell(row=row_num, column=2)
    lc.value = stat_label
    lc.font = Font(bold=True, color="AAAAAA", size=10, name="Calibri")
    lc.fill = fill(GRAY_DARK)
    lc.alignment = align("left", "center")
    lc.border = border_thin()

    vc = ws_cover.cell(row=row_num, column=3)
    vc.value = stat_val
    vc.font = Font(bold=True, color=stat_color, size=12, name="Calibri")
    vc.fill = fill(DARK_BG)
    vc.alignment = align("left", "center")
    vc.border = border_thin()
    row_num += 1

# Generated date
row_num += 1
ws_cover.cell(row=row_num, column=2).value = f"Generated: {datetime.now().strftime('%d %B %Y at %H:%M IST')}"
ws_cover.cell(row=row_num, column=2).font = Font(bold=False, color="666666", size=9, name="Calibri")
ws_cover.merge_cells(f"B{row_num}:C{row_num}")

# Background fill entire sheet
for row in ws_cover.iter_rows():
    for cell in row:
        if cell.fill.fgColor.rgb == "00000000":
            cell.fill = fill(DARK_BG)

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 2: MASTER TASK LIST
# ─────────────────────────────────────────────────────────────────────────────
ws_tasks = wb.create_sheet("📊 All Tasks")
ws_tasks.sheet_view.showGridLines = False

# Column widths
col_widths = [3, 22, 28, 52, 16, 12, 55, 15]
for i, w in enumerate(col_widths, 1):
    ws_tasks.column_dimensions[get_column_letter(i)].width = w

# Header
ws_tasks.row_dimensions[1].height = 12
ws_tasks.row_dimensions[2].height = 36

headers = ["#", "Module", "Feature", "Task Description", "Status", "Priority", "Notes / Details", "Completion %"]
for col, hdr in enumerate(headers, 2):
    cell = ws_tasks.cell(row=2, column=col)
    cell.value = hdr
    cell.fill = fill(HEADER_BG)
    cell.font = Font(bold=True, color=TEAL, size=11, name="Calibri")
    cell.alignment = align("center", "center")
    cell.border = border_thin()

# Rows
current_module = None
row_num = 3

for idx, task in enumerate(TASKS, 1):
    ws_tasks.row_dimensions[row_num].height = 46

    # Module separator row
    if task["Module"] != current_module:
        current_module = task["Module"]

    status = task["Status"]
    _, bg_color, status_label = STATUS_STYLES[status]
    prio_color, prio_label = PRIORITY_STYLES[task["Priority"]]

    # Alternating row shade
    row_bg = "141B27" if idx % 2 == 0 else DARK_BG

    row_data = [idx, task["Module"], task["Feature"], task["Task"], status_label, prio_label, task["Notes"], f"{task['Completion']}%"]
    for col, val in enumerate(row_data, 2):
        cell = ws_tasks.cell(row=row_num, column=col)
        cell.value = val
        cell.fill = fill(row_bg)
        cell.font = Font(bold=False, color=WHITE, size=9, name="Calibri")
        cell.alignment = align("left", "center", wrap=True)
        cell.border = border_thin()

        # Special styling
        if col == 6:  # Status
            _, _, _ = STATUS_STYLES[status]
            cell.fill = fill(bg_color.replace("D1", "1A").replace("FE", "1A").replace("DB", "1A").replace("ED", "1A").replace("F3", "1A"))
            cell.font = Font(bold=True, color=STATUS_STYLES[status][0], size=9, name="Calibri")
            cell.alignment = align("center", "center")
        if col == 7:  # Priority
            cell.font = Font(bold=True, color=prio_color, size=9, name="Calibri")
            cell.alignment = align("center", "center")
        if col == 9:  # Completion
            pct = task["Completion"]
            comp_color = GREEN if pct == 100 else AMBER if pct >= 50 else RED if pct > 0 else GRAY_MID
            cell.font = Font(bold=True, color=comp_color, size=10, name="Calibri")
            cell.alignment = align("center", "center")

    row_num += 1

# Auto-filter
ws_tasks.auto_filter.ref = f"B2:{get_column_letter(9)}{row_num - 1}"

# Freeze header
ws_tasks.freeze_panes = "B3"

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 3: MODULE SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
ws_mod = wb.create_sheet("📦 By Module")
ws_mod.sheet_view.showGridLines = False

col_widths_mod = [3, 28, 12, 12, 12, 12, 16]
for i, w in enumerate(col_widths_mod, 1):
    ws_mod.column_dimensions[get_column_letter(i)].width = w

ws_mod.row_dimensions[1].height = 12
ws_mod.row_dimensions[2].height = 36

mod_headers = ["Module", "Total Tasks", "✅ Done", "🔄 In Progress", "⬜ Pending", "Avg Completion %"]
for col, hdr in enumerate(mod_headers, 2):
    cell = ws_mod.cell(row=2, column=col)
    cell.value = hdr
    cell.fill = fill(HEADER_BG)
    cell.font = Font(bold=True, color=TEAL, size=11, name="Calibri")
    cell.alignment = align("center", "center")
    cell.border = border_thin()

# Group by module
from collections import defaultdict
module_groups = defaultdict(list)
for t in TASKS:
    module_groups[t["Module"]].append(t)

row_num = 3
for mod, tasks in module_groups.items():
    ws_mod.row_dimensions[row_num].height = 28
    mod_done = sum(1 for t in tasks if t["Status"] == "DONE")
    mod_prog = sum(1 for t in tasks if t["Status"] in ("IN_PROGRESS", "PARTIAL"))
    mod_pend = sum(1 for t in tasks if t["Status"] in ("PENDING", "BLOCKED"))
    mod_avg  = round(sum(t["Completion"] for t in tasks) / len(tasks), 1)

    row_vals = [mod, len(tasks), mod_done, mod_prog, mod_pend, f"{mod_avg}%"]
    row_bg = "141B27" if row_num % 2 == 0 else DARK_BG

    for col, val in enumerate(row_vals, 2):
        cell = ws_mod.cell(row=row_num, column=col)
        cell.value = val
        cell.fill = fill(row_bg)
        cell.font = Font(bold=False, color=WHITE, size=10, name="Calibri")
        cell.alignment = align("center", "center")
        cell.border = border_thin()

    # Highlight module name
    ws_mod.cell(row=row_num, column=2).font = Font(bold=True, color=TEAL, size=10, name="Calibri")
    ws_mod.cell(row=row_num, column=2).alignment = align("left", "center")

    # Color completion
    comp_color = GREEN if mod_avg == 100 else AMBER if mod_avg >= 50 else RED
    ws_mod.cell(row=row_num, column=7).font = Font(bold=True, color=comp_color, size=11, name="Calibri")

    row_num += 1

ws_mod.freeze_panes = "B3"

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 4: NEXT SPRINT PLAN
# ─────────────────────────────────────────────────────────────────────────────
ws_sprint = wb.create_sheet("🚀 Next Sprint")
ws_sprint.sheet_view.showGridLines = False

col_widths_sprint = [3, 34, 52, 18, 55]
for i, w in enumerate(col_widths_sprint, 1):
    ws_sprint.column_dimensions[get_column_letter(i)].width = w

ws_sprint.row_dimensions[2].height = 36
sprint_headers = ["Feature", "Task", "Priority", "Action Required"]
for col, hdr in enumerate(sprint_headers, 2):
    cell = ws_sprint.cell(row=2, column=col)
    cell.value = hdr
    cell.fill = fill(HEADER_BG)
    cell.font = Font(bold=True, color=TEAL, size=11, name="Calibri")
    cell.alignment = align("center", "center")
    cell.border = border_thin()

pending_tasks = [t for t in TASKS if t["Status"] in ("PENDING", "IN_PROGRESS") and t["Priority"] in ("Critical", "High")]
pending_tasks.sort(key=lambda t: (0 if t["Priority"] == "Critical" else 1, t["Module"]))

row_num = 3
for t in pending_tasks:
    ws_sprint.row_dimensions[row_num].height = 44
    prio_color, prio_label = PRIORITY_STYLES[t["Priority"]]
    row_bg = "141B27" if row_num % 2 == 0 else DARK_BG

    sprint_vals = [t["Feature"], t["Task"], prio_label, t["Notes"]]
    for col, val in enumerate(sprint_vals, 2):
        cell = ws_sprint.cell(row=row_num, column=col)
        cell.value = val
        cell.fill = fill(row_bg)
        cell.font = Font(bold=False, color=WHITE, size=9, name="Calibri")
        cell.alignment = align("left", "center", wrap=True)
        cell.border = border_thin()

    ws_sprint.cell(row=row_num, column=4).font = Font(bold=True, color=prio_color, size=9, name="Calibri")
    ws_sprint.cell(row=row_num, column=4).alignment = align("center", "center")
    row_num += 1

ws_sprint.freeze_panes = "B3"

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 5: CAMERA & ZONE INVENTORY
# ─────────────────────────────────────────────────────────────────────────────
import json
blueprint_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "blueprint_data.json")
with open(blueprint_path) as f:
    bp = json.load(f)

ws_cams = wb.create_sheet("📷 Camera Inventory")
ws_cams.sheet_view.showGridLines = False

cam_col_widths = [3, 8, 30, 10, 8, 10, 10, 20, 14]
for i, w in enumerate(cam_col_widths, 1):
    ws_cams.column_dimensions[get_column_letter(i)].width = w

ws_cams.row_dimensions[2].height = 30
cam_headers = ["ID", "Camera Name", "Floor", "X (px)", "Y (px)", "Angle°", "FOV°", "Location", "Status"]
for col, hdr in enumerate(cam_headers, 2):
    cell = ws_cams.cell(row=2, column=col)
    cell.value = hdr
    cell.fill = fill(HEADER_BG)
    cell.font = Font(bold=True, color=TEAL, size=11, name="Calibri")
    cell.alignment = align("center", "center")
    cell.border = border_thin()

floor_labels = {0: "Ground Floor (GF)", 1: "First Floor (AA)", 2: "Second Floor (FF)"}
for row_num, cam in enumerate(bp["cameras"], 3):
    ws_cams.row_dimensions[row_num].height = 22
    row_bg = "141B27" if row_num % 2 == 0 else DARK_BG
    vals = [cam["id"], cam["name"], floor_labels.get(cam["floor"], str(cam["floor"])), cam["x"], cam["y"], cam["angle"], cam["fov"], cam.get("location", ""), cam.get("status", "ACTIVE")]
    for col, val in enumerate(vals, 2):
        cell = ws_cams.cell(row=row_num, column=col)
        cell.value = val
        cell.fill = fill(row_bg)
        cell.font = Font(bold=False, color=WHITE, size=9, name="Calibri")
        cell.alignment = align("center", "center")
        cell.border = border_thin()
    ws_cams.cell(row=row_num, column=3).alignment = align("left", "center")
    status_color = GREEN if cam.get("status", "ACTIVE") == "ACTIVE" else RED
    ws_cams.cell(row=row_num, column=10).font = Font(bold=True, color=status_color, size=9, name="Calibri")

ws_cams.auto_filter.ref = f"B2:{get_column_letter(10)}{row_num}"
ws_cams.freeze_panes = "B3"

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 6: ZONE INVENTORY
# ─────────────────────────────────────────────────────────────────────────────
ws_zones = wb.create_sheet("🟩 Zone Inventory")
ws_zones.sheet_view.showGridLines = False

zone_col_widths = [3, 8, 30, 10, 18, 20, 14]
for i, w in enumerate(zone_col_widths, 1):
    ws_zones.column_dimensions[get_column_letter(i)].width = w

ws_zones.row_dimensions[2].height = 30
zone_headers = ["ID", "Zone Name", "Floor", "Type", "Dwell Alert (sec)", "Color", "Active"]
for col, hdr in enumerate(zone_headers, 2):
    cell = ws_zones.cell(row=2, column=col)
    cell.value = hdr
    cell.fill = fill(HEADER_BG)
    cell.font = Font(bold=True, color=TEAL, size=11, name="Calibri")
    cell.alignment = align("center", "center")
    cell.border = border_thin()

ZONE_TYPE_COLORS = {
    "RESTRICTED": RED, "DWELL": BLUE, "LOUNGE": GREEN,
    "WORK": AMBER, "ENTRY_EXIT": PURPLE, "PUBLIC": "94A3B8"
}
for row_num, zone in enumerate(bp["zones"], 3):
    ws_zones.row_dimensions[row_num].height = 22
    row_bg = "141B27" if row_num % 2 == 0 else DARK_BG
    vals = [zone["id"], zone["name"], floor_labels.get(zone["floor"], str(zone["floor"])), zone["type"], zone.get("dwell_alert_seconds", 0), zone.get("color", "#FFFFFF"), "Yes" if zone.get("is_active", True) else "No"]
    for col, val in enumerate(vals, 2):
        cell = ws_zones.cell(row=row_num, column=col)
        cell.value = val
        cell.fill = fill(row_bg)
        cell.font = Font(bold=False, color=WHITE, size=9, name="Calibri")
        cell.alignment = align("center", "center")
        cell.border = border_thin()
    ws_zones.cell(row=row_num, column=3).alignment = align("left", "center")
    # Zone type color
    ztype = zone.get("type", "PUBLIC")
    zcolor = ZONE_TYPE_COLORS.get(ztype, GRAY_MID)
    ws_zones.cell(row=row_num, column=5).font = Font(bold=True, color=zcolor, size=9, name="Calibri")

ws_zones.auto_filter.ref = f"B2:{get_column_letter(8)}{row_num}"
ws_zones.freeze_panes = "B3"

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 7: API ENDPOINT REFERENCE
# ─────────────────────────────────────────────────────────────────────────────
ws_api = wb.create_sheet("🔌 API Reference")
ws_api.sheet_view.showGridLines = False

api_col_widths = [3, 10, 38, 18, 45, 14]
for i, w in enumerate(api_col_widths, 1):
    ws_api.column_dimensions[get_column_letter(i)].width = w

ws_api.row_dimensions[2].height = 30
api_headers = ["Method", "Endpoint", "Auth", "Description", "Status"]
for col, hdr in enumerate(api_headers, 2):
    cell = ws_api.cell(row=2, column=col)
    cell.value = hdr
    cell.fill = fill(HEADER_BG)
    cell.font = Font(bold=True, color=TEAL, size=11, name="Calibri")
    cell.alignment = align("center", "center")
    cell.border = border_thin()

ENDPOINTS = [
    ("POST",   "/auth/login",                    "No",  "OAuth2 login — returns JWT access token", "DONE"),
    ("GET",    "/cameras/",                       "JWT", "List all cameras", "DONE"),
    ("POST",   "/cameras/",                       "JWT", "Create camera", "DONE"),
    ("PATCH",  "/cameras/{id}",                   "JWT", "Update camera properties", "DONE"),
    ("DELETE", "/cameras/{id}",                   "JWT", "Delete camera", "DONE"),
    ("POST",   "/cameras/positions/bulk",         "JWT", "Bulk update camera x/y positions", "DONE"),
    ("GET",    "/alerts/",                        "JWT", "List alerts (filter: ?acknowledged=)", "DONE"),
    ("POST",   "/alerts/{id}/acknowledge",        "JWT", "Acknowledge single alert", "DONE"),
    ("POST",   "/alerts/bulk-acknowledge",        "JWT", "Bulk acknowledge alerts (fixed URL)", "DONE"),
    ("GET",    "/alerts/unacknowledged/count",    "JWT", "Count of unacknowledged alerts", "DONE"),
    ("GET",    "/analytics/stats",                "JWT", "KPI summary stats", "DONE"),
    ("GET",    "/analytics/",                     "JWT", "Full analytics dashboard data", "DONE"),
    ("GET",    "/analytics/entry-exit",           "JWT", "Hourly entry/exit counts (SQLite compatible)", "DONE"),
    ("GET",    "/visitors/",                      "JWT", "List all visitors", "DONE"),
    ("POST",   "/visitors/",                      "JWT", "Create visitor record", "DONE"),
    ("PATCH",  "/visitors/{id}/status",           "JWT", "Update visitor status", "DONE"),
    ("POST",   "/visitors/{id}/photo",            "JWT", "Upload visitor photo", "DONE"),
    ("GET",    "/visitors/watchlist",             "JWT", "Get watchlisted visitors", "DONE"),
    ("GET",    "/employees/",                     "JWT", "List active employees", "DONE"),
    ("POST",   "/employees/",                     "JWT", "Create employee record", "DONE"),
    ("POST",   "/employees/breaks/start",         "JWT", "Record break start", "DONE"),
    ("POST",   "/employees/breaks/end",           "JWT", "Record break end + compliance calc", "DONE"),
    ("GET",    "/employees/break-compliance",     "JWT", "Real-time break compliance for all staff (alias)", "DONE"),
    ("GET",    "/zones/",                         "JWT", "List zones (all including inactive)", "DONE"),
    ("POST",   "/zones/",                         "JWT", "Create zone with polygon coordinates", "DONE"),
    ("PATCH",  "/zones/{id}",                     "JWT", "Update zone", "DONE"),
    ("DELETE", "/zones/{id}",                     "JWT", "Delete zone", "DONE"),
    ("GET",    "/layouts/",                       "JWT", "List all floor layouts", "DONE"),
    ("POST",   "/layouts/{floor}/upload",         "JWT", "Upload floor plan image", "DONE"),
    ("GET",    "/sites/",                         "JWT", "List sites", "DONE"),
    ("POST",   "/sites/",                         "JWT", "Create site", "DONE"),
    ("GET",    "/buildings/",                     "JWT", "List buildings (filter: ?site_id=)", "DONE"),
    ("POST",   "/buildings/",                     "JWT", "Create building (auto-creates ground floor)", "DONE"),
    ("GET",    "/buildings/{id}/floors",          "JWT", "List floors for building", "DONE"),
    ("POST",   "/buildings/{id}/floors",          "JWT", "Add floor to building", "DONE"),
    ("GET",    "/tracks/active",                  "JWT", "List active tracking records", "DONE"),
    ("POST",   "/simulation/start",               "JWT", "Start simulation session", "DONE"),
    ("POST",   "/simulation/stop",                "JWT", "Stop simulation session", "DONE"),
    ("POST",   "/simulation/publish",             "JWT", "Publish simulation events to Redis", "DONE"),
    ("POST",   "/simulation/tick",                "JWT", "Send tick update for simulation", "DONE"),
    ("POST",   "/enrollment/face/visitor/{id}",   "JWT", "Enroll visitor face + extract embedding", "PARTIAL"),
    ("POST",   "/enrollment/face/employee/{id}",  "JWT", "Enroll employee face + extract embedding", "PARTIAL"),
    ("GET",    "/enrollment/status",              "JWT", "Count enrolled visitors and employees", "DONE"),
    ("WS",     "/ws",                             "JWT", "WebSocket — real-time event stream", "DONE"),
]

METHOD_COLORS = {
    "GET": "10B981", "POST": "3B82F6", "PATCH": "F59E0B",
    "DELETE": "EF4444", "WS": "8B5CF6"
}

for row_num, (method, ep, auth, desc, status) in enumerate(ENDPOINTS, 3):
    ws_api.row_dimensions[row_num].height = 24
    row_bg = "141B27" if row_num % 2 == 0 else DARK_BG
    _, bg_color, status_label = STATUS_STYLES[status]

    vals = [method, ep, auth, desc, status_label]
    for col, val in enumerate(vals, 2):
        cell = ws_api.cell(row=row_num, column=col)
        cell.value = val
        cell.fill = fill(row_bg)
        cell.font = Font(bold=False, color=WHITE, size=9, name="Calibri")
        cell.alignment = align("left", "center")
        cell.border = border_thin()

    ws_api.cell(row=row_num, column=2).font = Font(bold=True, color=METHOD_COLORS.get(method, WHITE), size=9, name="Calibri")
    ws_api.cell(row=row_num, column=2).alignment = align("center", "center")
    ws_api.cell(row=row_num, column=4).alignment = align("center", "center")
    ws_api.cell(row=row_num, column=6).font = Font(bold=True, color=STATUS_STYLES[status][0], size=9, name="Calibri")
    ws_api.cell(row=row_num, column=6).alignment = align("center", "center")

ws_api.auto_filter.ref = f"B2:{get_column_letter(6)}{row_num}"
ws_api.freeze_panes = "B3"

# ─────────────────────────────────────────────────────────────────────────────
# SAVE
# ─────────────────────────────────────────────────────────────────────────────
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ALPHA2_Project_Task_Completion.xlsx")
output_path = os.path.abspath(output_path)
wb.save(output_path)
print(f"✅ Excel documentation generated: {output_path}")
print(f"   Sheets: Cover | All Tasks ({total} tasks) | By Module | Next Sprint | Camera Inventory ({len(bp['cameras'])} cams) | Zone Inventory ({len(bp['zones'])} zones) | API Reference ({len(ENDPOINTS)} endpoints)")
