import os
import sys
import time
import cv2

# Set up paths
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(ROOT_DIR, "backend"))
sys.path.append(os.path.join(ROOT_DIR, "processing"))

os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(ROOT_DIR, 'backend', 'db.sqlite3')}"

import redis
class MockRedis:
    def publish(self, *args, **kwargs): pass
    def hset(self, *args, **kwargs): pass
    def hgetall(self, *args, **kwargs): return {}
    def delete(self, *args, **kwargs): pass
    def keys(self, *args, **kwargs): return []
redis.from_url = lambda *args, **kwargs: MockRedis()

from app.core.database import SessionLocal, Base, engine
from app.models.models import Camera, ActiveTrack, Alert
from pipeline.camera_pipeline import CameraPipeline

def run():
    print("Connecting to DB:", os.environ["DATABASE_URL"])
    # Make sure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    video_dir = os.path.join(ROOT_DIR, "tests")
    video_files = ["MS1.mp4", "MS2.mp4", "MS3.mp4", "SS1.mp4", "SS2.mp4", "SS3.mp4"]
    
    cameras = []
    for vf in video_files:
        cam_name = vf.split(".")[0]
        vpath = os.path.join(video_dir, vf)
        
        # Check if camera exists
        cam = db.query(Camera).filter(Camera.name == cam_name).first()
        if not cam:
            cam = Camera(name=cam_name, rtsp_url=vpath, location="Test Location", floor=1)
            db.add(cam)
            db.commit()
            db.refresh(cam)
        cameras.append((cam.id, cam.name, vpath))
        print(f"Registered camera {cam.name} with ID {cam.id}")
        
    db.close()
    
    # Process videos
    for cam_id, cam_name, vpath in cameras:
        if not os.path.exists(vpath):
            print(f"Skipping {vpath}, not found.")
            continue
            
        print(f"--- Processing {cam_name} (ID: {cam_id}) ---")
        pipeline = CameraPipeline(camera_id=cam_id, rtsp_url=vpath)
        pipeline.PERSIST_INTERVAL = 0.0 # persist immediately
        
        cap = cv2.VideoCapture(vpath)
        frames_processed = 0
        # Process up to 50 frames to ensure detection
        while cap.isOpened() and frames_processed < 50:
            ret, frame = cap.read()
            if not ret: break
            
            # process every frame to get tracking info faster for short snippets
            pipeline.process_frame(frame)
            frames_processed += 1
            
        pipeline._persist_tracks()
        cap.release()

    # Check DB
    db = SessionLocal()
    tracks = db.query(ActiveTrack).all()
    print(f"\n--- Database Check ---")
    print(f"Total ActiveTracks in DB: {len(tracks)}")
    for t in tracks:
        print(f" Track: {t.id}, Cam: {t.camera_id}, Global ID: {t.global_id}, x: {t.last_x}, y: {t.last_y}")
        
    alerts = db.query(Alert).all()
    print(f"\nTotal Alerts in DB: {len(alerts)}")
    db.close()

if __name__ == "__main__":
    run()
