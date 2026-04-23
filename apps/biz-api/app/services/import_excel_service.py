from __future__ import annotations

from io import BytesIO
from typing import Any

import pandas as pd

STAGING_COLUMNS = (
    "participant_name_raw",
    "biz_no_raw",
    "program_name_raw",
    "sub_program_name_raw",
    "support_amount_raw",
    "year",
)


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, float) and pd.isna(value)) or str(value).strip() == ""


def _clean_value(value: Any) -> Any:
    if _is_blank(value):
        return None
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, str):
        return value.strip()
    return value


def parse_excel_to_staging_rows(content: bytes) -> list[dict[str, Any]]:
    workbook = pd.read_excel(BytesIO(content), sheet_name=None)
    rows: list[dict[str, Any]] = []

    for sheet_name, dataframe in workbook.items():
        for index, raw_row in enumerate(dataframe.to_dict(orient="records")):
            row = {column: _clean_value(raw_row.get(column)) for column in STAGING_COLUMNS}
            if all(value is None for value in row.values()):
                continue
            row["_source_sheet_name"] = sheet_name
            row["_row_no"] = int(index) + 2
            rows.append(row)

    return rows
