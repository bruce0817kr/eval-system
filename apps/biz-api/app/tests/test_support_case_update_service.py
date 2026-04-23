from app.services.support_case_update_service import apply_support_case_update


def test_should_apply_patch_and_generate_histories_for_status_changes():
    current_case = {
        "id": "case-1",
        "agreement_status": "NOT_STARTED",
        "execution_status": "NOT_PAID",
        "settlement_status": "NOT_SUBMITTED",
        "completion_status": "NOT_COMPLETED",
        "remarks": "old",
    }
    patch = {
        "agreement_status": "COMPLETED",
        "execution_status": "PARTIAL_PAID",
        "remarks": "updated",
    }

    result = apply_support_case_update(current_case, patch, changed_by="manager-1")

    assert result["support_case"]["agreement_status"] == "COMPLETED"
    assert result["support_case"]["remarks"] == "updated"
    assert len(result["status_histories"]) == 2


def test_should_return_no_histories_if_only_non_status_changed():
    current_case = {
        "id": "case-1",
        "agreement_status": "COMPLETED",
        "execution_status": "PAID",
        "settlement_status": "APPROVED",
        "completion_status": "COMPLETED",
        "remarks": "old",
    }
    patch = {"remarks": "new note"}

    result = apply_support_case_update(current_case, patch, changed_by="manager-1")

    assert result["support_case"]["remarks"] == "new note"
    assert result["status_histories"] == []
