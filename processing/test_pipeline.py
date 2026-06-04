import cv2
import numpy as np

# Mock redis for IntrusionEngine so it doesn't fail on connection
import redis
class MockRedis:
    def publish(self, *args, **kwargs): pass
    def get(self, *args, **kwargs): return None
redis.from_url = lambda *args, **kwargs: MockRedis()

from pipeline.camera_pipeline import CameraPipeline

def main():
    print("Testing Pipeline Initialization...")
    
    # Passing 0 as camera URL which means webcam/dummy
    pipeline = CameraPipeline(camera_id=1, rtsp_url="0")
    print("Pipeline workers initialized successfully!")

    # Test single frame dummy detection & tracking
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    print("Running detect_and_track...")
    tracks = pipeline.detector.detect_and_track(dummy_frame)
    print("Tracks:", tracks)
    
    print("Running state update...")
    state = pipeline.tracker.update(tracks)
    print("State:", state)
    
    print("Running ReID embedding extraction...")
    crop = np.zeros((128, 64, 3), dtype=np.uint8)
    embedding = pipeline.body_reid.extract_embedding(crop)
    print("Embedding generated, length:", len(embedding))
    
    print("All checks passed.")

if __name__ == "__main__":
    main()
