import cv2
import time
import os
import json
import redis
from workers.person_detector import PersonDetector
from workers.single_cam_tracker import SingleCameraTracker
from workers.face_detector import FaceDetector
from workers.face_embedder import FaceEmbedder
from workers.body_reid import BodyReIDEmbedder
from workers.global_tracker import GlobalTracker

class CameraPipeline:
    def __init__(self, camera_id: int, rtsp_url: str):
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        self.redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
        
        # Load AI pipeline components
        self.detector = PersonDetector("models/yolov8l.onnx", use_gpu=False)
        self.tracker = SingleCameraTracker()
        self.face_detector = FaceDetector("models/scrfd_10g.onnx")
        self.face_embedder = FaceEmbedder("models/arcface_r100.onnx")
        self.reid_embedder = BodyReIDEmbedder("models/transreid_vit.onnx")
        self.global_tracker = GlobalTracker()
        
    def run(self):
        print(f"Starting inference pipeline on camera {self.camera_id}...")
        
        # Create a simple simulator using local frame reader
        cap = cv2.VideoCapture(0 if self.rtsp_url.isdigit() else self.rtsp_url)
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                time.sleep(1)
                continue
                
            # 1. Object detection
            detections = self.detector.detect(frame)
            
            # 2. Local tracking
            tracks = self.tracker.update(detections)
            
            for track_id, bbox in tracks:
                x1, y1, x2, y2 = bbox
                crop = frame[int(y1):int(y2), int(x1):int(x2)]
                if crop.size == 0:
                    continue
                    
                # 3. Face embedder
                face_bbox = self.face_detector.detect_faces(crop)
                face_emb = None
                if face_bbox:
                    fx1, fy1, fx2, fy2 = face_bbox
                    face_crop = crop[fy1:fy2, fx1:fx2]
                    if face_crop.size > 0:
                        face_emb = self.face_embedder.extract_embedding(face_crop)
                        
                # 4. Body Re-ID Embedder
                body_emb = self.reid_embedder.extract_embedding(crop)
                
                # 5. Global Track Matcher
                global_id = self.global_tracker.match_or_create(face_emb, body_emb, None, self.camera_id)
                
                # Push coordinates and tracking metadata back to WebSocket queue
                payload = {
                    "type": "TRACK_UPDATE",
                    "camera_id": self.camera_id,
                    "track_id": track_id,
                    "global_id": global_id,
                    "x": int((x1 + x2) / 2),
                    "y": int((y1 + y2) / 2),
                    "bbox": [int(x1), int(y1), int(x2), int(y2)],
                    "timestamp": time.time()
                }
                self.redis_client.publish("ws_channel", json.dumps(payload))
                
            time.sleep(0.1) # Simulate real frame delay
            
        cap.release()
