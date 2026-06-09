from fastapi.testclient import TestClient

from app.main import app


def test_simulation_publish_requires_auth():
    client = TestClient(app)
    response = client.post(
        "/simulation/publish",
        json={
            "floor": 1,
            "building_id": 1,
            "site_id": 1,
            "events": [{"type": "TRACK_UPDATE", "x": 10, "y": 20}],
        },
    )
    assert response.status_code in (401, 403)
