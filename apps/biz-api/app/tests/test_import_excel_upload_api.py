import os
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
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


def make_workbook_bytes() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "지원현황"
    sheet.append(["participant_name_raw", "biz_no_raw", "program_name_raw", "sub_program_name_raw", "support_amount_raw", "year"])
    sheet.append(["기업A", "123-45-67890", "수출지원", "초보기업", "1,000,000", 2026])
    sheet.append([None, None, None, None, None, None])

    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_excel_to_staging_upload_should_return_parsed_rows(db_session):
    response = client.post(
        "/api/v1/imports/excel-to-staging",
        headers=auth_headers(),
        files={
            "file": (
                "sample.xlsx",
                make_workbook_bytes(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["rows_count"] == 1
    assert body["rows"][0]["participant_name_raw"] == "기업A"
    assert body["rows"][0]["biz_no_raw"] == "123-45-67890"
    assert body["rows"][0]["program_name_raw"] == "수출지원"
    assert body["rows"][0]["year"] == 2026

    stored_rows = db_session.query(StagingSupportRaw).all()
    assert len(stored_rows) == 1
    assert stored_rows[0].source_file_name == "sample.xlsx"
    assert stored_rows[0].source_sheet_name == "지원현황"
    assert stored_rows[0].row_no == 2
    assert stored_rows[0].participant_name_raw == "기업A"
