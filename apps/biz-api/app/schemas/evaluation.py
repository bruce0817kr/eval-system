from typing import Literal

from pydantic import BaseModel


class EvaluationUploadResponse(BaseModel):
    status: Literal["completed", "failed"]
    filename: str | None = None
    rows_count: int = 0
    selected_count: int = 0
    synced_support_cases_count: int = 0
    sync_status: str = "PENDING"
    message: str | None = None
