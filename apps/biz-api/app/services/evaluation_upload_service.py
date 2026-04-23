from __future__ import annotations

from io import BytesIO
from typing import Any
import uuid

import pandas as pd


def _is_selected(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    return normalized in {"true", "1", "y", "yes", "selected", "선정"}


def parse_evaluation_csv(content: bytes) -> dict[str, int]:
    dataframe = pd.read_csv(BytesIO(content))
    rows_count = len(dataframe.index)
    selected_count = 0
    if "selected_yn" in dataframe.columns:
        selected_count = sum(1 for value in dataframe["selected_yn"] if _is_selected(value))
    return {"rows_count": rows_count, "selected_count": selected_count}


def parse_evaluation_rows(content: bytes) -> list[dict[str, Any]]:
    dataframe = pd.read_csv(BytesIO(content))
    rows: list[dict[str, Any]] = []
    for raw_row in dataframe.to_dict(orient="records"):
        rows.append(
            {
                "external_eval_id": _clean_optional(raw_row.get("external_eval_id")),
                "participant_id": _parse_uuid(raw_row.get("participant_id")),
                "program_id": _parse_uuid(raw_row.get("program_id")),
                "total_score": _clean_optional(raw_row.get("total_score")),
                "ranking": _clean_optional(raw_row.get("ranking")),
                "selected_yn": _is_selected(raw_row.get("selected_yn")),
            }
        )
    return rows


def _clean_optional(value: Any) -> Any:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _parse_uuid(value: Any) -> uuid.UUID | None:
    cleaned = _clean_optional(value)
    return uuid.UUID(str(cleaned)) if cleaned else None
