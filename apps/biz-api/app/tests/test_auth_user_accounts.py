import os

import pytest
from fastapi.testclient import TestClient
from passlib.hash import sha256_crypt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.api.deps import get_db
from app.core.auth import create_access_token
from app.core.database import Base
from app.main import app
from app.models.entities import UserAccount


client = TestClient(app)


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    app.dependency_overrides[get_db] = lambda: session
    try:
        yield session
    finally:
        app.dependency_overrides.pop(get_db, None)
        session.close()


def issue_token(login_id: str, password: str) -> str:
    response = client.post("/api/v1/auth/login", json={"login_id": login_id, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_login_should_authenticate_active_db_user(db_session):
    db_session.add(
        UserAccount(
            login_id="operator",
            password_hash=sha256_crypt.hash("operator-pass"),
            role="OPERATOR",
            is_active=True,
        )
    )
    db_session.commit()

    response = client.post("/api/v1/auth/login", json={"login_id": "operator", "password": "operator-pass"})

    assert response.status_code == 200
    token = response.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json() == {"login_id": "operator", "role": "OPERATOR"}


def test_login_should_reject_inactive_db_user(db_session):
    db_session.add(
        UserAccount(
            login_id="disabled",
            password_hash=sha256_crypt.hash("disabled-pass"),
            role="OPERATOR",
            is_active=False,
        )
    )
    db_session.commit()

    response = client.post("/api/v1/auth/login", json={"login_id": "disabled", "password": "disabled-pass"})

    assert response.status_code == 401


def test_admin_should_create_and_list_user_accounts(db_session):
    token = issue_token("admin", "admin")

    create_response = client.post(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {token}"},
        json={"login_id": "operator", "password": "operator-pass", "role": "OPERATOR"},
    )
    list_response = client.get("/api/v1/auth/users", headers={"Authorization": f"Bearer {token}"})

    assert create_response.status_code == 200
    assert create_response.json() == {"login_id": "operator", "role": "OPERATOR", "is_active": True}
    assert list_response.status_code == 200
    assert list_response.json() == [{"login_id": "operator", "role": "OPERATOR", "is_active": True}]


def test_operator_should_not_create_user_accounts(db_session):
    db_session.add(
        UserAccount(
            login_id="operator",
            password_hash=sha256_crypt.hash("operator-pass"),
            role="OPERATOR",
            is_active=True,
        )
    )
    db_session.commit()
    token = issue_token("operator", "operator-pass")

    response = client.post(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {token}"},
        json={"login_id": "other", "password": "other-pass", "role": "OPERATOR"},
    )

    assert response.status_code == 403


def test_business_routes_should_reject_unknown_roles(db_session):
    token = create_access_token("guest", "GUEST")

    response = client.get("/api/v1/participants", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403
