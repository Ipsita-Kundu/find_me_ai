from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_returns_service_info():
    client = TestClient(app)

    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data
    assert "environment" in data
    assert "version" in data


def test_ready_endpoint_returns_expected_shape():
    client = TestClient(app)

    response = client.get("/ready")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] in {"ready", "not_ready"}
    assert data["database"] in {"ok", "unavailable"}
