from __future__ import annotations

from datetime import datetime, UTC
from pathlib import Path
from typing import Any

from scripts.generate_error_report import summarize_errors, write_error_report_csv
from scripts.migrate_staging_to_core import migrate_staging_rows


class ImportValidationError(ValueError):
    pass


class ImportReportPathError(ValueError):
    pass


def validate_import_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = payload.get("rows")
    if rows is None:
        raise ImportValidationError("'rows' 필드는 필수입니다.")
    if not isinstance(rows, list):
        raise ImportValidationError("'rows'는 배열이어야 합니다.")
    if not all(isinstance(row, dict) for row in rows):
        raise ImportValidationError("'rows'의 각 항목은 객체여야 합니다.")
    return rows


def process_staging_batch(rows: list[dict[str, Any]], report_dir: Path) -> dict[str, Any]:
    migration_result = migrate_staging_rows(rows)

    error_report_path: str | None = None
    if migration_result.errors:
        timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
        output_path = report_dir / f"migration_errors_{timestamp}.csv"
        write_error_report_csv(migration_result.errors, output_path)
        error_report_path = str(output_path)

    summary = summarize_errors(migration_result.errors)
    return {
        "participants_count": len(migration_result.participants),
        "programs_count": len(migration_result.programs),
        "support_cases_count": len(migration_result.support_cases),
        "errors_count": summary["total"],
        "errors_by_reason": summary["by_reason"],
        "error_report_path": error_report_path,
    }


def resolve_error_report_path(report_path: str, report_dir: Path) -> Path:
    candidate = Path(report_path)
    if not candidate.is_absolute():
        candidate = Path.cwd() / candidate

    resolved = candidate.resolve()
    allowed = report_dir.resolve()

    if allowed not in [resolved, *resolved.parents]:
        raise ImportReportPathError("허용되지 않은 report 경로입니다.")
    if not resolved.exists():
        raise ImportReportPathError("report 파일을 찾을 수 없습니다.")
    return resolved
