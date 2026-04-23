from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import SupportCase, SupportCaseStatusHistory


def _to_uuid(value: Any) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _parse_datetime(value: Any) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


def _case_to_dict(item: SupportCase) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "participant_id": str(item.participant_id),
        "program_id": str(item.program_id),
        "evaluation_result_id": str(item.evaluation_result_id) if item.evaluation_result_id else None,
        "selection_result": item.selection_result,
        "agreement_status": item.agreement_status,
        "execution_status": item.execution_status,
        "settlement_status": item.settlement_status,
        "completion_status": item.completion_status,
        "support_amount": _to_float(item.support_amount),
        "self_fund_amount": _to_float(item.self_fund_amount),
        "remarks": item.remarks,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _history_to_dict(item: SupportCaseStatusHistory) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "case_id": str(item.support_case_id),
        "status_category": item.status_category,
        "old_value": item.old_value,
        "new_value": item.new_value,
        "changed_by": item.changed_by,
        "changed_at": item.changed_at.isoformat() if item.changed_at else None,
    }


CASE_FIELDS = (
    "selection_result",
    "agreement_status",
    "execution_status",
    "settlement_status",
    "completion_status",
    "support_amount",
    "self_fund_amount",
    "remarks",
)


class DBSupportCaseRepository:
    """SQLAlchemy-backed support_cases repository."""

    def __init__(self, session: Session | None) -> None:
        self.session = session

    def get(self, case_id: str) -> dict[str, Any] | None:
        self._require_session()
        item = self.session.get(SupportCase, _to_uuid(case_id))
        return _case_to_dict(item) if item else None

    def save(self, case_id: str, support_case: dict[str, Any]) -> dict[str, Any]:
        self._require_session()
        item = self.session.get(SupportCase, _to_uuid(case_id))
        if item is None:
            raise ValueError(f"Support case not found: {case_id}")

        for field in CASE_FIELDS:
            if field in support_case:
                setattr(item, field, support_case[field])

        self.session.commit()
        self.session.refresh(item)
        return _case_to_dict(item)

    def create(self, support_case: dict[str, Any]) -> dict[str, Any]:
        self._require_session()
        item = SupportCase(
            participant_id=_to_uuid(support_case["participant_id"]),
            program_id=_to_uuid(support_case["program_id"]),
            evaluation_result_id=_to_uuid(support_case["evaluation_result_id"])
            if support_case.get("evaluation_result_id")
            else None,
            selection_result=support_case.get("selection_result", "APPLIED"),
            agreement_status=support_case.get("agreement_status", "NOT_STARTED"),
            execution_status=support_case.get("execution_status", "NOT_PAID"),
            settlement_status=support_case.get("settlement_status", "NOT_SUBMITTED"),
            completion_status=support_case.get("completion_status", "NOT_COMPLETED"),
            support_amount=support_case.get("support_amount"),
            self_fund_amount=support_case.get("self_fund_amount"),
            remarks=support_case.get("remarks"),
        )
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return _case_to_dict(item)

    def list(self) -> list[dict[str, Any]]:
        self._require_session()
        items = self.session.query(SupportCase).order_by(SupportCase.created_at.desc()).all()
        return [_case_to_dict(item) for item in items]

    def _require_session(self) -> None:
        if self.session is None:
            raise RuntimeError("DBSupportCaseRepository requires a SQLAlchemy session.")


class DBStatusHistoryRepository:
    """SQLAlchemy-backed support_case_status_histories repository."""

    def __init__(self, session: Session | None) -> None:
        self.session = session

    def add(self, item: dict[str, Any]) -> None:
        self._require_session()
        history = SupportCaseStatusHistory(
            support_case_id=_to_uuid(item["case_id"]),
            status_category=item["status_category"],
            old_value=item.get("old_value"),
            new_value=item.get("new_value"),
            changed_by=item.get("changed_by"),
            changed_at=_parse_datetime(item.get("changed_at")) or datetime.now(UTC),
        )
        self.session.add(history)
        self.session.commit()

    def list_by_case_id(self, case_id: str) -> list[dict[str, Any]]:
        self._require_session()
        items = (
            self.session.query(SupportCaseStatusHistory)
            .filter(SupportCaseStatusHistory.support_case_id == _to_uuid(case_id))
            .order_by(SupportCaseStatusHistory.changed_at.asc())
            .all()
        )
        return [_history_to_dict(item) for item in items]

    def _require_session(self) -> None:
        if self.session is None:
            raise RuntimeError("DBStatusHistoryRepository requires a SQLAlchemy session.")
