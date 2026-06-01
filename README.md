# 🛫 Airport Security — Intelligent Surveillance & Tracking System

> **Project Codename:** Chairman Requirement  
> **Domain:** Airport Security & Operations  
> **Classification:** High-Accuracy Person Re-Identification & Behavioral Monitoring

---

## 🚀 Overview

A full-stack AI-powered airport surveillance system featuring:
- 📷 **Multi-camera live feed monitoring** (grid view, 1–4 columns)
- 🗺️ **Interactive Layout Editor** — drag-and-drop camera placement on floor plans
- 🔴 **Real-time Alert Management** — CRITICAL/HIGH/MEDIUM/LOW with acknowledge workflows
- 👤 **Visitor Tracking** — watchlist, blacklist, passport-based registration
- 👨‍💼 **Employee Break Compliance** — mandatory break monitoring per labor regulations
- 📊 **Analytics Dashboard** — footfall, dwell time, alert frequency charts
- 🤖 **AI Pipeline** — YOLOv8 detection + TransReID cross-camera re-identification

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite + Zustand + Recharts |
| **Backend** | FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Celery |
| **Database** | PostgreSQL (production) / SQLite (testing) |
| **Cache / Events** | Redis + WebSockets (real-time pub/sub) |
| **AI Processing** | YOLOv8, ByteTrack, TransReID, ArcFace, SCRFD |
| **Vector DB** | Milvus (ReID + face embeddings) |
| **Deployment** | Docker Compose (fully local, no cloud) |

---

## 📁 Project Structure

```
airport_proj_2/
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── api/routes/     # cameras, alerts, visitors, employees, zones, analytics
│   │   ├── core/           # config, database, security
│   │   ├── models/         # SQLAlchemy ORM models
│   │   └── schemas/        # Pydantic v2 schemas
│   ├── alembic/            # DB migrations
│   └── requirements.txt
├── frontend/               # React + Vite dashboard
│   └── src/
│       ├── components/     # Dashboard, LiveFeeds, LayoutEditor, Alerts, etc.
│       ├── stores/         # Zustand state
│       └── hooks/          # API client
├── processing/             # AI/ML pipeline
│   ├── models/             # YOLOv8, ReID, face models
│   └── workers/            # Detection, tracking, Re-ID workers
├── tests/                  # 20 passing unit tests
├── docker-compose.yml
└── .env.example            # Environment template
```

---

## ⚡ Quick Start

### 1. Clone & Setup
```bash
git clone https://github.com/Aknesys/airport_proj_2.git
cd airport_proj_2
cp .env.example .env
# Edit .env with your database credentials
```

### 2. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL & Redis first, then:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 4. Run Tests
```bash
cd backend
python -m pytest ../tests/unit/test_backend.py -v
# 20/20 tests passing ✅
```

---

## 🖥️ Dashboard Pages

| Page | Description |
|---|---|
| **Dashboard** | Live KPI stats, footfall charts, pending alerts |
| **Live Feeds** | Multi-camera grid (1–4 cols), floor filter, status overlay |
| **Layout Editor** | HTML5 Canvas — drag cameras, draw zones, FoV cones |
| **Alerts** | Filter/acknowledge alerts, bulk actions, severity badges |
| **Visitors** | Watchlist management, passport search, status control |
| **Employees** | Break compliance bars, overdue alerts, schedule tracking |
| **Analytics** | Footfall analysis, alert distribution, dwell time charts |
| **Camera Manager** | RTSP stream management, add/edit/delete cameras |
| **Settings** | System configuration, infrastructure status |

---

## 🔒 Security Notes

- `.env` is **gitignored** — never committed
- Copy `.env.example` → `.env` and set your own credentials
- JWT authentication on all API endpoints
- CORS configured for local development

---

## 📋 Development Status

- ✅ **Backend**: 100% — 20/20 unit tests passing
- ✅ **Frontend**: 100% — 9 pages, build successful (0 errors)
- 🔄 **Processing Pipeline**: In progress (YOLOv8 + ReID)
- 🔄 **Docker Compose**: Final configuration pending
