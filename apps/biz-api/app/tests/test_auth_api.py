import os

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.main import app


client = TestClient(app)


def login_token() -> str:
    response = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "admin"})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_login_should_reject_invalid_credentials():
    response = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "wrong"})

    assert response.status_code == 401


def test_login_should_issue_jwt_for_valid_credentials():
    response = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "admin"})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["access_token"] != "dev-token"


def test_me_should_require_bearer_token():
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_should_return_current_user_for_valid_token():
    token = login_token()

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {"login_id": "admin", "role": "ADMIN"}


def test_business_routes_should_require_bearer_token():
    response = client.get("/api/v1/participants")

    assert response.status_code == 401
