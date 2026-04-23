from __future__ import annotations

from typing import Any

from app.services.support_case_application_service import update_support_case_and_collect_histories
from app.services.support_case_repository import StatusHistoryRepository, SupportCaseRepository


class SupportCaseValidationError(ValueError):
    pass


REQUIRED_CREATE_FIELDS = ("participant_id", "program_id")


def build_response(status: str, data: dict[str, Any] | None = None, message: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "status": status,
        "message": message,
        "data": data,
    }
    if data:
        payload.update(data)
    return payload


def validate_support_case_update_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise SupportCaseValidationError("payload는 객체여야 합니다.")
    if "changed_by" in payload and payload["changed_by"] is not None and not isinstance(payload["changed_by"], str):
        raise SupportCaseValidationError("changed_by는 문자열이어야 합니다.")
    return payload


def validate_support_case_create_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise SupportCaseValidationError("payload는 객체여야 합니다.")

    missing = [field for field in REQUIRED_CREATE_FIELDS if not payload.get(field)]
    if missing:
        raise SupportCaseValidationError(f"필수값 누락: {', '.join(missing)}")

    return payload


def handle_create_support_case(case_repo: SupportCaseRepository, payload: Any) -> dict[str, Any]:
    try:
        data = validate_support_case_create_payload(payload)
    except SupportCaseValidationError as exc:
        return build_response("failed", message=str(exc))

    created = case_repo.create(
        {
            "participant_id": data["participant_id"],
            "program_id": data["program_id"],
            "selection_result": data.get("selection_result", "APPLIED"),
            "agreement_status": data.get("agreement_status", "NOT_STARTED"),
            "execution_status": data.get("execution_status", "NOT_PAID"),
            "settlement_status": data.get("settlement_status", "NOT_SUBMITTED"),
            "completion_status": data.get("completion_status", "NOT_COMPLETED"),
            "remarks": data.get("remarks"),
            "created_by": data.get("created_by"),
        }
    )
    return build_response("created", data={"support_case": created})


def handle_list_support_cases(case_repo: SupportCaseRepository, query: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    items = case_repo.list()

    agreement_status = query.get("agreement_status")
    participant_id = query.get("participant_id")

    if agreement_status:
        items = [item for item in items if item.get("agreement_status") == agreement_status]
    if participant_id:
        items = [item for item in items if item.get("participant_id") == participant_id]

    return build_response("ok", data={"items": items})


def handle_list_support_case_histories(history_repo: StatusHistoryRepository, case_id: str) -> dict[str, list[dict[str, Any]]]:
    return build_response("ok", data={"items": history_repo.list_by_case_id(case_id)})


def handle_support_case_update(
    case_repo: SupportCaseRepository,
    history_repo: StatusHistoryRepository,
    case_id: str,
    payload: Any,
) -> dict[str, Any]:
    current_case = case_repo.get(case_id)
    if not current_case:
        return build_response("not_found", data={"case_id": case_id})

    try:
        patch = validate_support_case_update_payload(payload)
    except SupportCaseValidationError as exc:
        return build_response("failed", message=str(exc))

    result = update_support_case_and_collect_histories(
        current_case=current_case,
        patch=patch,
        changed_by=patch.get("changed_by"),
        persist_history=lambda item: history_repo.add({"case_id": case_id, **item}),
    )
    case_repo.save(case_id, result["support_case"])
    return build_response("updated", data=result)
