# 🛫 Developer Onboarding Guide — Airport Security Surveillance System

Welcome to the **Airport Security Intelligent Surveillance & Tracking System** (Codename: *Chairman Requirement*). This document is designed to help you understand the codebase, get your local environment running quickly, and start contributing.

---

## 🗺️ System Architecture & Data Flow

The system consists of three main components: a real-time **AI Processing Pipeline**, a high-performance **FastAPI Backend**, and a modern **React + Vite Frontend**.

```mermaid
graph TD
    %% Source
    Cam[RTSP Streams / Webcams] -->|OpenCV Frames| AI[AI Processing Pipeline]

    %% Inference
    subgraph AI Pipeline [AI Processing Pipeline]
        YOLO[YOLOv8 Detector] -->|Person BBoxes| Tracker[Single Camera Tracker]
        Tracker -->|Crop| Face[SCRFD Face Detector]
        Face -->|Face Crop| Arc[ArcFace Embedder]
        Tracker -->|Body Crop| ReID[TransReID Body Embedder]
        Arc & ReID -->|Vectors| GT[Global Tracker]
    end

    %% Storage & Relay
    GT -->|Query / Upsert| Milvus[(Milvus Vector DB)]
    GT -->|Publish Coordinates| Redis[(Redis Pub/Sub)]
    
    %% Backend
    subgraph FastAPI Backend
        Sub[Redis Subscriber Task] <--|Subscribe ws_events| Redis
        API[REST API Endpoints] -->|Read / Write| PG[(PostgreSQL DB)]
        API -->|Push Alerts| Redis
        Web[WebSocket Server] <--|Relay Events| Sub
    end

    %% Frontend
    subgraph React Dashboard
        UI[React UI Panels] <--|Real-time WS Coordinates & Alerts| Web
        UI -->|HTTP Requests| API
    end
```

### Event Cycle:
1. **Frames Ingestion**: OpenCV captures RTSP streams in parallel processes.
2. **Object Detection & Local Tracking**: YOLOv8 locates individuals; a local tracker numbers them.
3. **Biometrics Extraction**: Face detection (SCRFD) and body re-identification (TransReID) extract vector embeddings.
4. **Central Identification**: A global matching service checks candidate vectors against **Milvus** vector storage to assign/retain a unique global ID (`global_id`).
5. **Real-time Event Broadcast**: Global ID positions and alerts are published to the `ws_events` channel in **Redis**.
6. **WebSocket Relay**: A background subscriber task in the **FastAPI lifespan** intercepts the Redis channel events and pushes them to connected web sockets.
7. **Frontend Update**: The **React Dashboard** renders the real-time movement of individuals on the interactive floor map and fires alert toasts.

---

## 📁 Directory Structure & Component Map

Here is an overview of where things are located in the repository:

```
airport_proj_2/
├── backend/                    # FastAPI web application
│   ├── app/
│   │   ├── api/                # HTTP routes & WebSockets endpoints
│   │   │   ├── routes/         # Router controllers (auth, cameras, visitors, etc.)
│   │   │   └── websocket.py    # WebSocket Server & Redis Subscriber relay
│   │   ├── core/               # Configuration settings, security helper, DB session
│   │   ├── models/             # SQLAlchemy ORM models (models.py)
│   │   ├── schemas/            # Pydantic schemas (request validation & response shapes)
│   │   ├── services/           # Business logic (alerting rules, analytics rollup)
│   │   └── workers/            # Celery tasks (heavy analytics reporting, bulk uploads)
│   ├── alembic/                # Database migrations
│   ├── requirements.txt        # Backend dependencies
│   └── Dockerfile              # Production FastAPI Docker image
├── frontend/                   # React dashboard
│   ├── src/
│   │   ├── components/         # Reusable dashboard pages and panels
│   │   │   ├── LayoutEditor/   # Floor plan editor (Canvas rendering engine)
│   │   │   ├── AlertPanel/     # Real-time alert list & ACK workflows
│   │   │   ├── Dashboard.tsx   # Dashboard analytics widgets & KPI stats
│   │   │   └── LiveFeeds.tsx   # Multi-camera Grid controller (1-4 columns)
│   │   ├── hooks/              # Axios-based hooks API clients
│   │   ├── stores/             # Zustand state managers (contains mock stores for Demo Mode)
│   │   ├── App.tsx             # Main router & layout structure
│   │   └── index.css           # Custom CSS styling variables & components
│   ├── index.html              # Frontend template entry point
│   ├── tsconfig.json           # TypeScript configuration
│   └── Dockerfile              # Production NGINX frontend Docker image
├── processing/                 # AI/ML Computer Vision Pipeline
│   ├── pipeline/               # Multi-camera process pipelines & OpenCV captures
│   ├── workers/                # Face detectors, ArcFace, YOLO, TransReID implementation
│   ├── requirements.txt        # ML dependencies (OpenCV, PyTorch/ONNX Runtime)
│   └── Dockerfile.gpu          # GPU-accelerated container definitions for pipeline
├── scripts/                    # Infrastructure automation scripts
│   ├── setup-local.sh          # Folder creation, OS detection & tool checking
│   ├── download-models.sh      # Shell download scripts for ML weights (ONNX format)
│   ├── generate-trt-engines.sh # TensorRT compiler command utility
│   ├── start.sh / stop.sh      # Service daemon utilities
│   └── health-check.sh         # Basic health assessment checks
├── tests/                      # Python pytest testing suite
│   ├── conftest.py             # Test database session setup
│   └── unit/                   # Unit tests (cameras, zones, visitors, break compliant)
├── Makefile                    # Developer CLI command router
├── docker-compose.yml          # Core orchestrator file (Postgres, Redis, Milvus, Backend, Web)
├── docker-compose.gpu.yml      # Override file adding GPU pass-throughs
└── docker-compose.monitoring.yml # Override file for Prometheus + Grafana dashboards
```

---

## 🛠️ Local Environment Setup

### Prerequisites
- **Docker Desktop** (or Docker Engine on Linux)
- **Node.js** v18+ & **npm**
- **Python** 3.10 to 3.13
- **PostgreSQL** 15+ & **Redis** 7+ (only needed if running bare-metal, otherwise Docker covers it)

### Quick Boot (Docker)
The entire stack can be launched with Docker Compose:
```bash
# 1. Clone & Copy config template
cp .env.example .env

# 2. Setup standard folders
make setup

# 3. Download weights (pre-trained YOLOv8, SCRFD, ArcFace, TransReID)
make download-models

# 4. Spin up the containers (includes CPU or GPU detection)
./scripts/start.sh
```

### Running Bare-Metal for Debugging

#### 1. Spin up Core Infrastructure
Start database, cache, and vector indexes:
```bash
docker compose up -d postgres redis etcd minio milvus
```

#### 2. Local Backend Run
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start FastAPI dev server (hot reloading on localhost:8000)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 3. Local Frontend Run
```bash
cd frontend
npm install

# Start Vite server (runs on localhost:5173)
npm run dev
```

---

## 🗄️ Database Schemas & Relations

All database definitions reside in [models.py](file:///Volumes/Oswald%20Stack/alwar%20kuruchi/chairman%20requirement/backend/app/models/models.py). The key entities are:

1. **User**: Operators and Administrators with encrypted credentials (`hashed_password`).
2. **Camera**: RTSP configurations, floor coordinates (`x_coord`, `y_coord`), and angle parameters for the Layout Editor.
3. **Layout**: Floor plans with base floor number indices and path strings to images.
4. **Zone**: Polygonal areas (DWELL, TRIPWIRE, RESTRICTED, LOUNGE) defined as JSON coordinate arrays.
5. **Visitor**: Registered individuals (passports, watchlists, photo paths, facial hashes).
6. **Employee**: Shift registry containing break configuration limits (e.g., `break_interval_minutes` defaults to 120 minutes).
7. **EmployeeBreak**: Track records of breaks. Calculates elapsed break times and labels compliance violations if workers remain in labor zones beyond 2 hours.
8. **ActiveTrack**: Fast-lookup mapping table pairing local tracking detections with a centralized global identity.
9. **Alert**: Real-time events triggered by unauthorized access, loitering breaches, tailgating, or break intervals.

---

## 💡 Frontend Features to Note

### 🎨 Visual Theme System
The UI complies with a strictly defined, **high-contrast dark dashboard color palette**:
- Backgrounds: Solid Jet Black (`#0a0a0a` / `#121212`)
- Texts & Outlines: Titanium White (`#ffffff` / `#e5e7eb`)
- Accents & Alerts: High-Alert Red (`#ef4444`) & Infrastructure Green (`#10b981`)
- Typography: Inter (primary) & JetBrains Mono (metrics and codes)

Styles are defined globally in [index.css](file:///Volumes/Oswald%20Stack/alwar%20kuruchi/chairman%20requirement/frontend/src/index.css). Ad-hoc utility colors should be avoided; use standard semantic variable names (`var(--green)`, `var(--red)`, `var(--black)`, etc.) to maintain visual harmony.

### 🗺️ Interactive Floor Layout Editor
The Layout Editor ([LayoutEditor.tsx](file:///Volumes/Oswald%20Stack/alwar%20kuruchi/chairman%20requirement/frontend/src/components/LayoutEditor.tsx)) utilizes HTML5 Canvas for dragging and dropping camera icons, rotating FoV (Field of View) cones, and defining custom perimeter bounds (polygons).
- **Coordinate System**: Layout coordinates are normalized percentages `(0.0 - 100.0)` mapped to the floor plan canvas size so that layouts render consistently across screen sizes.
- **Auto-Save**: Layout changes auto-save back to the FastAPI backend dynamically.

### 🔌 Demo Mode Bypass
If you are developing the UI without having the full AI pipeline running, you can click **"Launch Demo Mode"** on the Login Screen.
- This bypasses backend authentication checks and loads **Zustand mock state stores** that feed fake trackers, alerts, and visitor events to the UI so you can test transitions and widgets instantly.

---

## 🧪 Testing & Verification

We have unit and integration tests written in `pytest`. Ensure they pass before submitting pull requests.

```bash
# In the backend directory with venv activated:
pytest ../tests/unit/test_backend.py -v
```

This verifies:
- Camera CRUD operations
- Restricted Zone intrusion alerting rules
- Visitor registration validation
- Employee Shift Break compliant calculations

---

## ⚠️ Critical Troubleshooting & Known Gotchas

### 1. Python 3.12+ / 3.13 Hashing Bug (`passlib` + `bcrypt` mismatch)
If you attempt to register or login a user, you might encounter a crash:
```
passlib.handlers.bcrypt.ValueError: password cannot be longer than 72 bytes, truncate manually if necessary
```
* **Why**: The third-party Python library `passlib` is unmaintained. When newer versions of the `bcrypt` library (4.1.0+) are installed under Python 3.12 or 3.13, `passlib`'s internal validation fails.
* **Workaround**: Either pin `bcrypt==4.0.1` in `requirements.txt` OR modify [security.py](file:///Volumes/Oswald%20Stack/alwar%20kuruchi/chairman%20requirement/backend/app/core/security.py) to use standard `bcrypt` directly instead of wrapping it inside `passlib.context.CryptContext`.

**Suggested direct `bcrypt` fix for [security.py](file:///Volumes/Oswald%20Stack/alwar%20kuruchi/chairman%20requirement/backend/app/core/security.py):**
```python
import bcrypt

def hash_password(plain_password: str) -> str:
    pwd_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)
```

### 2. Standalone Milvus Vector DB Startup Failure
If the `milvus` container fails to start during `docker compose up`:
* **Cause**: Milvus requires its dependency services `etcd` and `minio` to be fully initialized.
* **Fix**: Ensure that the data directories `/var/lib/milvus` and the local mapping directories `./config/milvus/milvus.yaml` have write permissions. You can also inspect the logs: `docker compose logs milvus`.

### 3. RTSP Capture Loop Failures
When running the AI processing pipeline locally without physical cameras:
* The pipeline will automatically attempt to locate a local webcam (device ID `0` or `1`) as a fallback if the configured RTSP url is a single digit.
* If no webcams are found, you can modify `processing/pipeline/camera_pipeline.py` to point to a loop of a local sample MP4 file (e.g., `cv2.VideoCapture("assets/sample_video.mp4")`).

### 4. GPU vs. CPU execution
* On Linux machines with an NVIDIA GPU, make sure to install the **NVIDIA Container Toolkit** so that the `video_processor` container can access CUDA resources.
* On macOS, the models run on CPU execution mode (using standard CPU execution providers in ONNX Runtime). Ensure `USE_GPU=false` is set in the environment files.





