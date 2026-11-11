# 🎓 Intern Project Breakdown: Airport Security & Surveillance System

This document outlines the **4-Module Breakdown** for recreating the **Airport Security Surveillance System** from scratch. Each chunk is designed to be assigned to **one intern** (or sub-team) with clear boundaries, tech stack requirements, API contracts, and deliverables.

---

## 🏗️ Architecture Overview & Inter-Module Dependencies

```
+-----------------------------------------------------------------------------------+
|                                 INTERN 4: DevOps & Spatial                        |
|                     Docker Compose / Infrastructure / Layout Map                  |
+-----------------------------------------------------------------------------------+
                                          |
          +-------------------------------+-------------------------------+
          |                                                               |
          v                                                               v
+-----------------------------------+           +-----------------------------------+
|      INTERN 1: AI & CV Pipeline   |           |    INTERN 2: Backend & Database   |
| (YOLOv8, ReID, Tracking, Rules)   |           |  (FastAPI, PostgreSQL, WebSockets)|
+-----------------------------------+           +-----------------------------------+
          |                                                               |
          +-------------------------------+-------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                       INTERN 3: Frontend Dashboard & UI                           |
|                    (React + Vite, Zustand, Live Feeds, Analytics)                 |
+-----------------------------------------------------------------------------------+
```

---

## 🧩 Chunk 1: AI Vision & Real-Time Tracking Engine
**Assigned Role:** Computer Vision & AI Engineer  
**Folder Scope:** `processing/` & ML models setup

### 🎯 Primary Responsibilities:
1. **Video Ingestion Pipeline:** Build multi-threaded RTSP video stream readers and local MP4/webcam fallback readers (`cv2.VideoCapture`).
2. **Object Detection & Local Tracking:** Integrate YOLOv8 for sub-millisecond person detection and ByteTrack for per-camera frame-to-frame tracking.
3. **Biometric Embeddings & ReID:**
   - **Face Embedder:** ArcFace / SCRFD face detection & 512-dim vector extraction.
   - **Body ReID:** ResNet / TransReID 2048-dim appearance vector extraction.
   - **Head Top Embedder:** 256-dim top-down cap/head feature extraction.
4. **Global Cross-Camera Tracking:** Implement cosine similarity embedding matching to assign unified `global_id` tracking across multiple camera angles.
5. **Rules & Intrusion Processing Engine:**
   - Polygon boundary detection (Point-in-Polygon zone intrusion engine).
   - Bi-directional line crossing counter (Virtual Tripwires).
   - Employee break time auditor (Lounge zone dwell time).
6. **Telemetry Publisher:** Publish live tracker positions `(global_id, camera_id, x, y, timestamp)` and security alert triggers directly to Redis Pub/Sub (`ws_events` channel).

### 🛠️ Tech Stack:
- **Language:** Python 3.10+
- **Libraries:** PyTorch, OpenCV (`cv2`), Ultralytics (`yolov8`), NumPy, Redis client, ONNX Runtime, SciPy.

### 📋 Deliverables & Key Files:
- `processing/workers/person_detector.py`
- `processing/workers/single_cam_tracker.py`
- `processing/workers/global_tracker.py`
- `processing/workers/face_detector.py` & `face_embedder.py`
- `processing/workers/body_reid.py`
- `processing/workers/intrusion_engine.py` & `entry_exit_counter.py`
- `processing/pipeline/camera_pipeline.py`

---

## ⚡ Chunk 2: Backend API, Auth & Real-Time Gateway
**Assigned Role:** Backend & Database Systems Engineer  
**Folder Scope:** `backend/` & `database/`

### 🎯 Primary Responsibilities:
1. **Database Schema & Migrations:** Design PostgreSQL ORM models for Users, Sites, Buildings, Layouts, Cameras, Zones, Visitors, Employees, EmployeeBreaks, Alerts, and AuditLogs. Setup Alembic database migrations.
2. **Authentication & RBAC:** OAuth2 with JWT tokens, password hashing with direct `bcrypt`, and Role-Based Access Control (`admin` vs `security_operator`).
3. **RESTful Service APIs:** Build endpoints for:
   - **Infrastructure CRUD:** Sites, Buildings, Layouts, Cameras.
   - **People Registry & Enrollment:** Visitors, Employees, Face Biometric Enrollment API.
   - **Security Rules:** Zones & Tripwires configuration.
   - **Tracking History & Search:** Person lookup, track history, and visit statistics.
   - **Analytics & Auditing:** Summary aggregations, CSV export for audit logs and attendance.
4. **Real-Time WebSocket Gateway:** Background Redis subscriber task running in FastAPI lifespan that intercepts Redis Pub/Sub events and relays live tracking data and security alerts to connected WebSocket clients.
5. **Video Sandbox API:** Endpoints to upload local test videos and return annotated frame data.

### 🛠️ Tech Stack:
- **Language:** Python 3.10+
- **Frameworks & Database:** FastAPI, Uvicorn, SQLAlchemy, Pydantic v2, Alembic, PostgreSQL, Redis Pub/Sub, Pytest.

### 📋 Deliverables & Key Files:
- `backend/app/models/models.py`
- `backend/app/schemas/` (Pydantic schemas)
- `backend/app/api/routes/` (`auth.py`, `cameras.py`, `visitors.py`, `employees.py`, `zones.py`, `tracks.py`, `analytics.py`, `audit.py`)
- `backend/app/api/websocket.py`
- `backend/app/core/security.py` & `config.py`

---

## 🎨 Chunk 3: Frontend Dashboard, Live Feeds & Registry UI
**Assigned Role:** Frontend UI/UX & Real-time Web Engineer  
**Folder Scope:** `frontend/src/components/`, `stores/`, `hooks/`

### 🎯 Primary Responsibilities:
1. **Core SPA Setup & Modern Visual System:** Build Vite + React SPA with high-contrast dark dashboard aesthetic (Jet Black `#0a0a0a`, Titanium White `#ffffff`, High-Alert Red `#ef4444`, Infrastructure Green `#10b981`).
2. **State Management & Live WebSockets:** Set up Axios HTTP client and Zustand stores for state management. Integrate WebSocket hooks to stream real-time coordinate updates and alert toasts seamlessly.
3. **Multi-Camera Live Grid (`LiveFeeds`):**
   - Dynamic 1x1, 2x2, 3x3, and 4x4 grid view switcher.
   - RTSP canvas bounding box overlays synced with AI detector outputs.
   - Local webcam fallback mechanism (`getUserMedia`) for local URL testing.
4. **People Registry & Search UI:**
   - **Employees & Visitors Page:** Profile enrollment, list views, and deletion with confirmation.
   - **Person Lookup Page:** Comprehensive search, authorized vs unauthorized status cards, and chronological journey timeline.
   - **Person Detail Modal:** Complete tracking stats, visit logs, and snapshot images.
5. **Alert Triage & Analytics Center:**
   - Real-time header Alert Ticker and Alert Archive table (`AlertsPage`).
   - Interactive Recharts graphs for hourly footfall, zone occupancy, and demographic distribution.
   - Audit report viewer and month-wise CSV exporter (`ReportsPage`).
6. **Demo Mode Bypass:** Offline mock state generator allowing full UI testing without a live AI pipeline backend running.

### 🛠️ Tech Stack:
- **Frameworks & Libraries:** React 18, Vite, TypeScript, Zustand, Recharts, Lucide React, Axios, HTML5 Canvas API.

### 📋 Deliverables & Key Files:
- `frontend/src/components/LiveFeeds.tsx`
- `frontend/src/components/LoginPage.tsx` & `Topbar.tsx`
- `frontend/src/components/VisitorsPage.tsx` & `EmployeesPage.tsx`
- `frontend/src/components/PersonLookupPage.tsx` & `PersonDetailModal.tsx`
- `frontend/src/components/AlertsPage.tsx` & `AlertTicker.tsx`
- `frontend/src/components/AnalyticsPage.tsx` & `ReportsPage.tsx`
- `frontend/src/stores/` (Zustand state modules)

---

## 🗺️ Chunk 4: 2D Spatial Map, Layout Editor & DevOps Integration
**Assigned Role:** Spatial Mapping & DevOps Engineer  
**Folder Scope:** `frontend/src/components/LayoutEditor/`, `TrackingMap/`, `scripts/`, `docker-compose.yml`

### 🎯 Primary Responsibilities:
1. **Interactive Floor Layout Editor (`LayoutEditor`):**
   - Canvas/SVG tool allowing security operators to upload floor plan images.
   - Drag-and-drop camera placements with adjustable Field-of-View (FoV) cones.
   - Draw multi-vertex polygon restricted zones (`RESTRICTED`, `DWELL`, `LOUNGE`) and directional tripwire line segments (`TRIPWIRE`).
   - Normalized coordinate system mapping percentages `(0.0 - 100.0)` for screen-size independence.
2. **Real-Time 2D Tracking Map (`TrackingMap`):**
   - Render floor plan background with live moving avatar dots representing active tracked individuals.
   - Color coding by role: **Green** (Employee), **Blue** (Visitor), **Red** (Unauthorized / Watchlist).
   - Render historic trajectory paths (journey breadcrumbs) per person.
3. **Dwell Heatmap Overlay (`DwellHeatmap`):** Render spatial density heatmaps representing loitering/dwell time intensity across airport zones.
4. **DevOps & Infrastructure Orchestration:**
   - Multi-container Docker orchestration (`docker-compose.yml`, GPU pass-through compose override).
   - Shell automation scripts (`scripts/setup-local.sh`, `download-models.sh`, `health-check.sh`).
   - Developer Onboarding documentation (`DEVELOPER_ONBOARDING.md`) and CLI Makefile commands.

### 🛠️ Tech Stack:
- **Spatial Tech:** HTML5 Canvas API / SVG, Konva.js / Custom Math algorithms.
- **DevOps Tech:** Docker, Docker Compose, Bash scripting, Makefile, Redis, PostgreSQL.

### 📋 Deliverables & Key Files:
- `frontend/src/components/LayoutEditor.tsx` & `LayoutEditor/`
- `frontend/src/components/TrackingMap/index.tsx`
- `frontend/src/components/DwellHeatmap/`
- `docker-compose.yml` & `docker-compose.gpu.yml`
- `Makefile` & `scripts/` (`setup-local.sh`, `download-models.sh`, `health-check.sh`)
- `DEVELOPER_ONBOARDING.md`

---

## 🔗 Shared Data & Contract Specifications

To prevent interns from getting blocked by dependencies, enforce these shared contracts early:

### 1. Tracking Event Payload (Redis Pub/Sub -> WebSockets -> UI):
```json
{
  "type": "TRACK_UPDATE",
  "data": {
    "global_id": "GLOBAL_1042",
    "camera_id": "CAM_01",
    "floor_id": 1,
    "x_norm": 45.2,
    "y_norm": 68.7,
    "role": "KNOWN_EMPLOYEE",
    "person_name": "John Doe",
    "timestamp": "2026-08-20T12:00:00Z"
  }
}
```

### 2. Alert Trigger Payload (AI Engine -> Redis -> WebSockets -> UI):
```json
{
  "type": "ALERT",
  "data": {
    "alert_id": "ALT_9921",
    "severity": "CRITICAL",
    "category": "ZONE_INTRUSION",
    "zone_name": "Vault Area",
    "global_id": "GLOBAL_1042",
    "camera_id": "CAM_01",
    "timestamp": "2026-08-20T12:00:05Z",
    "acknowledged": false
  }
}
```

### 3. Normalized Zone Coordinate Contract:
All zone polygons and tripwires are stored as normalized percentages `(0.0 - 100.0)` relative to the layout image dimensions:
```json
{
  "zone_name": "Restricted Zone A",
  "zone_type": "RESTRICTED",
  "polygon_points": [
    {"x": 10.5, "y": 20.0},
    {"x": 30.0, "y": 20.0},
    {"x": 30.0, "y": 50.0},
    {"x": 10.5, "y": 50.0}
  ]
}
```

---

## 📅 Recommended 4-Week Implementation Roadmap

| Week | Intern 1 (AI / CV) | Intern 2 (Backend) | Intern 3 (Frontend UI) | Intern 4 (Spatial & DevOps) |
| :--- | :--- | :--- | :--- | :--- |
| **Week 1** | Setup YOLOv8 + ByteTrack on sample video loop. | Setup FastAPI, PostgreSQL models & JWT auth. | Setup React + Vite SPA, dark theme & mock Zustand store. | Setup Docker compose baseline & floor plan canvas container. |
| **Week 2** | Add ArcFace + ResNet ReID & cosine similarity global matcher. | Build Infrastructure, Visitor, Employee, and Alert REST APIs. | Build Multi-Camera Live Feeds grid and People Registry pages. | Build Layout Editor drawing tools (Zones & Tripwire lines). |
| **Week 3** | Implement Intrusion engine & publish events to Redis. | Implement Redis subscriber & WebSocket server relay. | Connect Frontend to WebSocket server & live alert ticker. | Build 2D Live Tracking Map & Dwell Heatmap overlays. |
| **Week 4** | E2E testing with multi-camera streams. | Audit log exports & backend test suites (`pytest`). | Polishing Person Lookup, Analytics charts & edge cases. | Docker GPU deployment & Developer Onboarding guide. |
