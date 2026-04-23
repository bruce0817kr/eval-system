from app.services.support_case_api_service import handle_list_support_cases
from app.services.support_case_repository import InMemorySupportCaseRepository


def test_should_return_all_cases_when_no_filter():
    repo = InMemorySupportCaseRepository(
        seed_cases={
            "c1": {"id": "c1", "agreement_status": "COMPLETED", "participant_id": "p1"},
            "c2": {"id": "c2", "agreement_status": "NOT_STARTED", "participant_id": "p2"},
        }
    )

    result = handle_list_support_cases(repo, {})

    assert len(result["items"]) == 2


def test_should_filter_cases_by_agreement_status_and_participant_id():
    repo = InMemorySupportCaseRepository(
        seed_cases={
            "c1": {"id": "c1", "agreement_status": "COMPLETED", "participant_id": "p1"},
            "c2": {"id": "c2", "agreement_status": "NOT_STARTED", "participant_id": "p1"},
            "c3": {"id": "c3", "agreement_status": "COMPLETED", "participant_id": "p2"},
        }
    )

    result = handle_list_support_cases(repo, {"agreement_status": "COMPLETED", "participant_id": "p1"})

    assert len(result["items"]) == 1
    assert result["items"][0]["id"] == "c1"
