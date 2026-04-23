import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.api.deps import get_db
from app.core.database import Base
from app.main import app
from app.models.entities import StagingSupportRaw


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


def auth_headers() -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "admin"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_staging_to_core_should_process_rows_by_source_file_name(db_session):
    db_session.add(
        StagingSupportRaw(
            source_file_name="sample.xlsx",
            source_sheet_name="Sheet1",
            row_no=2,
            participant_name_raw="Company A",
            biz_no_raw="123-45-67890",
            program_name_raw="Export Support",
            sub_program_name_raw="Starter",
            support_amount_raw="1000000",
            raw_payload_json={
                "participant_name_raw": "Company A",
                "biz_no_raw": "123-45-67890",
                "program_name_raw": "Export Support",
                "sub_program_name_raw": "Starter",
                "support_amount_raw": "1000000",
                "year": 2026,
            },
        )
    )
    db_session.commit()

    response = client.post(
        "/api/v1/imports/staging-to-core",
        headers=auth_headers(),
        json={"source_file_name": "sample.xlsx"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["summary"]["participants_count"] == 1
    assert body["summary"]["programs_count"] == 1
    assert body["summary"]["support_cases_count"] == 1
    assert body["summary"]["errors_count"] == 0
