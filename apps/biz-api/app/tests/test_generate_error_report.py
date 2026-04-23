from pathlib import Path

from scripts.generate_error_report import summarize_errors, write_error_report_csv


def test_should_group_errors_by_reason_and_count():
    errors = [
        {"row_no": 1, "reason": "MISSING_REQUIRED_FIELDS"},
        {"row_no": 2, "reason": "MISSING_REQUIRED_FIELDS"},
        {"row_no": 3, "reason": "PARTICIPANT_UNMATCHED"},
    ]

    summary = summarize_errors(errors)

    assert summary["total"] == 3
    assert summary["by_reason"]["MISSING_REQUIRED_FIELDS"] == 2
    assert summary["by_reason"]["PARTICIPANT_UNMATCHED"] == 1


def test_should_write_error_report_csv_file(tmp_path: Path):
    errors = [
        {"row_no": 1, "reason": "MISSING_REQUIRED_FIELDS", "participant_name": ""},
        {"row_no": 7, "reason": "PROGRAM_UNMATCHED", "participant_name": "기업A"},
    ]
    report_path = tmp_path / "error_report.csv"

    write_error_report_csv(errors, report_path)

    text = report_path.read_text(encoding="utf-8")
    assert "row_no,reason,participant_name" in text
    assert "1,MISSING_REQUIRED_FIELDS," in text
    assert "7,PROGRAM_UNMATCHED,기업A" in text
