import os
import sys
import argparse
import time
import cv2

# Add processing dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
# Add backend dir to path for app imports
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from pipeline.camera_pipeline import CameraPipeline

def run(camera_id, rtsp_url):
    print(f"Initializing Computer Vision Pipeline for Camera {camera_id} at {rtsp_url}...")
    pipeline = CameraPipeline(camera_id=camera_id, rtsp_url=rtsp_url)
    
    # Check if the rtsp_url is meant to be a local device (e.g., '0' for webcam)
    input_source = int(rtsp_url) if rtsp_url.isdigit() else rtsp_url
    
    cap = cv2.VideoCapture(input_source)
    if not cap.isOpened():
        print(f"Error: Could not open video source: {input_source}")
        return

    print("Starting video processing loop... (Press Ctrl+C to stop)")
    frame_count = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                # If it's a local video file, loop it. For real RTSP streams, wait and retry.
                if isinstance(input_source, str) and os.path.exists(input_source):
                    print("End of video stream. Looping back...")
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    print("Stream interrupted. Retrying in 2 seconds...")
                    time.sleep(2)
                    # Reconnect
                    cap.release()
                    cap = cv2.VideoCapture(input_source)
                    continue
                
            frame_count += 1
            # Skip frames to reduce CPU load — process every 3rd frame
            if frame_count % 3 != 0:
                continue

            if frame_count % 90 == 0:
                print(f"[Camera {camera_id}] Processing frame {frame_count}...")
            
            # Send to pipeline (this detects, tracks, and publishes to Redis)
            pipeline.process_frame(frame)
            
            # Pace to ~10fps effective processing
            time.sleep(0.03)
            
    except KeyboardInterrupt:
        print(f"\n[Camera {camera_id}] Stopping processing...")
    finally:
        cap.release()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run camera pipeline on an RTSP stream.")
    parser.add_argument("--camera_id", type=int, required=True, help="Camera ID from database")
    parser.add_argument("--rtsp_url", type=str, required=True, help="RTSP URL or video path")
    args = parser.parse_args()
    
    run(args.camera_id, args.rtsp_url)
