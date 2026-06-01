import cv2
import time
import json
import redis
import os

class VideoIngestWorker:
    def __init__(self, camera_id: int, rtsp_url: str):
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        self.redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
        self.queue_key = f"camera_frames_{camera_id}"
        
    def start(self):
        print(f"Starting Video Ingest for Camera {self.camera_id} from URL: {self.rtsp_url}")
        
        # Use simple OpenCV VideoCapture to simulate or stream RTSP
        # If rtsp_url is an integer, open webcam, else read stream
        cap = None
        try:
            if self.rtsp_url.isdigit():
                cap = cv2.VideoCapture(int(self.rtsp_url))
            else:
                cap = cv2.VideoCapture(self.rtsp_url)
        except Exception as e:
            print(f"Error opening camera {self.camera_id}: {e}")
            return
            
        frame_idx = 0
        while cap and cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                print(f"Camera {self.camera_id} feed disconnected. Retrying...")
                time.sleep(2)
                continue
                
            frame_idx += 1
            if frame_idx % 2 != 0:  # Skip frames to optimize pipeline processing budget
                continue
                
            # Compress and encode frame as jpeg
            _, buffer = cv2.imencode('.jpg', frame)
            
            payload = {
                "camera_id": self.camera_id,
                "frame_index": frame_idx,
                "timestamp": time.time(),
                "frame_bytes": buffer.tobytes().hex()
            }
            
            # Push frame to Redis queue
            self.redis_client.lpush(self.queue_key, json.dumps(payload))
            self.redis_client.ltrim(self.queue_key, 0, 5) # Keep last 5 frames to prevent memory leaks
            
            time.sleep(0.03) # Cap ingestion at ~30 FPS
            
        if cap:
            cap.release()
