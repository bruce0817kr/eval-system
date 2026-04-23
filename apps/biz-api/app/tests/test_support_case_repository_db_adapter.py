import os
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.core.database import Base
from app.models.entities import Participant, ParticipantType, Program
from app.services.support_case_repository_db import DBStatusHistoryRepository, DBSupportCaseRepository


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def seeded_ids(db_session):
    participant_id = uuid.uuid4()
    program_id = uuid.uuid4()
    db_session.add(
        Participant(
            id=participant_id,
            participant_type=ParticipantType.COMPANY,
            participant_name="기업A",
            biz_no="1234567890",
        )
    )
    db_session.add(
        Program(
            id=program_id,
            year=2026,
            program_name="수출지원",
        )
    )
    db_session.commit()
    return {"participant_id": str(participant_id), "program_id": str(program_id)}


def test_db_support_case_repository_should_create_get_list_and_save(db_session, seeded_ids):
    repo = DBSupportCaseRepository(session=db_session)

    created = repo.create(
        {
            "participant_id": seeded_ids["participant_id"],
            "program_id": seeded_ids["program_id"],
            "agreement_status": "NOT_STARTED",
            "execution_status": "NOT_PAID",
            "settlement_status": "NOT_SUBMITTED",
            "completion_status": "NOT_COMPLETED",
            "remarks": "initial",
        }
    )

    assert created["id"]
    assert created["participant_id"] == seeded_ids["participant_id"]
    assert created["program_id"] == seeded_ids["program_id"]
    assert created["remarks"] == "initial"

    fetched = repo.get(created["id"])
    assert fetched is not None
    assert fetched["id"] == created["id"]

    saved = repo.save(created["id"], {**fetched, "remarks": "updated", "agreement_status": "COMPLETED"})
    assert saved["remarks"] == "updated"
    assert saved["agreement_status"] == "COMPLETED"

    items = repo.list()
    assert [item["id"] for item in items] == [created["id"]]


def test_db_status_history_repository_should_add_and_list_by_case_id(db_session, seeded_ids):
    case_repo = DBSupportCaseRepository(session=db_session)
    history_repo = DBStatusHistoryRepository(session=db_session)
    created = case_repo.create(
        {
            "participant_id": seeded_ids["participant_id"],
            "program_id": seeded_ids["program_id"],
        }
    )

    history_repo.add(
        {
            "case_id": created["id"],
            "status_category": "agreement_status",
            "old_value": "NOT_STARTED",
            "new_value": "COMPLETED",
            "changed_by": "manager-1",
            "changed_at": "2026-04-17T00:00:00+00:00",
        }
    )
    history_repo.add(
        {
            "case_id": str(uuid.uuid4()),
            "status_category": "execution_status",
            "new_value": "PAID",
        }
    )

    histories = history_repo.list_by_case_id(created["id"])

    assert len(histories) == 1
    assert histories[0]["case_id"] == created["id"]
    assert histories[0]["status_category"] == "agreement_status"
    assert histories[0]["old_value"] == "NOT_STARTED"
    assert histories[0]["new_value"] == "COMPLETED"
    assert histories[0]["changed_by"] == "manager-1"
