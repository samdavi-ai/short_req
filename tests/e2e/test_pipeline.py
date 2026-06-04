import pytest

def test_full_pipeline_flow(api_client):
    """
    Simulates the full end-to-end flow:
    1. Registering a camera
    2. Defining a restricted zone
    3. Registering a whitelist visitor
    4. Simulating CV pipeline emitting an alert
    5. Acknowledging the alert
    """
    
    # 1. Register Camera
    cam_resp = api_client.post("/cameras/", json={
        "name": "E2E Test Camera",
        "rtsp_url": "rtsp://mock.local/stream",
        "floor": 1,
        "x_coord": 500,
        "y_coord": 500,
    })
    assert cam_resp.status_code == 201
    camera_id = cam_resp.json()["id"]

    # 2. Register Zone
    zone_resp = api_client.post("/zones/", json={
        "name": "E2E Restricted Zone",
        "floor": 1,
        "zone_type": "RESTRICTED",
        "dwell_alert_seconds": 0,
        "coordinates": [{"x": 100, "y": 100}, {"x": 200, "y": 100}, {"x": 200, "y": 200}]
    })
    assert zone_resp.status_code == 201
    zone_id = zone_resp.json()["id"]

    # 3. Register Visitor
    visitor_resp = api_client.post("/visitors/", json={
        "fullname": "E2E VIP",
        "passport_number": "E2E-12345",
        "nationality": "US",
        "status": "WHITELISTED"
    })
    assert visitor_resp.status_code == 201

    # 4. Simulate Pipeline Triggering Alert
    # In a real run, `processing/workers/dwell_monitor.py` detects an intersection and calls the backend API
    alert_resp = api_client.post("/alerts/", json={
        "alert_type": "RESTRICTED_ZONE",
        "description": "Intrusion detected in E2E Restricted Zone by track 99",
        "severity": "CRITICAL",
        "camera_id": camera_id
    })
    assert alert_resp.status_code == 201
    alert_id = alert_resp.json()["id"]

    # 5. Verify Unacknowledged
    unack_count = api_client.get("/alerts/unacknowledged/count").json()["count"]
    assert unack_count == 1

    # 6. Dashboard Operator Acknowledges Alert
    ack_resp = api_client.post(f"/alerts/{alert_id}/acknowledge", json={
        "acknowledged_by": "operator_e2e"
    })
    assert ack_resp.status_code == 200
    assert ack_resp.json()["acknowledged"] is True

    # 7. Verify Unacknowledged is 0
    assert api_client.get("/alerts/unacknowledged/count").json()["count"] == 0

    # 8. Check Analytics Stats
    stats_resp = api_client.get("/analytics/stats").json()
    assert stats_resp["total_cameras"] == 1
    assert stats_resp["total_visitors"] == 1
    assert stats_resp["unacknowledged_alerts"] == 0
