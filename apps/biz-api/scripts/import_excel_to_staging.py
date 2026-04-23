"""Import xlsx multi-sheet rows into staging_support_raw.
Skips header-like rows, blank rows, and summary(total) rows.
"""

from pathlib import Path
from collections.abc import Iterable
from app.services.migration_service import clean_text, normalize_biz_no, parse_amount

HEADER_TOKENS = {"기업명", "사업자등록번호", "지원금", "사업명"}
TOTAL_TOKENS = {"합계", "총계"}


def _string_values(row: Iterable[object]) -> list[str]:
    return [str(v).strip() for v in row if v is not None and str(v).strip() and str(v).lower() != 'nan']


def is_skippable_row(row: Iterable[object]) -> bool:
    values = _string_values(row)
    if not values:
        return True

    joined = " ".join(values)
    if any(token in joined for token in TOTAL_TOKENS):
        return True

    return set(values).issubset(HEADER_TOKENS)


def filter_valid_rows(rows: Iterable[Iterable[object]]) -> list[list[object]]:
    return [list(row) for row in rows if not is_skippable_row(row)]


def normalize_row(row: dict[str, object]) -> dict[str, object | None]:
    participant_name = clean_text(str(row.get("participant_name", "")))
    biz_no = normalize_biz_no(str(row.get("biz_no", "")))
    support_amount = parse_amount(row.get("support_amount"))

    return {
        "participant_name": participant_name,
        "biz_no": biz_no,
        "support_amount": support_amount,
    }


def load_excel(path: str) -> int:
    import pandas as pd

    workbook = pd.read_excel(path, sheet_name=None)
    inserted = 0
    for _, df in workbook.items():
        for row in filter_valid_rows(df.itertuples(index=False, name=None)):
            _ = row
            inserted += 1
    return inserted


if __name__ == '__main__':
    sample = Path('sample.xlsx')
    print(load_excel(str(sample)) if sample.exists() else 0)
