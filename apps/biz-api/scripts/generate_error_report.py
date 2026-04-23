from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path
from typing import Any


def summarize_errors(errors: list[dict[str, Any]]) -> dict[str, Any]:
    counter = Counter(str(item.get("reason", "UNKNOWN")) for item in errors)
    return {
        "total": len(errors),
        "by_reason": dict(counter),
    }


def write_error_report_csv(errors: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    discovered = {key for item in errors for key in item.keys()}
    preferred = ["row_no", "reason", "participant_name"]
    fields = [name for name in preferred if name in discovered] + sorted(discovered - set(preferred))

    with output_path.open("w", encoding="utf-8", newline="") as csvfile:
        if not fields:
            csvfile.write("\n")
            return

        writer = csv.DictWriter(csvfile, fieldnames=fields)
        writer.writeheader()
        for row in errors:
            writer.writerow(row)


def run() -> None:
    sample_errors = [
        {"row_no": 2, "reason": "MISSING_REQUIRED_FIELDS", "participant_name": ""},
        {"row_no": 9, "reason": "PROGRAM_UNMATCHED", "participant_name": "기업A"},
    ]
    summary = summarize_errors(sample_errors)
    write_error_report_csv(sample_errors, Path("error_report.csv"))
    print(summary)


if __name__ == '__main__':
    run()
