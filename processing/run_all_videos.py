import os
import sys
import time
import multiprocessing

# Add processing dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
# Add backend dir to path for app imports
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from pipeline.camera_pipeline import CameraPipeline
import cv2

def run_single_video(camera_id, video_path):
    print(f"[Camera {camera_id}] Starting pipeline for {video_path}")
    pipeline = CameraPipeline(camera_id=camera_id, rtsp_url=video_path)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[Camera {camera_id}] Error: Could not open {video_path}")
        return

    frame_count = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
                
            frame_count += 1
            pipeline.process_frame(frame)
            time.sleep(0.033)
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        print(f"[Camera {camera_id}] Stopped.")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(base_dir)
    tests_dir = os.path.join(project_dir, "tests")
    
    video_map = [
        (1, os.path.join(tests_dir, "SS1.mp4")),
        (2, os.path.join(tests_dir, "SS2.mp4")),
        (3, os.path.join(tests_dir, "SS3.mp4")),
        (13, os.path.join(tests_dir, "MS1.mp4")),
        (14, os.path.join(tests_dir, "MS2.mp4")),
        (15, os.path.join(tests_dir, "MS3.mp4")),
        (4, os.path.join(base_dir, "test_video.mp4")),
    ]
    
    processes = []
    for cam_id, v_path in video_map:
        if os.path.exists(v_path):
            p = multiprocessing.Process(target=run_single_video, args=(cam_id, v_path))
            p.start()
            processes.append(p)
        else:
            print(f"Warning: {v_path} not found.")

    print(f"Started {len(processes)} video pipelines in the background.")
    try:
        for p in processes:
            p.join()
    except KeyboardInterrupt:
        print("Terminating all processes...")
        for p in processes:
            p.terminate()
