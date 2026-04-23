from typing import Any, Literal

from pydantic import BaseModel, Field


class SupportCaseCreateRequest(BaseModel):
    participant_id: str = Field(..., min_length=1)
    program_id: str = Field(..., min_length=1)
    selection_result: str | None = None
    agreement_status: str | None = None
    execution_status: str | None = None
    settlement_status: str | None = None
    completion_status: str | None = None
    remarks: str | None = None
    created_by: str | None = None


class SupportCaseUpdateRequest(BaseModel):
    selection_result: str | None = None
    agreement_status: str | None = None
    execution_status: str | None = None
    settlement_status: str | None = None
    completion_status: str | None = None
    remarks: str | None = None
    changed_by: str | None = None


class StandardResponse(BaseModel):
    status: str
    message: str | None = None
    data: dict[str, Any] | None = None


class SupportCaseListResponse(StandardResponse):
    status: Literal["ok"]
    items: list[dict[str, Any]] = Field(default_factory=list)


class SupportCaseHistoryListResponse(StandardResponse):
    status: Literal["ok"]
    items: list[dict[str, Any]] = Field(default_factory=list)


class SupportCaseMutationResponse(StandardResponse):
    support_case: dict[str, Any] | None = None
    status_histories: list[dict[str, Any]] | None = None
    case_id: str | None = None
