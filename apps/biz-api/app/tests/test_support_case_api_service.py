from app.services.support_case_api_service import handle_support_case_update
from app.services.support_case_repository import InMemoryStatusHistoryRepository, InMemorySupportCaseRepository


def test_should_return_not_found_when_case_missing():
    case_repo = InMemorySupportCaseRepository(seed_cases={})
    history_repo = InMemoryStatusHistoryRepository()

    result = handle_support_case_update(case_repo, history_repo, "missing", {"remarks": "x"})

    assert result["status"] == "not_found"


def test_should_return_failed_when_payload_invalid():
    case_repo = InMemorySupportCaseRepository(
        seed_cases={
            "case-1": {
                "id": "case-1",
                "agreement_status": "NOT_STARTED",
                "execution_status": "NOT_PAID",
                "settlement_status": "NOT_SUBMITTED",
                "completion_status": "NOT_COMPLETED",
            }
        }
    )
    history_repo = InMemoryStatusHistoryRepository()

    result = handle_support_case_update(case_repo, history_repo, "case-1", payload="invalid")

    assert result["status"] == "failed"
    assert "객체" in result["message"]


def test_should_update_case_and_persist_histories():
    case_repo = InMemorySupportCaseRepository(
        seed_cases={
            "case-1": {
                "id": "case-1",
                "agreement_status": "NOT_STARTED",
                "execution_status": "NOT_PAID",
                "settlement_status": "NOT_SUBMITTED",
                "completion_status": "NOT_COMPLETED",
                "remarks": "old",
            }
        }
    )
    history_repo = InMemoryStatusHistoryRepository()

    result = handle_support_case_update(
        case_repo,
        history_repo,
        "case-1",
        {
            "agreement_status": "COMPLETED",
            "execution_status": "PARTIAL_PAID",
            "remarks": "new",
            "changed_by": "manager-1",
        },
    )

    assert result["status"] == "updated"
    assert result["support_case"]["remarks"] == "new"
    assert len(result["status_histories"]) == 2
    assert len(history_repo.items) == 2
