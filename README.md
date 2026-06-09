# Airport Surveillance Platform

An advanced, real-time computer vision and monitoring platform designed for high-security environments like airports. This system combines GPU-accelerated AI models with a reactive React dashboard to provide security personnel with instantaneous insights into passenger flow, restricted zone breaches, and employee management.

## Features

- **Real-Time AI Pipeline:** Utilizes Ultralytics YOLOv8 for sub-millisecond person detection and a ResNet50 embedder for deep cross-camera body re-identification.
- **Global Tracking:** Assigns consistent global track IDs to individuals across multiple camera feeds using cosine similarity embedding matching.
- **Live React Dashboard:** Features a Zustand-powered interactive floor plan (`LayoutEditor`) and live camera feeds (`LiveFeeds`) seamlessly synced over WebSockets.
- **Automated Security Alerts:** Instant alerts for restricted zone intrusions and dwell-time limit violations, sent directly to the dashboard operator.
- **Rich Analytics:** End-to-end `recharts` analytics dashboard providing insights on peak footfalls, hourly occupancy, and alert demographics.

## System Architecture

The application is fully containerized and broken down into 4 core microservices:

1. **`frontend/`**: The React + Vite SPA dashboard. Connects via HTTP REST and WebSockets.
2. **`backend/`**: A FastAPI + PostgreSQL application handling layouts, zones, users, and routing telemetry from the AI pipeline.
3. **`processing/`**: The GPU-accelerated CV pipeline. Reads camera streams, executes YOLOv8 + ByteTrack, and publishes metadata to Redis.
4. **`database/`**: PostgreSQL and Redis containers for state persistence and Pub/Sub event brokering.

## Prerequisites

- **Docker & Docker Compose:** Ensure the Docker daemon is running on your machine.
- *(Optional)* **NVIDIA Container Toolkit:** If running on a GPU-enabled machine, ensure the Nvidia Docker runtime is installed to utilize hardware acceleration for the CV models.

## Getting Started

1. **Build and start the full application stack:**
   ```bash
   docker-compose up --build -d
   ```

2. **Access the application:**
   - **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
   - **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

3. **Verify the services:**
   You can verify all containers are running successfully using:
   ```bash
   docker ps
   ```

## Development and Testing

The project contains a comprehensive automated testing suite.

**Run Backend Unit Tests:**
```bash
cd backend
python3 -m pytest tests/unit/
```

**Run End-to-End Pipeline Tests:**
```bash
PYTHONPATH=backend python3 -m pytest tests/e2e/test_pipeline.py
```

**Run Load Tests (Locust):**
```bash
locust -f tests/load/locustfile.py --host=http://localhost:8000
```