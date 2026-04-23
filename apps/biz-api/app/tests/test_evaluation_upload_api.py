import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.api.deps import get_db
from app.core.database import Base
from app.main import app
from app.models.entities import EvaluationResult, Participant, ParticipantType, Program, SupportCase


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


@pytest.fixture()
def seeded_entities(db_session):
    participant_1 = uuid.uuid4()
    participant_2 = uuid.uuid4()
    program_id = uuid.uuid4()
    db_session.add_all(
        [
            Participant(
                id=participant_1,
                participant_type=ParticipantType.COMPANY,
                participant_name="Eval Company 1",
            ),
            Participant(
                id=participant_2,
                participant_type=ParticipantType.COMPANY,
                participant_name="Eval Company 2",
            ),
            Program(id=program_id, year=2026, program_name="Eval Program"),
        ]
    )
    db_session.commit()
    return {"participant_1": participant_1, "participant_2": participant_2, "program_id": program_id}


def auth_headers() -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "admin"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_evaluation_csv_upload_should_persist_rows_and_sync_selected_support_cases(db_session, seeded_entities):
    csv_content = "\n".join(
        [
            "external_eval_id,participant_id,program_id,total_score,ranking,selected_yn",
            f"eval-1,{seeded_entities['participant_1']},{seeded_entities['program_id']},92.5,1,true",
            f"eval-2,{seeded_entities['participant_2']},{seeded_entities['program_id']},78.0,2,false",
        ]
    ).encode("utf-8")

    response = client.post(
        "/api/v1/evaluation-results/upload-csv",
        headers=auth_headers(),
        files={"file": ("evaluations.csv", csv_content, "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["filename"] == "evaluations.csv"
    assert body["rows_count"] == 2
    assert body["selected_count"] == 1
    assert body["synced_support_cases_count"] == 1
    assert body["sync_status"] == "SYNCED"

    evaluations = db_session.query(EvaluationResult).order_by(EvaluationResult.ranking.asc()).all()
    assert len(evaluations) == 2
    assert evaluations[0].external_eval_id == "eval-1"
    assert float(evaluations[0].total_score) == 92.5
    assert evaluations[0].selected_yn is True
    assert evaluations[0].sync_status == "SYNCED"
    assert evaluations[1].selected_yn is False
    assert evaluations[1].sync_status == "PENDING"

    support_cases = db_session.query(SupportCase).all()
    assert len(support_cases) == 1
    assert support_cases[0].evaluation_result_id == evaluations[0].id
    assert support_cases[0].selection_result == "SELECTED"


def test_evaluation_csv_upload_should_not_duplicate_existing_external_eval_ids(db_session, seeded_entities):
    csv_content = "\n".join(
        [
            "external_eval_id,participant_id,program_id,total_score,ranking,selected_yn",
            f"eval-1,{seeded_entities['participant_1']},{seeded_entities['program_id']},92.5,1,true",
            f"eval-2,{seeded_entities['participant_2']},{seeded_entities['program_id']},78.0,2,false",
        ]
    ).encode("utf-8")

    for _ in range(2):
        response = client.post(
            "/api/v1/evaluation-results/upload-csv",
            headers=auth_headers(),
            files={"file": ("evaluations.csv", csv_content, "text/csv")},
        )
        assert response.status_code == 200

    assert db_session.query(EvaluationResult).count() == 2
    assert db_session.query(SupportCase).count() == 1


def test_evaluation_external_eval_id_should_be_unique_at_database_level(db_session, seeded_entities):
    db_session.add(
        EvaluationResult(
            external_eval_id="eval-unique",
            participant_id=seeded_entities["participant_1"],
            program_id=seeded_entities["program_id"],
        )
    )
    db_session.commit()

    db_session.add(
        EvaluationResult(
            external_eval_id="eval-unique",
            participant_id=seeded_entities["participant_2"],
            program_id=seeded_entities["program_id"],
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
