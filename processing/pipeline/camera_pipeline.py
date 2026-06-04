import cv2
import time
import os
import json
import redis
import logging
from workers.person_detector import PersonDetector
from workers.single_cam_tracker import SingleCameraTracker
from workers.face_detector import FaceDetector
from workers.body_reid import BodyReIDEmbedder
from workers.intrusion_engine import IntrusionEngine
from app.core.database import SessionLocal
from app.models.models import Camera

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CameraPipeline:
    def __init__(self, camera_id: int, rtsp_url: str):
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        
        # Redis connection
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        
        # Load AI workers
        self.detector = PersonDetector()
        self.tracker = SingleCameraTracker()
        self.face_detector = FaceDetector()
        self.body_reid = BodyReIDEmbedder()
        self.intrusion_engine = IntrusionEngine(self.redis_client)
        
        # Retrieve camera specifications from database
        db = SessionLocal()
        try:
            camera = db.query(Camera).filter(Camera.id == self.camera_id).first()
            if camera:
                self.floor = camera.floor
                self.camera_name = camera.name
            else:
                self.floor = 1
                self.camera_name = f"Camera {self.camera_id}"
        except Exception as e:
            logger.error("Failed to query camera floor info: %s", e)
            self.floor = 1
            self.camera_name = f"Camera {self.camera_id}"
        finally:
            db.close()
            
    def run(self):
        logger.info("Starting live computer vision inference pipeline on '%s' (ID: %d)...", self.camera_name, self.camera_id)
        
        # Initialize video capture (0 for webcam, rtsp_url otherwise)
        input_source = 0 if self.rtsp_url.isdigit() or self.rtsp_url == "0" else self.rtsp_url
        cap = cv2.VideoCapture(input_source)
        
        if not cap.isOpened():
            logger.error("Failed to open video source: %s", input_source)
            return

        frame_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                # Loop local video files
                if isinstance(input_source, str) and os.path.exists(input_source):
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                time.sleep(1)
                continue
                
            frame_count += 1
            # Skip frames to keep performance optimal
            if frame_count % 3 != 0:
                continue

            h, w = frame.shape[:2]
            
            # 1. Object detection & tracking (YOLOv8 + ByteTrack)
            tracked_objects = self.detector.detect_and_track(frame)
            
            # 2. Local state management
            tracks = self.tracker.update(tracked_objects)
            
            for track_id, bbox in tracks:
                x1, y1, x2, y2 = bbox
                
                # Safeguard dimensions
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                
                crop = frame[y1:y2, x1:x2]
                if crop.size == 0:
                    continue
                    
                # 3. Face detection (optional)
                face_bbox = self.face_detector.detect_faces(crop)
                has_face = face_bbox is not None
                
                # 4. Extract Body ReID Embedding
                embedding = self.body_reid.extract_embedding(crop)
                
                # 5. Map coordinates to Layout Canvas floorplan size (900x600)
                cx = int((x1 + x2) / 2)
                cy = int((y1 + y2) / 2)
                map_x = int((cx / w) * 900)
                map_y = int((cy / h) * 600)
                
                # Stable global tracking UUID (Wait, we should map this properly using GlobalTracker in Phase 4)
                global_uuid = f"G-{self.camera_id}-{track_id}"
                
                # 6. Evaluate coordinates inside Defined Zones (restricted/loitering)
                self.intrusion_engine.evaluate_person(
                    global_id=global_uuid,
                    track_id=track_id,
                    camera_id=self.camera_id,
                    floor=self.floor,
                    x=map_x,
                    y=map_y
                )
                
                # 7. Publish real-time track updates to WebSocket server via Redis
                payload = {
                    "type": "TRACK_UPDATE",
                    "camera_id": self.camera_id,
                    "track_id": track_id,
                    "global_id": global_uuid,
                    "x": map_x,
                    "y": map_y,
                    "bbox": [int(x1), int(y1), int(x2), int(y2)],
                    "has_face": has_face,
                    "timestamp": time.time(),
                    # "embedding": embedding  # Large, maybe don't send over WS, save to Milvus instead
                }
                self.redis_client.publish("ws_events", json.dumps(payload))
                
            time.sleep(0.03) # ~30 FPS
            
        cap.release()
