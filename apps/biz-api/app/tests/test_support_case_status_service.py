from app.services.support_case_status_service import build_status_histories


def test_should_build_history_for_each_changed_status_field():
    old_case = {
        "agreement_status": "NOT_STARTED",
        "execution_status": "NOT_PAID",
        "settlement_status": "NOT_SUBMITTED",
        "completion_status": "NOT_COMPLETED",
    }
    new_case = {
        "agreement_status": "COMPLETED",
        "execution_status": "PARTIAL_PAID",
        "settlement_status": "NOT_SUBMITTED",
        "completion_status": "NOT_COMPLETED",
    }

    histories = build_status_histories(old_case, new_case, changed_by="user-1")

    assert len(histories) == 2
    assert histories[0]["status_category"] == "agreement_status"
    assert histories[0]["old_value"] == "NOT_STARTED"
    assert histories[0]["new_value"] == "COMPLETED"
    assert histories[1]["status_category"] == "execution_status"


def test_should_return_empty_when_no_status_changed():
    old_case = {
        "agreement_status": "COMPLETED",
        "execution_status": "PAID",
        "settlement_status": "APPROVED",
        "completion_status": "COMPLETED",
    }
    new_case = dict(old_case)

    histories = build_status_histories(old_case, new_case, changed_by="user-1")

    assert histories == []
