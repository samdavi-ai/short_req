"""
PipelineManager — Multi-camera pipeline orchestrator with health monitoring.

Spawns one CameraPipeline per active camera as a subprocess, monitors
process health, auto-restarts crashed pipelines, and publishes
CAMERA_OFFLINE alerts when a pipeline fails.
"""

import time
import os
import json
import logging
import requests
import redis
from multiprocessing import Process
from pipeline.camera_pipeline import CameraPipeline

logger = logging.getLogger(__name__)


class PipelineManager:
    HEALTH_CHECK_INTERVAL = 10   # seconds between health checks
    MAX_RESTARTS = 5             # max restarts per camera before giving up

    def __init__(self):
        # camera_id → {"process": Process, "camera": dict, "restart_count": int}
        self.pipelines = {}
        self.cameras = []
        self.redis_client = None

    def _init_redis(self):
        """Initialize Redis client for publishing alerts."""
        try:
            redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("PipelineManager connected to Redis ✓")
        except Exception as e:
            logger.warning("PipelineManager could not connect to Redis: %s", e)
            self.redis_client = None

    def setup_test_cameras(self):
        data_dir = "/app/data"  # inside docker
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
        logger.info("Waiting for backend API...")
        for _ in range(30):
            try:
                resp = requests.get(f"{backend_url}/health")
                if resp.status_code == 200:
                    break
            except Exception:
                pass
            time.sleep(2)

        # Get existing cameras
        existing_urls = []
        try:
            resp = requests.get(f"{backend_url}/cameras/")
            if resp.status_code == 200:
                existing_urls = [c["rtsp_url"] for c in resp.json()]
        except Exception as e:
            logger.warning("Could not fetch cameras: %s", e)

        # Register missing test videos
        for name, v_path in video_files:
            if not os.path.exists(v_path):
                logger.warning("%s not found.", v_path)
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
                logger.info("Registered camera %s -> %s", name, v_path)
            except Exception as e:
                logger.warning("Failed to post camera %s: %s", name, e)

        # Fetch final list
        try:
            resp = requests.get(f"{backend_url}/cameras/")
            if resp.status_code == 200:
                self.cameras = resp.json()
        except Exception as e:
            logger.warning("Failed to fetch final cameras: %s", e)

    def _start_pipeline(self, camera: dict) -> Process:
        """Spawn a single camera pipeline as a subprocess."""
        cam_id = camera["id"]
        rtsp_url = camera["rtsp_url"]
        pipeline = CameraPipeline(cam_id, rtsp_url)
        p = Process(target=pipeline.run, name=f"CameraPipeline-{cam_id}", daemon=True)
        p.start()
        logger.info("Started pipeline for camera %d (%s) [PID: %d]",
                     cam_id, camera.get("name", "?"), p.pid)
        return p

    def _publish_camera_offline_alert(self, camera: dict, reason: str):
        """Publish a CAMERA_OFFLINE alert via Redis."""
        if not self.redis_client:
            return
        event = {
            "type": "ALERT_NEW",
            "camera_id": camera["id"],
            "data": {
                "alert_type": "CAMERA_OFFLINE",
                "severity": "HIGH",
                "description": (
                    f"🔴 Camera '{camera.get('name', camera['id'])}' pipeline crashed: {reason}"
                ),
                "timestamp": str(time.time()),
                "acknowledged": False,
            }
        }
        try:
            self.redis_client.publish("ws_events", json.dumps(event, default=str))
        except Exception as e:
            logger.error("Failed to publish CAMERA_OFFLINE alert: %s", e)

    def start_all(self):
        """Launch all active camera pipelines and monitor their health."""
        self._init_redis()
        self.setup_test_cameras()
        logger.info("=== Launching AI Multi-Camera Inference Pipelines ===")

        for cam in self.cameras:
            if cam.get("status") != "ACTIVE":
                continue
            cam_id = cam["id"]
            p = self._start_pipeline(cam)
            self.pipelines[cam_id] = {
                "process": p,
                "camera": cam,
                "restart_count": 0,
            }

        logger.info("All %d pipelines launched. Starting health monitor...",
                     len(self.pipelines))

        # Health monitoring loop with auto-restart
        try:
            while True:
                time.sleep(self.HEALTH_CHECK_INTERVAL)
                self._health_check()
        except KeyboardInterrupt:
            logger.info("Shutting down all pipelines...")
            self._shutdown_all()

    def _health_check(self):
        """Check all pipeline processes and restart any that have died."""
        for cam_id, info in list(self.pipelines.items()):
            p = info["process"]
            cam = info["camera"]

            if p.is_alive():
                continue

            exit_code = p.exitcode
            restart_count = info["restart_count"]

            logger.error(
                "Pipeline for camera %d (%s) DIED [exit_code=%s, restarts=%d/%d]",
                cam_id, cam.get("name", "?"), exit_code, restart_count, self.MAX_RESTARTS
            )

            if restart_count >= self.MAX_RESTARTS:
                logger.critical(
                    "Camera %d exceeded max restarts (%d). Marking as OFFLINE.",
                    cam_id, self.MAX_RESTARTS
                )
                self._publish_camera_offline_alert(
                    cam, f"Exceeded max restarts ({self.MAX_RESTARTS})"
                )
                # Remove from monitoring to stop retry loops
                del self.pipelines[cam_id]
                continue

            # Auto-restart
            logger.info("Auto-restarting pipeline for camera %d (attempt %d/%d)...",
                        cam_id, restart_count + 1, self.MAX_RESTARTS)
            self._publish_camera_offline_alert(
                cam, f"Crashed (exit code {exit_code}), auto-restarting..."
            )

            new_p = self._start_pipeline(cam)
            self.pipelines[cam_id] = {
                "process": new_p,
                "camera": cam,
                "restart_count": restart_count + 1,
            }

    def _shutdown_all(self):
        """Gracefully terminate all pipeline processes."""
        for cam_id, info in self.pipelines.items():
            p = info["process"]
            if p.is_alive():
                logger.info("Terminating pipeline for camera %d...", cam_id)
                p.terminate()
                p.join(timeout=5)
                if p.is_alive():
                    logger.warning("Force-killing camera %d pipeline.", cam_id)
                    p.kill()
        logger.info("All pipelines shut down.")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    manager = PipelineManager()
    manager.start_all()
