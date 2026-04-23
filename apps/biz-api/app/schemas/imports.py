from typing import Any, Literal

from pydantic import BaseModel, Field


class ImportStagingRow(BaseModel):
    participant_name_raw: str | None = None
    biz_no_raw: str | None = None
    program_name_raw: str | None = None
    sub_program_name_raw: str | None = None
    support_amount_raw: str | None = None
    year: int | None = None

    model_config = {"extra": "allow"}


class ImportStagingToCoreRequest(BaseModel):
    rows: list[ImportStagingRow] | None = None
    source_file_name: str | None = None


class ImportSummary(BaseModel):
    participants_count: int
    programs_count: int
    support_cases_count: int
    errors_count: int
    errors_by_reason: dict[str, int]
    error_report_path: str | None = None


class ImportStagingToCoreResponse(BaseModel):
    status: Literal["completed", "failed"]
    summary: ImportSummary | None = None
    message: str | None = None


class ExcelToStagingResponse(BaseModel):
    status: Literal["completed", "failed"]
    filename: str | None = None
    rows_count: int = 0
    rows: list[ImportStagingRow] = Field(default_factory=list)
    message: str | None = None


def dump_import_rows(rows: list[ImportStagingRow]) -> list[dict[str, Any]]:
    return [row.model_dump(exclude_none=True) for row in rows]
