"""
Backend unit tests — all fixtures provided by conftest.py
"""

import pytest

# 'api_client' and 'clean_db' are injected from conftest.py


# ─── Health ───────────────────────────────────────────────────────────────────

def test_root_health(api_client):
    resp = api_client.get("/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ONLINE"


def test_health_endpoint(api_client):
    resp = api_client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


# ─── Cameras ──────────────────────────────────────────────────────────────────

def test_list_cameras_empty(api_client):
    resp = api_client.get("/cameras/")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_camera(api_client):
    resp = api_client.post("/cameras/", json={
        "name": "Gate 1 Camera",
        "rtsp_url": "rtsp://192.168.1.10:554/stream",
        "location": "Main Entrance",
        "floor": 1,
        "x_coord": 100.0,
        "y_coord": 200.0,
        "is_overhead": True,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Gate 1 Camera"
    assert data["status"] == "ACTIVE"


def test_create_duplicate_rtsp_fails(api_client):
    payload = {"name": "A", "rtsp_url": "rtsp://10.0.0.99:554/dup", "floor": 1}
    api_client.post("/cameras/", json=payload)
    resp = api_client.post("/cameras/", json=payload)
    assert resp.status_code == 409


def test_get_camera_not_found(api_client):
    resp = api_client.get("/cameras/9999")
    assert resp.status_code == 404


def test_update_camera(api_client):
    cam_id = api_client.post("/cameras/", json={
        "name": "Old Name", "rtsp_url": "rtsp://10.0.0.1:554/s", "floor": 1,
    }).json()["id"]
    resp = api_client.patch(f"/cameras/{cam_id}", json={"name": "New Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


def test_delete_camera(api_client):
    cam_id = api_client.post("/cameras/", json={
        "name": "Temp", "rtsp_url": "rtsp://10.0.0.2:554/s", "floor": 2,
    }).json()["id"]
    assert api_client.delete(f"/cameras/{cam_id}").status_code == 204
    assert api_client.get(f"/cameras/{cam_id}").status_code == 404


def test_bulk_camera_positions(api_client):
    id1 = api_client.post("/cameras/", json={
        "name": "Cam A", "rtsp_url": "rtsp://10.0.1.1:554/a", "floor": 1,
    }).json()["id"]
    id2 = api_client.post("/cameras/", json={
        "name": "Cam B", "rtsp_url": "rtsp://10.0.1.2:554/b", "floor": 1,
    }).json()["id"]

    resp = api_client.post("/cameras/positions/bulk", json={"positions": [
        {"camera_id": id1, "x_coord": 300, "y_coord": 400, "angle": 45, "floor": 1},
        {"camera_id": id2, "x_coord": 600, "y_coord": 700, "angle": 90, "floor": 1},
    ]})
    assert resp.status_code == 200
    updated = {c["id"]: c for c in resp.json()}
    assert updated[id1]["x_coord"] == 300.0
    assert updated[id2]["angle"] == 90.0


# ─── Zones ────────────────────────────────────────────────────────────────────

def test_create_zone(api_client):
    resp = api_client.post("/zones/", json={
        "name": "Restricted Area", "floor": 1,
        "coordinates": [{"x": 10, "y": 10}, {"x": 200, "y": 10}, {"x": 200, "y": 200}],
        "zone_type": "RESTRICTED",
        "dwell_alert_seconds": 60,
    })
    assert resp.status_code == 201
    assert resp.json()["zone_type"] == "RESTRICTED"


def test_zone_requires_3_points(api_client):
    resp = api_client.post("/zones/", json={
        "name": "Bad", "floor": 1,
        "coordinates": [{"x": 0, "y": 0}, {"x": 10, "y": 10}],
        "zone_type": "DWELL",
    })
    assert resp.status_code == 422


# ─── Visitors ─────────────────────────────────────────────────────────────────

def test_create_visitor(api_client):
    resp = api_client.post("/visitors/", json={
        "fullname": "John Doe",
        "passport_number": "A1234567",
        "nationality": "British",
        "status": "WHITELISTED",
    })
    assert resp.status_code == 201
    assert resp.json()["fullname"] == "John Doe"


def test_visitor_status_change(api_client):
    vid = api_client.post("/visitors/", json={
        "fullname": "Jane Smith", "passport_number": "B9876543", "status": "PENDING",
    }).json()["id"]
    resp = api_client.patch(f"/visitors/{vid}/status?status=BLACKLISTED")
    assert resp.status_code == 200
    assert resp.json()["status"] == "BLACKLISTED"


def test_watchlist_endpoint(api_client):
    api_client.post("/visitors/", json={"fullname": "Safe Person", "status": "WHITELISTED"})
    api_client.post("/visitors/", json={"fullname": "Suspect", "status": "BLACKLISTED"})
    names = [v["fullname"] for v in api_client.get("/visitors/watchlist").json()]
    assert "Suspect" in names
    assert "Safe Person" not in names


# ─── Employees ────────────────────────────────────────────────────────────────

def test_create_employee(api_client):
    resp = api_client.post("/employees/", json={
        "employee_code": "E-001",
        "fullname": "Ravi Kumar",
        "department": "Security",
        "break_interval_minutes": 120,
        "break_duration_minutes": 15,
    })
    assert resp.status_code == 201
    assert resp.json()["employee_code"] == "E-001"


def test_duplicate_employee_code_fails(api_client):
    payload = {"employee_code": "E-DUP", "fullname": "First", "department": "IT"}
    api_client.post("/employees/", json=payload)
    resp = api_client.post("/employees/", json=payload)
    assert resp.status_code == 409


# ─── Alerts ───────────────────────────────────────────────────────────────────

def test_create_and_acknowledge_alert(api_client):
    alert_id = api_client.post("/alerts/", json={
        "alert_type": "RESTRICTED_ZONE",
        "description": "Person in restricted area",
        "severity": "CRITICAL",
    }).json()["id"]

    assert api_client.get("/alerts/unacknowledged/count").json()["count"] == 1

    ack = api_client.post(f"/alerts/{alert_id}/acknowledge", json={"acknowledged_by": "operator_1"})
    assert ack.status_code == 200
    assert ack.json()["acknowledged"] is True
    assert ack.json()["acknowledged_by"] == "operator_1"

    assert api_client.get("/alerts/unacknowledged/count").json()["count"] == 0


def test_double_acknowledge_fails(api_client):
    alert_id = api_client.post("/alerts/", json={
        "alert_type": "WATCHLIST_MATCH", "severity": "HIGH",
    }).json()["id"]
    api_client.post(f"/alerts/{alert_id}/acknowledge", json={"acknowledged_by": "op1"})
    resp = api_client.post(f"/alerts/{alert_id}/acknowledge", json={"acknowledged_by": "op2"})
    assert resp.status_code == 409


# ─── Analytics ────────────────────────────────────────────────────────────────

def test_analytics_stats(api_client):
    resp = api_client.get("/analytics/stats")
    assert resp.status_code == 200
    data = resp.json()
    for key in ["total_cameras", "active_tracks", "unacknowledged_alerts", "total_visitors"]:
        assert key in data


def test_analytics_dashboard(api_client):
    resp = api_client.get("/analytics/")
    assert resp.status_code == 200
    data = resp.json()
    assert "stats" in data
    assert "hourly_traffic" in data
    assert len(data["hourly_traffic"]) == 12


# ─── Security, RBAC & Compliance Exports ─────────────────────────────────────

from app.core.security import create_access_token, hash_password
from app.models.models import User, ActiveTrack, Employee, AuditLog
from tests.conftest import TestingSessionLocal
from datetime import datetime

def test_audit_export_flow(api_client, clean_db):
    db = TestingSessionLocal()
    try:
        # Create users
        admin = User(
            username="admin_test",
            email="admin@test.com",
            full_name="Admin User",
            hashed_password=hash_password("admin_pass"),
            role="admin",
            is_active=True
        )
        operator = User(
            username="operator_test",
            email="op@test.com",
            full_name="Operator User",
            hashed_password=hash_password("op_pass"),
            role="security_operator",
            is_active=True
        )
        db.add(admin)
        db.add(operator)
        db.commit()

        # Tokens
        admin_token = create_access_token("admin_test", extra_claims={"role": "admin"})
        operator_token = create_access_token("operator_test", extra_claims={"role": "security_operator"})

        # 1. Unauthenticated gets 401
        assert api_client.get("/audit/export?month=2026-06").status_code == 401

        # 2. Operator gets 403
        resp_op = api_client.get("/audit/export?month=2026-06", headers={"Authorization": f"Bearer {operator_token}"})
        assert resp_op.status_code == 403

        # Verify UNAUTHORIZED_ACCESS log was written for operator
        auth_log = db.query(AuditLog).filter(AuditLog.action == "UNAUTHORIZED_ACCESS").first()
        assert auth_log is not None
        assert auth_log.details["username"] == "operator_test"
        assert auth_log.details["user_role"] == "security_operator"
        assert "ip_address" in auth_log.details

        # 3. Admin gets 200 and CSV content
        resp_admin = api_client.get("/audit/export?month=2026-06", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp_admin.status_code == 200
        assert "text/csv" in resp_admin.headers["content-type"]
        csv_content = resp_admin.text
        lines = csv_content.strip().split("\n")
        assert len(lines) >= 1
        assert lines[0].strip() == "timestamp,user,event_type,detail,ip_address"

        # Verify AUDIT_EXPORT log was written for admin
        export_log = db.query(AuditLog).filter(AuditLog.action == "AUDIT_EXPORT").first()
        assert export_log is not None
        assert export_log.user_id == admin.id
    finally:
        db.close()


def test_employee_export_flow(api_client, clean_db):
    db = TestingSessionLocal()
    try:
        # Create admin and employee
        admin = User(
            username="admin_test",
            email="admin@test.com",
            full_name="Admin User",
            hashed_password=hash_password("admin_pass"),
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()

        emp = Employee(
            employee_code="E-999",
            fullname="Test Employee",
            department="Operations"
        )
        db.add(emp)
        db.commit()

        # Add tracks for June 2026
        t1 = ActiveTrack(
            id="track_1",
            global_id="global_1",
            matched_employee_id=emp.id,
            first_seen=datetime(2026, 6, 15, 8, 0, 0),
            last_seen=datetime(2026, 6, 15, 10, 30, 0), # 2.5 hours
            is_active=False
        )
        t2 = ActiveTrack(
            id="track_2",
            global_id="global_1",
            matched_employee_id=emp.id,
            first_seen=datetime(2026, 6, 16, 9, 0, 0),
            last_seen=datetime(2026, 6, 16, 10, 15, 0), # 1.25 hours
            is_active=False
        )
        db.add(t1)
        db.add(t2)
        db.commit()

        admin_token = create_access_token("admin_test", extra_claims={"role": "admin"})

        # Export using /employees/export (as per employees route)
        resp = api_client.get("/employees/export?month=2026-06", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        
        csv_content = resp.text.strip().split("\n")
        assert len(csv_content) == 2
        assert csv_content[0].strip() == "employee_id,name,first_seen,last_seen,total_hours"
        
        row = csv_content[1].strip().split(",")
        assert row[0] == "E-999"
        assert row[1] == "Test Employee"
        assert "2026-06-15T08:00:00" in row[2]
        assert "2026-06-16T10:15:00" in row[3]
        assert float(row[4]) == 3.75 # 2.5 + 1.25 hours
    finally:
        db.close()


def test_failed_login_no_enumeration(api_client, clean_db):
    db = TestingSessionLocal()
    try:
        user = User(
            username="real_user",
            email="real@test.com",
            full_name="Real User",
            hashed_password=hash_password("password123"),
            role="operator",
            is_active=True
        )
        db.add(user)
        db.commit()

        # 1. Non-existent username -> 401 with generic message
        resp1 = api_client.post("/auth/login", data={"username": "fake_user", "password": "wrongpassword"})
        assert resp1.status_code == 401
        assert resp1.json()["detail"] == "Incorrect username or password"

        # 2. Existing username, wrong password -> 401 with generic message
        resp2 = api_client.post("/auth/login", data={"username": "real_user", "password": "wrongpassword"})
        assert resp2.status_code == 401
        assert resp2.json()["detail"] == "Incorrect username or password"

        # Verify failed login attempts are written to audit log
        logs = db.query(AuditLog).filter(AuditLog.action == "FAILED_LOGIN").all()
        assert len(logs) == 2
        assert any(l.details.get("username") == "fake_user" for l in logs)
        assert any(l.details.get("username") == "real_user" for l in logs)
        assert all("ip_address" in l.details for l in logs)
    finally:
        db.close()
