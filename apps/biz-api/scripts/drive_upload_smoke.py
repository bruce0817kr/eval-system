"""Run a live Google Drive upload smoke test.

Required environment:
- DATABASE_URL: any valid app database URL so settings can load.
- GOOGLE_DRIVE_ROOT_FOLDER_ID: Drive folder shared with the service account.
- GOOGLE_SERVICE_ACCOUNT_FILE: service account JSON file path.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.drive_service import DriveUploadError, upload_to_google_drive


def main() -> int:
    if not os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID") or not os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE"):
        print("SKIP: GOOGLE_DRIVE_ROOT_FOLDER_ID and GOOGLE_SERVICE_ACCOUNT_FILE are required.")
        return 2

    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    file_name = f"drive-smoke-{now}.txt"
    content = f"biz-support-hub Drive smoke {now}\n".encode("utf-8")

    try:
        result = upload_to_google_drive(
            support_case_id="drive-smoke",
            file_type="SMOKE",
            file_name=file_name,
            content=content,
        )
    except DriveUploadError as exc:
        print(f"FAIL: {exc}")
        return 1

    print("OK: uploaded smoke file")
    print(f"drive_file_id={result.drive_file_id}")
    print(f"drive_web_link={result.drive_web_link}")
    print(f"folder_path={result.folder_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
