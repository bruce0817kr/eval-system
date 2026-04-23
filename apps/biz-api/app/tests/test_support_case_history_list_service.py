from app.services.support_case_api_service import handle_list_support_case_histories
from app.services.support_case_repository import InMemoryStatusHistoryRepository


def test_should_return_histories_filtered_by_case_id():
    repo = InMemoryStatusHistoryRepository(
        items=[
            {"case_id": "case-1", "status_category": "agreement_status", "new_value": "COMPLETED"},
            {"case_id": "case-2", "status_category": "execution_status", "new_value": "PAID"},
            {"case_id": "case-1", "status_category": "settlement_status", "new_value": "APPROVED"},
        ]
    )

    result = handle_list_support_case_histories(repo, "case-1")

    assert len(result["items"]) == 2
    assert all(item["case_id"] == "case-1" for item in result["items"])
