import time
import os
import requests
from multiprocessing import Process
from pipeline.camera_pipeline import CameraPipeline

class PipelineManager:
    def __init__(self):
        self.processes = []
        self.cameras = []

    def setup_test_cameras(self):
        data_dir = "/app/data" # inside docker
        tests_dir = os.path.join(data_dir, "tests")
        
        video_files = [
            ("MS1", os.path.join(tests_dir, "MS1.mp4")),
            ("MS2", os.path.join(tests_dir, "MS2.mp4")),
            ("MS3", os.path.join(tests_dir, "MS3.mp4")),
            ("SS1", os.path.join(tests_dir, "SS1.mp4")),
            ("SS2", os.path.join(tests_dir, "SS2.mp4")),
            ("SS3", os.path.join(tests_dir, "SS3.mp4")),
            ("Test_Video", os.path.join(data_dir, "processing", "test_video.mp4"))
        ]
        
        backend_url = os.environ.get("BACKEND_URL", "http://backend:8000")
        
        # Wait for backend to be ready
        print("Waiting for backend API...")
        for _ in range(30):
            try:
                resp = requests.get(f"{backend_url}/health")
                if resp.status_code == 200:
                    break
            except:
                pass
            time.sleep(2)
        
        # Get existing cameras
        existing_urls = []
        try:
            resp = requests.get(f"{backend_url}/cameras/")
            if resp.status_code == 200:
                existing_urls = [c["rtsp_url"] for c in resp.json()]
        except Exception as e:
            print(f"Could not fetch cameras: {e}")
            
        # Register missing test videos
        for name, v_path in video_files:
            if not os.path.exists(v_path):
                print(f"Warning: {v_path} not found.")
                continue
                
            if v_path in existing_urls:
                continue
                
            cam_data = {
                "name": name,
                "rtsp_url": v_path,
                "location": "Test Setup",
                "floor": 1,
                "status": "ACTIVE"
            }
            try:
                requests.post(f"{backend_url}/cameras/", json=cam_data)
                print(f"Registered camera {name} -> {v_path}")
            except Exception as e:
                print(f"Failed to post camera {name}: {e}")
                
        # Fetch final list
        try:
            resp = requests.get(f"{backend_url}/cameras/")
            if resp.status_code == 200:
                self.cameras = resp.json()
        except Exception as e:
            print(f"Failed to fetch final cameras: {e}")

    def start_all(self):
        self.setup_test_cameras()
        print("=== Launching AI Multi-Camera Inference Pipelines ===")
        for cam in self.cameras:
            if cam.get("status") != "ACTIVE":
                continue
            pipeline = CameraPipeline(cam["id"], cam["rtsp_url"])
            p = Process(target=pipeline.run)
            p.start()
            self.processes.append(p)
            
        # Keep manager alive to monitor processes
        try:
            while True:
                time.sleep(10)
        except KeyboardInterrupt:
            print("Shutting down pipelines...")
            for p in self.processes:
                p.terminate()
                p.join()

if __name__ == "__main__":
    manager = PipelineManager()
    manager.start_all()
