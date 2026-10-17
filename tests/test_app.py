
from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def test_home_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["project"] == "Auto_analysis"
    assert response.json()["status"] == "running"


def test_health_endpoint():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_datasets_endpoint():
    response = client.get("/api/datasets")

    assert response.status_code == 200
    assert response.json()["datasets"] == []
    assert response.json()["total"] == 0
