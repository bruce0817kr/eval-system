from app.services.support_case_application_service import update_support_case_and_collect_histories


def test_should_persist_histories_when_status_changes():
    saved = []

    def persist(item):
        saved.append(item)

    current_case = {
        "id": "case-1",
        "agreement_status": "NOT_STARTED",
        "execution_status": "NOT_PAID",
        "settlement_status": "NOT_SUBMITTED",
        "completion_status": "NOT_COMPLETED",
        "remarks": "before",
    }
    patch = {
        "agreement_status": "COMPLETED",
        "execution_status": "PARTIAL_PAID",
        "remarks": "after",
    }

    result = update_support_case_and_collect_histories(current_case, patch, "user-1", persist)

    assert result["support_case"]["remarks"] == "after"
    assert len(saved) == 2
    assert saved[0]["status_category"] == "agreement_status"


def test_should_skip_persist_when_no_status_changes():
    saved = []

    def persist(item):
        saved.append(item)

    current_case = {
        "id": "case-1",
        "agreement_status": "COMPLETED",
        "execution_status": "PAID",
        "settlement_status": "APPROVED",
        "completion_status": "COMPLETED",
        "remarks": "before",
    }

    result = update_support_case_and_collect_histories(current_case, {"remarks": "memo"}, "user-1", persist)

    assert result["support_case"]["remarks"] == "memo"
    assert saved == []
