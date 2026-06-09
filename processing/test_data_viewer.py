import os
import sys
import json
import time
import cv2
import redis

# Add backend and processing to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../backend"))

# Monkey-patch redis.Redis
class MockRedis:
    def publish(self, channel, message):
        if channel == "ws_events":
            data = json.loads(message)
            if data.get("type") == "TRACK_UPDATE":
                print(f"----- TRACK UPDATE (Global ID: {data['global_id']}) -----")
                print(f"  Local Track ID: {data['track_id']}")
                print(f"  BBox:           {data['bbox']}")
                print(f"  Has Face:       {data['has_face']}")
                print(f"  Identity Type:  {data['identity_type']}")
                print(f"  Matched via:    {data['matched_via']}")
                print(f"  Entry/Exit:     {data['entry_exit']}")
                print(f"  Coordinates:    (X: {data['x']}, Y: {data['y']})")
                print("-" * 50)
    
    def hset(self, *args, **kwargs): pass
    def hgetall(self, *args, **kwargs): return {}
    def delete(self, *args, **kwargs): pass
    def keys(self, *args, **kwargs): return []

def mock_from_url(*args, **kwargs):
    return MockRedis()

redis.from_url = mock_from_url

# Monkey-patch SessionLocal to use SQLite memory
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import app.core.database
from app.models.models import Base

engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)
SessionLocalMock = sessionmaker(bind=engine)
app.core.database.SessionLocal = SessionLocalMock

from pipeline.camera_pipeline import CameraPipeline

def run_test():
    print("Initializing Pipeline with Mocked Dependencies...")
    video_path = "test_video.mp4"
    if not os.path.exists(video_path):
        print("test_video.mp4 not found.")
        return
        
    pipeline = CameraPipeline(camera_id=1, rtsp_url=video_path)
    
    cap = cv2.VideoCapture(video_path)
    print("Reading frames from video...")
    
    # Fast forward a bit into the video where there might be people
    cap.set(cv2.CAP_PROP_POS_FRAMES, 30)
    
    for i in range(30):
        ret, frame = cap.read()
        if not ret: break
        
        # Process every 5th frame to simulate real behavior
        if i % 5 == 0:
            print(f"\nProcessing video frame {30 + i}...")
            pipeline.process_frame(frame)
            time.sleep(0.1)
            
    cap.release()
    print("Test completed.")

if __name__ == "__main__":
    run_test()
