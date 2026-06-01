import time
import os
from multiprocessing import Process
from pipeline.camera_pipeline import CameraPipeline

class PipelineManager:
    def __init__(self):
        self.processes = []
        # Query list of cameras from DB or config
        self.cameras = [
            {"id": 1, "rtsp_url": "0", "name": "Entrance Gate 1"},
            {"id": 2, "rtsp_url": "1", "name": "Rest Lounges"}
        ]

    def start_all(self):
        print("=== Launching AI Multi-Camera Inference Pipelines ===")
        for cam in self.cameras:
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
