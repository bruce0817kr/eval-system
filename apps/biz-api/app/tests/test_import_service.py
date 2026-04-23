from pathlib import Path

from app.services.import_service import process_staging_batch


def test_should_process_rows_and_return_core_counts(tmp_path: Path):
    rows = [
        {
            "participant_name_raw": "기업A",
            "biz_no_raw": "123-45-67890",
            "program_name_raw": "수출지원",
            "sub_program_name_raw": "초보기업",
            "support_amount_raw": "1000000",
            "year": 2026,
        }
    ]

    result = process_staging_batch(rows, report_dir=tmp_path)

    assert result["participants_count"] == 1
    assert result["programs_count"] == 1
    assert result["support_cases_count"] == 1
    assert result["errors_count"] == 0
    assert result["error_report_path"] is None


def test_should_create_error_report_when_errors_exist(tmp_path: Path):
    rows = [
        {
            "participant_name_raw": "",
            "biz_no_raw": "",
            "program_name_raw": "",
            "sub_program_name_raw": "초보기업",
            "year": 2026,
        }
    ]

    result = process_staging_batch(rows, report_dir=tmp_path)

    assert result["errors_count"] == 1
    assert result["error_report_path"] is not None
    report_path = Path(result["error_report_path"])
    assert report_path.exists()
    assert "MISSING_REQUIRED_FIELDS" in report_path.read_text(encoding="utf-8")
