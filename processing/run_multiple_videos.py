import os
import sys
import time
import argparse
import multiprocessing

# Add project root and backend/processing paths dynamically
base_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(base_dir)
sys.path.insert(0, os.path.join(project_dir, "backend"))
sys.path.insert(0, os.path.join(project_dir, "processing"))

# Force DATABASE_URL to backend db.sqlite3 for all processes
db_path = os.path.join(project_dir, "backend", "db.sqlite3")
os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

# Also configure it for children
multiprocessing.set_start_method('spawn', force=True)

def run_single_video(camera_id, video_path):
    """Worker process targeting a single camera feed and video file."""
    # Re-apply inside child process context
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    
    print(f"[Camera {camera_id}] Initializing pipeline for: {os.path.basename(video_path)}...")
    
    from pipeline.camera_pipeline import CameraPipeline
    import cv2
    
    pipeline = CameraPipeline(camera_id=camera_id, rtsp_url=video_path)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[Camera {camera_id}] Error: Could not open {video_path}")
        return

    frame_count = 0
    print(f"[Camera {camera_id}] Processing video loop started.")
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                # Loop video when it ends
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
                
            frame_count += 1
            # Skip frames to keep real-time processing pace on CPU
            if frame_count % 3 != 0:
                continue
                
            # Process single frame
            pipeline.process_frame(frame)
            
            # Pace frame ingestion to ~10fps
            time.sleep(0.033)
            
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"[Camera {camera_id}] Error in process loop: {e}")
    finally:
        cap.release()
        print(f"[Camera {camera_id}] Closed video stream.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parallel Surveillance Video Pipeline Runner")
    parser.add_argument("--videos", nargs="+", help="Explicit paths to video files to process")
    parser.add_argument("--cams", type=int, nargs="+", help="Explicit camera IDs mapping to the videos")
    args = parser.parse_args()
    
    tests_dir = os.path.join(project_dir, "tests")
    
    # Default video mapping (Ground Floor Cameras matching test files)
    video_map = [
        (1, os.path.join(tests_dir, "SS1.mp4")),   # Test video
        (2, os.path.join(tests_dir, "SS2.mp4")),   # john (Employee)
        (3, os.path.join(tests_dir, "SS3.mp4")),   # ponniyah (Employee)
        (4, os.path.join(tests_dir, "MS1.mp4")),   # Multi-subject test video
        (5, os.path.join(tests_dir, "MS2.mp4")),   # dinesh (Employee)
        (6, os.path.join(tests_dir, "MS3.mp4")),   # Multi-subject test video
    ]
    
    # If custom videos and cameras are provided via CLI
    if args.videos:
        video_map = []
        cam_ids = args.cams if args.cams else list(range(1, len(args.videos) + 1))
        for cam_id, v_path in zip(cam_ids, args.videos):
            # Check absolute or relative paths
            full_path = os.path.abspath(v_path)
            if not os.path.exists(full_path):
                # Try relative to tests folder
                full_path = os.path.join(tests_dir, v_path)
            video_map.append((cam_id, full_path))
            
    # Launch processes
    processes = []
    for cam_id, v_path in video_map:
        if os.path.exists(v_path):
            p = multiprocessing.Process(target=run_single_video, args=(cam_id, v_path))
            p.start()
            processes.append(p)
        else:
            print(f"Warning: Video file '{v_path}' not found. Skipping Camera {cam_id}.")
            
    if not processes:
        print("No valid test videos found to process. Exiting.")
        sys.exit(1)
        
    print(f"\nSuccessfully launched {len(processes)} camera pipeline workers in the background.")
    print("Press Ctrl+C to terminate all video streams.\n")
    
    try:
        for p in processes:
            p.join()
    except KeyboardInterrupt:
        print("\nStopping all camera processes...")
        for p in processes:
            p.terminate()
            p.join()
        print("All processes cleaned up successfully.")
