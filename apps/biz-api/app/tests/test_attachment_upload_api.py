import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.api.deps import get_db
from app.api.v1.attachments import get_drive_uploader
from app.core.database import Base
from app.main import app
from app.models.entities import Attachment, Participant, ParticipantType, Program, SupportCase
from app.services.drive_service import DriveUploadResult


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
        app.dependency_overrides.pop(get_drive_uploader, None)
        session.close()


@pytest.fixture()
def support_case_id(db_session):
    participant_id = uuid.uuid4()
    program_id = uuid.uuid4()
    case_id = uuid.uuid4()
    db_session.add(Participant(id=participant_id, participant_type=ParticipantType.COMPANY, participant_name="Attach Co"))
    db_session.add(Program(id=program_id, year=2026, program_name="Attach Program"))
    db_session.add(SupportCase(id=case_id, participant_id=participant_id, program_id=program_id))
    db_session.commit()
    return str(case_id)


def auth_headers() -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "admin"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_attachment_upload_should_persist_metadata_when_drive_upload_succeeds(db_session, support_case_id):
    def fake_uploader(*, support_case_id: str, file_type: str, file_name: str, content: bytes) -> DriveUploadResult:
        return DriveUploadResult(
            drive_file_id="drive-file-1",
            drive_web_link="https://drive.example/file/1",
            folder_path=f"case/{support_case_id}",
        )

    app.dependency_overrides[get_drive_uploader] = lambda: fake_uploader

    response = client.post(
        "/api/v1/attachments/upload",
        headers=auth_headers(),
        data={"support_case_id": support_case_id, "file_type": "AGREEMENT"},
        files={"file": ("agreement.pdf", b"pdf-bytes", "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["attachment"]["drive_file_id"] == "drive-file-1"
    assert body["attachment"]["original_file_name"] == "agreement.pdf"

    rows = db_session.query(Attachment).all()
    assert len(rows) == 1
    assert str(rows[0].support_case_id) == support_case_id
    assert rows[0].file_type == "AGREEMENT"
    assert rows[0].drive_file_id == "drive-file-1"


def test_attachment_upload_should_not_persist_when_drive_upload_fails(db_session, support_case_id):
    response = client.post(
        "/api/v1/attachments/upload",
        headers=auth_headers(),
        data={"support_case_id": support_case_id, "file_type": "AGREEMENT"},
        files={"file": ("agreement.pdf", b"pdf-bytes", "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "failed"
    assert "Google Drive" in body["message"]
    assert db_session.query(Attachment).count() == 0
