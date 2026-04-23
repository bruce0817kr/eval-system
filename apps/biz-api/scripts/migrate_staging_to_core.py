"""Transform staging rows into participants/programs/support_cases.
This module keeps migration deterministic and testable before wiring to DB IO.
"""

from dataclasses import dataclass, field
from typing import Any

from app.services.migration_service import clean_text, normalize_biz_no, parse_amount


@dataclass
class CoreMigrationResult:
    participants: list[dict[str, Any]] = field(default_factory=list)
    programs: list[dict[str, Any]] = field(default_factory=list)
    support_cases: list[dict[str, Any]] = field(default_factory=list)
    errors: list[dict[str, Any]] = field(default_factory=list)


def _participant_key(name: str | None, biz_no: str | None, ceo_name: str | None) -> str:
    if biz_no:
        return f"BIZ:{biz_no}"
    return f"NAME:{name or ''}|CEO:{ceo_name or ''}"


def _program_key(year: int, program_name: str, sub_program_name: str | None) -> str:
    return f"{year}:{program_name}:{sub_program_name or ''}"


def migrate_staging_rows(rows: list[dict[str, Any]]) -> CoreMigrationResult:
    result = CoreMigrationResult()
    participant_map: dict[str, dict[str, Any]] = {}
    program_map: dict[str, dict[str, Any]] = {}

    for idx, row in enumerate(rows, start=1):
        participant_name = clean_text(row.get("participant_name_raw"))
        program_name = clean_text(row.get("program_name_raw"))
        if not participant_name or not program_name:
            result.errors.append({"row_no": idx, "reason": "MISSING_REQUIRED_FIELDS", "row": row})
            continue

        biz_no = normalize_biz_no(row.get("biz_no_raw"))
        ceo_name = clean_text(row.get("ceo_name_raw"))
        participant_type = "COMPANY" if biz_no else "PRE_STARTUP"

        p_key = _participant_key(participant_name, biz_no, ceo_name)
        participant = participant_map.get(p_key)
        if participant is None:
            participant = {
                "participant_name": participant_name,
                "biz_no": biz_no,
                "ceo_name": ceo_name,
                "participant_type": participant_type,
            }
            participant_map[p_key] = participant
            result.participants.append(participant)

        year = int(row.get("year") or 2026)
        sub_program_name = clean_text(row.get("sub_program_name_raw"))
        pr_key = _program_key(year, program_name, sub_program_name)
        program = program_map.get(pr_key)
        if program is None:
            program = {
                "year": year,
                "program_name": program_name,
                "sub_program_name": sub_program_name,
            }
            program_map[pr_key] = program
            result.programs.append(program)

        support_case = {
            "participant_key": p_key,
            "program_key": pr_key,
            "support_amount": parse_amount(row.get("support_amount_raw")),
            "remarks": clean_text(row.get("support_content_raw")),
        }
        result.support_cases.append(support_case)

    return result


def run() -> None:
    sample_rows = [
        {
            "participant_name_raw": "샘플기업",
            "biz_no_raw": "123-45-67890",
            "program_name_raw": "샘플사업",
            "sub_program_name_raw": "샘플세부사업",
            "support_amount_raw": "1,000,000",
            "year": 2026,
        }
    ]
    summary = migrate_staging_rows(sample_rows)
    print(
        {
            "participants": len(summary.participants),
            "programs": len(summary.programs),
            "support_cases": len(summary.support_cases),
            "errors": len(summary.errors),
        }
    )


if __name__ == '__main__':
    run()
