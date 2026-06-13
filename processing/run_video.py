import os
import sys

# Add processing dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
# Add backend dir to path for app imports
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from pipeline.camera_pipeline import CameraPipeline
import cv2
import time

def run():
    video_path = os.path.join(os.path.dirname(__file__), "test_video.mp4")
    
    if not os.path.exists(video_path):
        print(f"Error: Video file not found at {video_path}")
        print("Please run scripts/download_test_video.py first.")
        return

    print("Initializing Computer Vision Pipeline...")
    pipeline = CameraPipeline(camera_id=1, rtsp_url=video_path)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error: Could not open video file.")
        return

    print("Starting video processing loop... (Press Ctrl+C to stop)")
    frame_count = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("End of video stream. Looping back...")
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
                
            frame_count += 1
            # Skip frames to reduce CPU load — process every 3rd frame
            if frame_count % 3 != 0:
                continue

            if frame_count % 90 == 0:
                print(f"Processing frame {frame_count}...")
            
            # Send to pipeline (this detects, tracks, and publishes to Redis)
            pipeline.process_frame(frame)
            
            # Pace to ~10fps effective processing
            time.sleep(0.03)
            
    except KeyboardInterrupt:
        print("\nStopping processing...")
    finally:
        cap.release()

if __name__ == "__main__":
    run()
    