from locust import HttpUser, task, between
import random

class DashboardUser(HttpUser):
    # Simulate users polling the dashboard aggressively (every 1-3 seconds)
    wait_time = between(1, 3)

    @task(3)
    def fetch_cameras(self):
        """Simulate the frontend fetching the camera list."""
        self.client.get("/cameras/")

    @task(5)
    def fetch_unacknowledged_alerts(self):
        """Simulate the dashboard polling for new critical alerts."""
        self.client.get("/alerts/unacknowledged/count")

    @task(2)
    def fetch_analytics(self):
        """Simulate loading the analytics dashboard stats."""
        self.client.get("/analytics/stats")

    @task(1)
    def fetch_visitors(self):
        """Simulate checking the watchlist."""
        self.client.get("/visitors/watchlist")

class CVNodeSimulator(HttpUser):
    # Simulate CV processing nodes submitting tracks very rapidly
    wait_time = between(0.1, 0.5)

    def on_start(self):
        """Register a mock camera when the CV node starts."""
        resp = self.client.post("/cameras/", json={
            "name": f"LoadTest Cam {random.randint(1000,9999)}",
            "rtsp_url": f"rtsp://10.0.0.{random.randint(1,254)}/stream",
            "floor": 1
        })
        if resp.status_code == 201:
            self.camera_id = resp.json()["id"]
        else:
            self.camera_id = 1

    @task
    def submit_mock_alert(self):
        """Simulate the processing node detecting an anomaly and firing a REST alert."""
        # We fire this less frequently so we don't just spam the DB infinitely in tests
        if random.random() < 0.05:
            self.client.post("/alerts/", json={
                "alert_type": random.choice(["RESTRICTED_ZONE", "DWELL_TIME_EXCEEDED", "WATCHLIST_MATCH"]),
                "description": "Load test simulated alert",
                "severity": random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
                "camera_id": getattr(self, 'camera_id', 1)
            })
