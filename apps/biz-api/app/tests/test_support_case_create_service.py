from app.services.support_case_api_service import handle_create_support_case
from app.services.support_case_repository import InMemorySupportCaseRepository


def test_should_create_support_case_when_required_fields_exist():
    repo = InMemorySupportCaseRepository(seed_cases={})

    result = handle_create_support_case(
        repo,
        {
            "participant_id": "p-1",
            "program_id": "pg-1",
            "selection_result": "APPLIED",
            "remarks": "new case",
            "created_by": "manager-1",
        },
    )

    assert result["status"] == "created"
    assert result["support_case"]["participant_id"] == "p-1"
    assert result["support_case"]["id"].startswith("case-")


def test_should_fail_when_required_fields_missing():
    repo = InMemorySupportCaseRepository(seed_cases={})

    result = handle_create_support_case(repo, {"program_id": "pg-1"})

    assert result["status"] == "failed"
    assert "participant_id" in result["message"]
