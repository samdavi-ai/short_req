"""
CameraPipeline — Complete per-camera inference pipeline.

Orchestrates all processing workers for a single camera stream:
  1. YOLOv8 person detection + ByteTrack
  2. Single-camera local tracking
  3. Face detection & embedding extraction
  4. Body ReID embedding extraction
  5. Head-top embedding extraction
  6. Cross-camera GlobalTracker fusion
  7. Identity resolution (known/unknown/watchlist)
  8. Zone intrusion evaluation
  9. Entry/exit tripwire counting
  10. Employee break monitoring
  11. Track persistence to database
  12. Real-time WebSocket event publishing
"""

import cv2
import time
import os
import json
import logging
import requests
import redis
import numpy as np

from workers.person_detector import PersonDetector
from workers.single_cam_tracker import SingleCameraTracker
from workers.face_detector import FaceDetector
from workers.face_embedder import FaceEmbedder
from workers.body_reid import BodyReIDEmbedder
from workers.head_top_embedder import HeadTopEmbedder
from workers.global_tracker import GlobalTracker
from workers.watchlist_matcher import WatchlistMatcher
from workers.identity_resolver import IdentityResolver
from workers.intrusion_engine import IntrusionEngine
from workers.entry_exit_counter import EntryExitCounter
from workers.break_monitor import EmployeeBreakMonitor
import utils.database_logger as db_log

from app.core.database import SessionLocal
from app.models.models import Camera, Zone, ZoneType

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Shared singletons (shared across all camera pipelines) ────────────────────
# These are initialized once and shared so cross-camera matching works.

_shared_global_tracker = None
_shared_watchlist_matcher = None
_shared_identity_resolver = None
_shared_break_monitor = None


def _get_shared_instances(redis_client):
    """Initialize shared singletons on first call."""
    global _shared_global_tracker, _shared_watchlist_matcher
    global _shared_identity_resolver, _shared_break_monitor

    if _shared_global_tracker is None:
        _shared_global_tracker = GlobalTracker()
        _shared_watchlist_matcher = WatchlistMatcher()
        _shared_identity_resolver = IdentityResolver(
            _shared_global_tracker, _shared_watchlist_matcher, redis_client
        )
        _shared_break_monitor = EmployeeBreakMonitor(redis_client)

        # Load enrolled faces from DB
        _load_enrolled_faces()

    return (_shared_global_tracker, _shared_watchlist_matcher,
            _shared_identity_resolver, _shared_break_monitor)


def _load_enrolled_faces():
    """
    Load face embeddings from two sources into the WatchlistMatcher:
      1. database.db → enrolled_identities (primary: john, ponniyah, dinesh etc.)
         - person_type = 'EMPLOYEE' → treated as known employee (green badge)
         - person_type = 'VISITOR'  → treated as known visitor
      2. backend DB → visitors / employees tables (secondary, for UI-registered people)

    Anyone NOT in either registry will be classified as UNKNOWN (potential intruder).
    """
    global _shared_watchlist_matcher
    import utils.database_logger as db_log

    visitors = []
    employees = []

    # ── Source 1: database.db enrolled_identities (real binary face vectors) ──
    try:
        enrolled = db_log.load_enrolled_identities()
        for person in enrolled:
            face_vec = person.get("face_vector")
            if not face_vec:
                continue
            ptype = (person.get("person_type") or "EMPLOYEE").upper()
            if ptype == "VISITOR":
                visitors.append({
                    "id": person["id"],
                    "fullname": person["name"],
                    "status": "WHITELISTED",
                    "face_vector": face_vec,
                })
            else:
                # EMPLOYEE or any other type → treated as whitelisted employee
                employees.append({
                    "id": person["id"],
                    "fullname": person["name"],
                    "employee_code": f"EMP-{person['id']:03d}",
                    "face_vector": face_vec,
                })
        logger.info(
            "_load_enrolled_faces: loaded %d employees + %d visitors from database.db",
            len(employees), len(visitors)
        )
    except Exception as e:
        logger.error("Failed to load from database.db enrolled_identities: %s", e)

    # ── Source 2: backend DB visitors / employees (JSON-encoded embeddings) ──
    db = SessionLocal()
    try:
        from app.models.models import Visitor, Employee

        for v in db.query(Visitor).filter(Visitor.face_embedding_id.isnot(None)).all():
            vec = _parse_stored_vector(v.face_embedding_id)
            if vec is not None:
                visitors.append({
                    "id": v.id,
                    "fullname": v.fullname,
                    "status": v.status.value if hasattr(v.status, 'value') else str(v.status),
                    "face_vector": vec,
                })

        for e in db.query(Employee).filter(Employee.face_embedding_id.isnot(None)).all():
            vec = _parse_stored_vector(e.face_embedding_id)
            if vec is not None:
                employees.append({
                    "id": e.id,
                    "fullname": e.fullname,
                    "employee_code": e.employee_code,
                    "face_vector": vec,
                })

    except Exception as e:
        logger.error("Failed to load enrolled faces from backend DB: %s", e)
    finally:
        db.close()

    _shared_watchlist_matcher.load_registry(visitors, employees)
    logger.info(
        "_load_enrolled_faces complete: %d employees, %d visitors in registry.",
        len(employees), len(visitors)
    )


def _parse_stored_vector(embedding_id_or_json):
    """
    Parse a stored face embedding. Supports:
      - JSON array: "[0.1, 0.2, ...]"
      - Placeholder string: "face_embed_123_abc" → returns None
    """
    if not embedding_id_or_json:
        return None
    try:
        vec = json.loads(embedding_id_or_json)
        if isinstance(vec, list) and len(vec) > 0:
            return vec
    except (json.JSONDecodeError, TypeError):
        pass
    return None


class CameraPipeline:
    # Layout canvas reference dimensions (matches frontend LayoutEditor and seed_alpha2 zone coords)
    LAYOUT_WIDTH = 1200
    LAYOUT_HEIGHT = 800
    # Track persistence batch interval (seconds)
    PERSIST_INTERVAL = 5.0

    def __init__(self, camera_id: int, rtsp_url: str):
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url

        # Redis connection
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis_client = redis.from_url(redis_url, decode_responses=True)

        # ── Per-camera workers ────────────────────────────────────────────
        self.detector = PersonDetector()
        self.tracker = SingleCameraTracker()
        self.face_detector = FaceDetector()
        self.face_embedder = FaceEmbedder(face_detector=self.face_detector)
        self.body_reid = BodyReIDEmbedder()
        self.head_embedder = HeadTopEmbedder()
        self.intrusion_engine = IntrusionEngine(self.redis_client)
        self.entry_exit_counter = EntryExitCounter()

        # ── Shared cross-camera workers ───────────────────────────────────
        (self.global_tracker,
         self.watchlist_matcher,
         self.identity_resolver,
         self.break_monitor) = _get_shared_instances(self.redis_client)

        # ── Camera metadata from DB ───────────────────────────────────────
        self.floor = 1
        self.camera_name = f"Camera {self.camera_id}"
        self.status = "ACTIVE"
        self.is_overhead = True  # default: overhead-first design
        self._last_status_check_time = 0.0
        self._load_camera_config()

        # ── Track persistence batch buffer ────────────────────────────────
        self._track_buffer = []
        self._last_persist_time = time.time()

        # ── Load zone tripwires for entry/exit counting ───────────────────
        self._tripwire_zones = []
        self._lounge_zones = []
        self._load_zones()

    def _load_camera_config(self):
        """Load camera floor, name, status, and is_overhead from DB."""
        db = SessionLocal()
        try:
            camera = db.query(Camera).filter(Camera.id == self.camera_id).first()
            if camera:
                self.floor = camera.floor
                self.camera_name = camera.name
                self.status = camera.status.value if hasattr(camera.status, 'value') else str(camera.status)
                self.is_overhead = camera.is_overhead if camera.is_overhead is not None else True
        except Exception as e:
            logger.error("Failed to query camera config: %s", e)
        finally:
            db.close()

    def _load_zones(self):
        """Load TRIPWIRE and LOUNGE zones for this camera's floor."""
        db = SessionLocal()
        try:
            zones = db.query(Zone).filter(
                Zone.floor == self.floor, Zone.is_active == True
            ).all()
            for z in zones:
                if z.zone_type == ZoneType.TRIPWIRE:
                    # Tripwire zones store coordinates as a line: [{x,y}, {x,y}]
                    coords = z.coordinates
                    if coords and len(coords) >= 2:
                        self._tripwire_zones.append({
                            "zone_id": z.id,
                            "line": (
                                coords[0].get("x", 0), coords[0].get("y", 0),
                                coords[1].get("x", 0), coords[1].get("y", 0),
                            ),
                        })
                elif z.zone_type == ZoneType.LOUNGE:
                    self._lounge_zones.append({
                        "zone_id": z.id,
                        "name": z.name,
                        "points": z.coordinates,
                    })
        except Exception as e:
            logger.error("Failed to load zones: %s", e)
        finally:
            db.close()

    def run(self):
        """Main processing loop — reads from video source and processes frames."""
        logger.info("Starting inference pipeline on '%s' (ID: %d, Floor: %d)...",
                     self.camera_name, self.camera_id, self.floor)

        input_source = int(self.rtsp_url) if self.rtsp_url.isdigit() else self.rtsp_url
        cap = cv2.VideoCapture(input_source)

        if not cap.isOpened():
            logger.error("Failed to open video source: %s", input_source)
            return

        frame_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                if isinstance(input_source, str) and os.path.exists(input_source):
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                time.sleep(1)
                continue

            frame_count += 1
            if frame_count % 3 != 0:
                continue

            self.process_frame(frame)
            time.sleep(0.03)

        cap.release()

    def process_frame(self, frame: np.ndarray):
        """
        Process a single video frame through the full pipeline.
        Called by both `run()` (live) and `run_video.py` (test).
        """
        # Periodic status check
        now = time.time()
        if now - self._last_status_check_time > 2.0:
            db = SessionLocal()
            try:
                camera = db.query(Camera).filter(Camera.id == self.camera_id).first()
                if camera:
                    new_status = camera.status.value if hasattr(camera.status, 'value') else str(camera.status)
                    if new_status == "PAUSED" and self.status != "PAUSED":
                        # Transitioned to PAUSED: mark active tracks as inactive in DB
                        from app.models.models import ActiveTrack
                        db.query(ActiveTrack).filter(
                            ActiveTrack.camera_id == self.camera_id,
                            ActiveTrack.is_active == True,
                        ).update({"is_active": False}, synchronize_session=False)
                        db.commit()
                        self._track_buffer.clear()
                        logger.info("[Camera %d] Paused. Marked all active tracks as inactive.", self.camera_id)
                    self.status = new_status
            except Exception as e:
                logger.error("Failed to check camera status during process_frame: %s", e)
            finally:
                db.close()
            self._last_status_check_time = now

        if self.status == "PAUSED":
            return

        h, w = frame.shape[:2]

        # ── 1. Person detection + ByteTrack ───────────────────────────────
        tracked_objects = self.detector.detect_and_track(frame)

        # ── 2. Local state management ─────────────────────────────────────
        tracks = self.tracker.update(tracked_objects)

        # Build a quick lookup: track_id -> detection confidence
        conf_by_track_id = {t["track_id"]: t.get("conf", 0.0) for t in tracked_objects}

        for track_id, bbox in tracks:
            x1, y1, x2, y2 = bbox
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)

            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                continue

            # ── 3. Face detection + embedding ─────────────────────────────
            face_bbox = self.face_detector.detect_faces(crop)
            has_face = face_bbox is not None
            face_vector = None

            if has_face:
                fx1, fy1, fx2, fy2 = face_bbox
                face_crop = crop[fy1:fy2, fx1:fx2]
                if face_crop.size > 0:
                    face_vector = self.face_embedder.extract_embedding(face_crop)

            # ── 4. Body ReID embedding ────────────────────────────────────
            body_vector = self.body_reid.extract_embedding(crop)

            # ── 5. Head-top embedding (upper 30% of person crop) ──────────
            head_crop = crop[0:int(crop.shape[0] * 0.3), :]
            head_vector = self.head_embedder.extract_embedding(head_crop) if head_crop.size > 0 else None

            # ── 6. Cross-camera GlobalTracker matching ────────────────────
            global_id = self.global_tracker.match_or_create(
                face_vector=face_vector,
                body_vector=body_vector,
                head_vector=head_vector,
                camera_id=self.camera_id,
                floor=self.floor,
                is_overhead=self.is_overhead,
            )

            # ── 7. Identity resolution (known/unknown/watchlist) ──────────
            identity = self.identity_resolver.resolve(
                global_id=global_id,
                face_vector=face_vector,
                body_vector=body_vector,
                head_vector=head_vector,
                camera_id=self.camera_id,
                floor=self.floor,
            )

            # ── 7.1 Save face crop and log detection to database.db with accuracy metrics ──
            face_bbox_list = None
            landmarks_2d_list = None
            landmarks_3d_list = None
            pose_list = None
            gender_val = None
            age_val = None
            
            if has_face:
                last_faces = self.face_detector.last_faces
                if last_faces:
                    # Sort faces to find the largest face
                    f = sorted(last_faces, key=lambda face: (face.bbox[2]-face.bbox[0])*(face.bbox[3]-face.bbox[1]), reverse=True)[0]
                    fx1, fy1, fx2, fy2 = int(f.bbox[0]), int(f.bbox[1]), int(f.bbox[2]), int(f.bbox[3])
                    face_crop = crop[fy1:fy2, fx1:fx2]
                    
                    if face_crop.size > 0:
                        # Save the face crop to static/cropped_faces/
                        face_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static", "cropped_faces")
                        os.makedirs(face_dir, exist_ok=True)
                        face_crop_path = os.path.join(face_dir, f"{global_id}.jpg")
                        cv2.imwrite(face_crop_path, face_crop)
                        
                    face_bbox_list = [fx1, fy1, fx2, fy2]
                    landmarks_2d_list = f.landmark_2d_106.tolist() if hasattr(f, "landmark_2d_106") and f.landmark_2d_106 is not None else None
                    landmarks_3d_list = f.landmark_3d_68.tolist() if hasattr(f, "landmark_3d_68") and f.landmark_3d_68 is not None else None
                    pose_list = f.pose.tolist() if hasattr(f, "pose") and f.pose is not None else None
                    gender_val = int(f.gender) if hasattr(f, "gender") and f.gender is not None else None
                    age_val = int(f.age) if hasattr(f, "age") and f.age is not None else None

            # Log to database.db
            db_log.log_detection(
                camera_id=self.camera_id,
                global_id=global_id,
                body_bbox=[x1, y1, x2, y2],
                face_bbox=face_bbox_list,
                face_landmarks_2d=landmarks_2d_list,
                face_landmarks_3d=landmarks_3d_list,
                pose=pose_list,
                gender=gender_val,
                age=age_val,
                match_similarity=identity.get("similarity")
            )

            # ── 8. Map coordinates to layout canvas ───────────────────────
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)
            map_x = int((cx / w) * self.LAYOUT_WIDTH)
            map_y = int((cy / h) * self.LAYOUT_HEIGHT)

            # ── 9. Zone intrusion evaluation ──────────────────────────────
            self.intrusion_engine.evaluate_person(
                global_id=global_id,
                track_id=track_id,
                camera_id=self.camera_id,
                floor=self.floor,
                x=map_x,
                y=map_y,
            )

            # ── 10. Entry/exit tripwire check ─────────────────────────────
            entry_exit_direction = None
            for tw in self._tripwire_zones:
                result = self.entry_exit_counter.check_tripwire(
                    track_id=str(track_id),
                    current_pos=(map_x, map_y),
                    tripwire_line=tw["line"],
                    zone_id=tw["zone_id"],
                )
                if result:
                    entry_exit_direction = result

            # ── 11. Employee break monitoring ─────────────────────────────
            break_status = None
            if identity["identity_type"] == "KNOWN_EMPLOYEE" and identity["matched_person_id"]:
                in_lounge = self._is_in_lounge(map_x, map_y)
                break_status = self.break_monitor.update_employee_status(
                    employee_id=identity["matched_person_id"],
                    in_lounge_zone=in_lounge,
                    camera_id=self.camera_id,
                )

            # ── 12. Publish TRACK_UPDATE via Redis → WebSocket ────────────
            payload = {
                "type": "TRACK_UPDATE",
                "camera_id": self.camera_id,
                "track_id": track_id,
                "global_id": global_id,
                "x": map_x,
                "y": map_y,
                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                "has_face": has_face,
                "identity_type": identity["identity_type"],
                "matched_name": identity["matched_name"],
                "matched_person_id": identity["matched_person_id"],
                "person_type": identity.get("person_type"),
                "matched_via": identity["matched_via"],
                "entry_exit": entry_exit_direction,
                "timestamp": time.time(),
                # ── Accuracy metrics from detection_and_recognition logic ──
                "detection_conf": round(float(conf_by_track_id.get(track_id, 0.0)), 4),
                "face_similarity": round(float(identity["similarity"]), 4) if identity.get("similarity") is not None else None,
            }
            self.redis_client.publish("ws_events", json.dumps(payload))

            # ── 13. Buffer track for DB persistence ───────────────────────
            self._track_buffer.append({
                "camera_id": self.camera_id,
                "track_id": track_id,
                "global_id": global_id,
                "x": map_x,
                "y": map_y,
                "matched_visitor_id": (
                    identity["matched_person_id"]
                    if identity.get("person_type") == "visitor" else None
                ),
                "matched_employee_id": (
                    identity["matched_person_id"]
                    if identity.get("person_type") == "employee" else None
                ),
            })

        # ── Batch persist tracks to DB periodically ───────────────────────
        now = time.time()
        if self._track_buffer and (now - self._last_persist_time) > self.PERSIST_INTERVAL:
            self._persist_tracks()
            self._last_persist_time = now

        # ── Refresh enrolled faces periodically ───────────────────────────
        if self.watchlist_matcher.needs_refresh:
            _load_enrolled_faces()

    def _is_in_lounge(self, x: float, y: float) -> bool:
        """Check if coordinates fall inside any LOUNGE zone polygon."""
        from workers.intrusion_engine import is_point_in_polygon
        for lounge in self._lounge_zones:
            if is_point_in_polygon(x, y, lounge.get("points", [])):
                return True
        return False

    def _persist_tracks(self):
        """Batch-upsert buffered tracks to the active_tracks DB table."""
        if not self._track_buffer:
            return

        db = SessionLocal()
        try:
            from app.models.models import ActiveTrack
            from datetime import datetime, timezone, timedelta

            now = datetime.now(timezone.utc)
            stale_cutoff = now - timedelta(seconds=5)

            # Deduplicate buffer, keeping only the latest update for each unique track_id
            unique_tracks = {}
            for t in self._track_buffer:
                track_id = f"cam_{t['camera_id']}_track_{t['track_id']}"
                unique_tracks[track_id] = t

            # Mark stale tracks for THIS camera as inactive first
            db.query(ActiveTrack).filter(
                ActiveTrack.camera_id == self.camera_id,
                ActiveTrack.is_active == True,
                ActiveTrack.last_seen < stale_cutoff,
            ).update({"is_active": False}, synchronize_session=False)

            for track_id, t in unique_tracks.items():
                existing = db.query(ActiveTrack).filter(ActiveTrack.id == track_id).first()

                if existing:
                    existing.last_seen = now
                    existing.last_x = t["x"]
                    existing.last_y = t["y"]
                    existing.is_active = True
                    existing.global_id = t["global_id"]
                    if t.get("matched_visitor_id"):
                        existing.matched_visitor_id = t["matched_visitor_id"]
                    if t.get("matched_employee_id"):
                        existing.matched_employee_id = t["matched_employee_id"]
                else:
                    new_track = ActiveTrack(
                        id=track_id,
                        camera_id=t["camera_id"],
                        global_id=t["global_id"],
                        local_track_id=t["track_id"],
                        last_x=t["x"],
                        last_y=t["y"],
                        is_active=True,
                        matched_visitor_id=t.get("matched_visitor_id"),
                        matched_employee_id=t.get("matched_employee_id"),
                    )
                    db.add(new_track)

            db.commit()
            logger.debug("Persisted %d track updates to DB.", len(unique_tracks))
        except Exception as e:
            logger.error("Failed to persist tracks: %s", e)
            db.rollback()
        finally:
            db.close()
            self._track_buffer.clear()

