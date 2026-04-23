import os

import pytest
from fastapi.testclient import TestClient


RUN_DB_MODE_E2E = (
    os.environ.get("SUPPORT_CASE_REPOSITORY_MODE") == "db"
    and os.environ.get("DATABASE_URL", "").startswith("postgresql")
)

if not RUN_DB_MODE_E2E:
    pytest.skip("DB-mode API E2E requires PostgreSQL db mode", allow_module_level=True)

from app.main import app


client = TestClient(app)


def test_db_mode_api_e2e_support_case_flow():
    token_response = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "admin"})
    assert token_response.status_code == 200
    headers = {"Authorization": f"Bearer {token_response.json()['access_token']}"}

    unauthenticated = client.get("/api/v1/participants")
    assert unauthenticated.status_code == 401

    participant = client.post(
        "/api/v1/participants",
        headers=headers,
        json={"participant_type": "COMPANY", "participant_name": "CI DB Company", "biz_no": "1002003000"},
    )
    assert participant.status_code == 200
    participant_id = participant.json()["id"]

    program = client.post(
        "/api/v1/programs",
        headers=headers,
        json={"year": 2026, "program_name": "CI DB Program", "sub_program_name": "Smoke"},
    )
    assert program.status_code == 200
    program_id = program.json()["id"]

    support_case = client.post(
        "/api/v1/support-cases",
        headers=headers,
        json={"participant_id": participant_id, "program_id": program_id, "remarks": "ci db mode"},
    )
    assert support_case.status_code == 200
    case_id = support_case.json()["support_case"]["id"]

    update = client.put(
        f"/api/v1/support-cases/{case_id}",
        headers=headers,
        json={"agreement_status": "COMPLETED", "execution_status": "PAID", "changed_by": "ci"},
    )
    assert update.status_code == 200
    assert update.json()["support_case"]["agreement_status"] == "COMPLETED"
    assert update.json()["support_case"]["execution_status"] == "PAID"

    histories = client.get(f"/api/v1/support-cases/{case_id}/histories", headers=headers)
    assert histories.status_code == 200
    assert len(histories.json()["items"]) == 2

    listed = client.get("/api/v1/support-cases", headers=headers)
    assert listed.status_code == 200
    assert any(item["id"] == case_id for item in listed.json()["items"])
