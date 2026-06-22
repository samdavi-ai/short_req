# Feature Map: Airport Surveillance System

This document outlines the full suite of features implemented in the Airport Surveillance System, mapping each functionality to its core code implementation files and detailing the application's current state.

---

## 🎥 1. Multi-Camera Live Feeds
* **Multi-grid Live View**: Supports grid layouts including 1×1, 2×2, 3×3, and 4×4.
  * Implemented in [LiveFeeds.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/LiveFeeds.tsx)
* **Streaming & Media Support**: Handles both live RTSP streams and static MP4 video file inputs.
* **Floor-based Camera Filtering**: Allows operators to filter live feeds according to building floors.
* **Camera Status Tracking**: Real-time camera health tracking indicating `ACTIVE`, `OFFLINE`, `PAUSED`, or `MAINTENANCE`.
* **Real-time Bounding Box Overlay**: Renders bounding boxes synced directly from the AI detection pipeline onto live feeds.
* **Dynamic RTSP Discovery**: Automatically discovers and spawns pipeline instances for newly registered RTSP cameras within 10 seconds.
* **Local Webcam Streaming Bypass**: Prevents mock video loops for digit RTSP URLs (e.g. `0`, `1`). Instead, launches browser-side webcam access using `getUserMedia` when active on the feeds tab.
  * Implemented in [LiveFeeds.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/LiveFeeds.tsx)

---

## 🤖 2. AI Detection & Tracking Pipeline

| Worker | Description | File |
| :--- | :--- | :--- |
| **Person Detector** | YOLOv8 person detection with confidence scoring. | [person_detector.py](file:///Users/samdavi/projects/short_req/processing/workers/person_detector.py) |
| **Local Tracker** | ByteTrack per-camera local frame-to-frame object tracking. | [single_cam_tracker.py](file:///Users/samdavi/projects/short_req/processing/workers/single_cam_tracker.py) |
| **Global Tracker** | Cross-camera ReID assigning a unified global tracking ID to individuals. | [global_tracker.py](file:///Users/samdavi/projects/short_req/processing/workers/global_tracker.py) |
| **Face Detector** | InsightFace face detection, pose estimation, and demographic landmarks. | [face_detector.py](file:///Users/samdavi/projects/short_req/processing/workers/face_detector.py) |
| **Face Embedder** | ArcFace 512-dimensional vector embedding extraction from faces. | [face_embedder.py](file:///Users/samdavi/projects/short_req/processing/workers/face_embedder.py) |
| **Body ReID** | 2048-dimensional body appearance vector representation extractor. | [body_reid.py](file:///Users/samdavi/projects/short_req/processing/workers/body_reid.py) |
| **Head Top Embedder** | 256-dimensional head/cap feature extraction for overhead views. | [head_top_embedder.py](file:///Users/samdavi/projects/short_req/processing/workers/head_top_embedder.py) |
| **Local Device Support**: Maps numeric RTSP URLs to integer handles (e.g., `0` to `0`), enabling webcam integration on the host system. | Built in [run_camera.py](file:///Users/samdavi/projects/short_req/processing/run_camera.py) and [camera_pipeline.py](file:///Users/samdavi/projects/short_req/processing/pipeline/camera_pipeline.py) |

---

## 🪪 3. Identity Recognition
* **Employee Recognition**: Matches detected face embeddings against enrolled databases to identify `KNOWN_EMPLOYEE` identities (e.g., john, ponniyah, dinesh).
* **Visitor Recognition**: Matches detected faces against registered visitor profiles (`KNOWN_VISITOR`).
* **Watchlist Matching**: Identifies individuals matching the watchlist criteria and fires system alerts.
  * Implemented in [watchlist_matcher.py](file:///Users/samdavi/projects/short_req/processing/workers/watchlist_matcher.py)
* **Blacklist Detection**: Automatically triggers immediate critical alerts if a blacklisted face is resolved.
  * Implemented in [identity_resolver.py](file:///Users/samdavi/projects/short_req/processing/workers/identity_resolver.py)
* **Unknown Identification**: Identifies unmatched persons as `UNKNOWN` and treats them as unauthorized.
* **Accuracy Metrics**: Computes detection confidence scores combined with ArcFace face similarity scores for high-fidelity confirmation.
* **Dual-source Face Registry Loading**: Loads identities from both local SQLite database (`database.db`) and PostgreSQL database.
  * Implemented in [camera_pipeline.py](file:///Users/samdavi/projects/short_req/processing/pipeline/camera_pipeline.py) and [database_logger.py](file:///Users/samdavi/projects/short_req/processing/utils/database_logger.py)

---

## 🚧 4. Zone Intrusion Detection
* **Restricted Zone Configuration**: Allows security operators to draw physical restricted zones onto the floor layout.
  * Backend processing engine: [intrusion_engine.py](file:///Users/samdavi/projects/short_req/processing/workers/intrusion_engine.py)
* **Intrusion Alerts**: Automatically generates security alerts whenever unauthorized persons breach active zones.
* **Zone Classification**: Supports `RESTRICTED`, `DWELL`, and `TRIPWIRE` zone configurations.
* **Zone Configuration API**: CRUD operations and mapping of zones.
  * Implemented in [zones.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/zones.py)

---

## 🚪 5. Entry / Exit Counting (Tripwire)
* **Virtual Tripwires**: Enables plotting line segments onto floor layouts to track and count crossing events.
  * Backend engine: [entry_exit_counter.py](file:///Users/samdavi/projects/short_req/processing/workers/entry_exit_counter.py)
* **Bi-directional Counting**: Keeps track of `IN` and `OUT` crossing counts.
* **Directional Journey Mapping**: Tracks movement direction mapped directly to a person's unified `global_id`.

---

## ☕ 6. Employee Break Monitoring
* **Lounge Zone Entry Auditing**: Audits employees entering break/lounge zones against pre-defined break schedules.
  * Backend engine: [break_monitor.py](file:///Users/samdavi/projects/short_req/processing/workers/break_monitor.py)
* **Duration Compliance Tracking**: Computes duration spent within lounge zones to flag over-break violations.
* **Employee Break UI**: Dedicated frontend interface to view compliance metrics.
* **Real-time Notifications**: Publishes break compliance alerts instantly over WebSocket connections.

---

## 🗺️ 7. Live Tracking Map
* **2D Real-time Floor Layouts**: Renders color-coded dots representing active people journeys on a live map coordinate space.
  * Location: [TrackingMap index.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/TrackingMap/index.tsx)
* **Layout Editor**: Dynamic editor tool to draw polygons for zones and line segments for tripwires.
  * Implemented in [LayoutEditor.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/LayoutEditor.tsx)
* **Role Color Coding**:
  * **Green**: Employee (`KNOWN_EMPLOYEE`)
  * **Blue**: Visitor (`KNOWN_VISITOR`)
  * **Red**: Unknown / Blacklisted (`UNKNOWN` / `BLACKLISTED`)
* **Journey Trajectories**: Draws connection paths representing an individual's floor-to-floor trajectory journey.

---

## 🔍 8. Person Search & Journey
* **Person Lookup (Dynamic statistics)**: Comprehensive lookup portal querying real-time tracking history, first/last seen timestamps, dwell duration, and visit count.
  * Implemented in [PersonLookupPage.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/PersonLookupPage.tsx)
* **Journey Timeline View**: Displays a chronological timeline of camera appearances per individual.
  * Implemented in [PersonJourney.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/PersonJourney.tsx)
* **Person Detail Modal**: Deep dive modal profile containing full track history, statistics, and profile images.
  * Implemented in [PersonDetailModal.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/PersonDetailModal.tsx)
* **Interactive Record Deletion**: Allows supervisors to delete employee or visitor records directly from the detail modal or lookup pane with inline double-confirmation, updating backend stores.
  * Implemented in [PersonDetailModal.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/PersonDetailModal.tsx) and [PersonLookupPage.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/PersonLookupPage.tsx)
* **Authorized vs Unauthorized Card**: High-visibility card highlighting security clearance status and biometric match confidence.
  * Implemented in [PersonCard.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/PersonCard.tsx)
* **Tracking History API**: Returns historical tracking logs for individual matching profiles.
  * Implemented in [tracks.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/tracks.py)

---

## 🚨 9. Real-Time Alerts System
* **WebSocket Alerts**: Immediate delivery of critical occurrences straight to client terminals.
  * Implemented in [websocket.py](file:///Users/samdavi/projects/short_req/backend/app/api/websocket.py)
* **Alert Categories**: Covers `WATCHLIST_MATCH`, `CAMERA_OFFLINE`, `ZONE_INTRUSION`, and `BREAK_VIOLATION`.
* **Management & Triage**: Supports severity levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) and alert acknowledgement workflows.
* **Alert Ticker**: Header-level ticker displaying real-time alert rolls.
  * Implemented in [AlertTicker.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/AlertTicker.tsx)
* **Alerts Archive**: Central archive query page.
  * Implemented in [AlertsPage.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/AlertsPage.tsx)

---

## 📊 10. Analytics & Dwell Heatmap
* **Analytics Views**: Graphs illustrating historical passenger load distribution and counts.
  * Implemented in [AnalyticsPage.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/AnalyticsPage.tsx)
* **Dwell Heatmap Overlay**: Heatmap representation showing high dwell activity areas per layout zone.
  * Location: [DwellHeatmap/](file:///Users/samdavi/projects/short_req/frontend/src/components/DwellHeatmap/)
* **Analytics Backend API**: Returns statistics, aggregation metrics, and heat data.
  * Implemented in [analytics.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/analytics.py)

---

## 👥 11. People Registry Management
* **Visitor Management UI**: Registers new visitors, enrolls source images, and designates safety lists.
  * Implemented in [VisitorsPage.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/VisitorsPage.tsx)
* **Employee Management UI**: Registry portal for enrolling employees with matching facial biometric profiles.
  * Implemented in [EmployeesPage.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/EmployeesPage.tsx)
* **Face Enrollment API Endpoint**: Handles biometric vectorization requests and writes directly to storage.
  * Implemented in [enrollment.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/enrollment.py)

---

## 🏢 12. Infrastructure Management
* **Hierarchical Infrastructure APIs**:
  * **Sites**: [sites.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/sites.py)
  * **Buildings**: [buildings.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/buildings.py)
  * **Layouts**: [layouts.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/layouts.py)
* **Camera Administration**: CRUD operations on cameras, mapping camera models, and registration of live RTSP streams.
  * Implemented in [cameras.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/cameras.py)

---

## 🔐 13. Auth, Security & Passwords
* **Access Tokens**: Secure JSON Web Token (JWT) credentials authentication backend.
  * Implemented in [auth.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/auth.py)
* **Role-Based Access Control**: Differentiates permissions between standard `security operator` and `admin` roles.
* **LoginPage UI**: Dedicated login page interface.
  * Implemented in [LoginPage.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/LoginPage.tsx)
* **Password Management**: Added Change Password popup interface under profile icon.
  * Backend routing: [auth.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/auth.py) (`POST /auth/change-password`)
  * Frontend component: [Topbar.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/Topbar.tsx)

---

## 📝 14. Compliance Auditing & Export reporting
* **Audit Logging Model**: Stores security actions, logins/failed logins, user creations, and deletions in a database table.
  * Model: [models.py](file:///Users/samdavi/projects/short_req/backend/app/models/models.py) (`AuditLog`)
  * Routes: [audit.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/audit.py)
* **CSV Export**: Enables downloading monthly audit logs and employee attendance registry logs.
  * Routes: [audit.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/audit.py) (`GET /audit/export`, `GET /employees/export`)
* **Reports Page**: Dashboard UI containing recent activity logs and month-wise export selectors.
  * Component: [ReportsPage.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/ReportsPage.tsx)

---

## 🧪 15. Standalone Video Sandbox Testing
* **Uploader & Annotator**: Allows local sandbox video uploads and runs frame-pacing object recognition overlay outputs.
  * Components: [VideoTestPage.tsx](file:///Users/samdavi/projects/short_req/frontend/src/components/VideoTestPage.tsx)
  * Endpoints: [video_upload.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/video_upload.py) and [video_annotate.py](file:///Users/samdavi/projects/short_req/backend/app/api/routes/video_annotate.py)
