"""Google Drive metadata-first service.

This service intentionally stores only Drive IDs and links in DB, not binary file bytes.
"""

import io
import mimetypes
from dataclasses import dataclass
from typing import Protocol

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseUpload

from app.core.config import settings

GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"


@dataclass
class DriveUploadResult:
    drive_file_id: str
    drive_web_link: str
    folder_path: str


class DriveUploader(Protocol):
    def __call__(self, *, support_case_id: str, file_type: str, file_name: str, content: bytes) -> DriveUploadResult: ...


class DriveUploadError(RuntimeError):
    pass


def build_case_folder_path(year: int, program_id: str, support_case_id: str, participant_name: str) -> str:
    safe_name = participant_name.replace("/", "_").strip()
    return f"기업지원사업/{year}/program_{program_id}/case_{support_case_id}_{safe_name}"


def _drive_client():
    credentials = service_account.Credentials.from_service_account_file(
        settings.google_service_account_file,
        scopes=[GOOGLE_DRIVE_FILE_SCOPE],
    )
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def _escape_drive_query_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def _find_folder_id(drive, *, parent_id: str, name: str) -> str | None:
    escaped_name = _escape_drive_query_value(name)
    escaped_parent_id = _escape_drive_query_value(parent_id)
    response = (
        drive.files()
        .list(
            q=(
                f"'{escaped_parent_id}' in parents and "
                f"name = '{escaped_name}' and "
                f"mimeType = '{GOOGLE_DRIVE_FOLDER_MIME_TYPE}' and "
                "trashed = false"
            ),
            spaces="drive",
            fields="files(id, name)",
            pageSize=1,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        )
        .execute()
    )
    files = response.get("files", [])
    if not files:
        return None
    return files[0]["id"]


def _create_folder(drive, *, parent_id: str, name: str) -> str:
    response = (
        drive.files()
        .create(
            body={
                "name": name,
                "mimeType": GOOGLE_DRIVE_FOLDER_MIME_TYPE,
                "parents": [parent_id],
            },
            fields="id",
            supportsAllDrives=True,
        )
        .execute()
    )
    return response["id"]


def _ensure_folder(drive, *, parent_id: str, name: str) -> str:
    existing_id = _find_folder_id(drive, parent_id=parent_id, name=name)
    if existing_id:
        return existing_id
    return _create_folder(drive, parent_id=parent_id, name=name)


def upload_to_google_drive(*, support_case_id: str, file_type: str, file_name: str, content: bytes) -> DriveUploadResult:
    if not settings.google_drive_root_folder_id or not settings.google_service_account_file:
        raise DriveUploadError("Google Drive configuration is required.")

    folder_path_parts = ["support_cases", support_case_id, file_type]
    try:
        drive = _drive_client()
        parent_id = settings.google_drive_root_folder_id
        for folder_name in folder_path_parts:
            parent_id = _ensure_folder(drive, parent_id=parent_id, name=folder_name)

        media = MediaIoBaseUpload(
            io.BytesIO(content),
            mimetype=mimetypes.guess_type(file_name)[0] or "application/octet-stream",
            resumable=True,
        )
        response = (
            drive.files()
            .create(
                body={"name": file_name, "parents": [parent_id]},
                media_body=media,
                fields="id, webViewLink",
                supportsAllDrives=True,
            )
            .execute()
        )
    except (HttpError, OSError, ValueError, KeyError) as exc:
        raise DriveUploadError(f"Google Drive upload failed: {exc}") from exc

    drive_file_id = response.get("id")
    if not drive_file_id:
        raise DriveUploadError("Google Drive upload failed: missing file id")

    return DriveUploadResult(
        drive_file_id=drive_file_id,
        drive_web_link=response.get("webViewLink") or "",
        folder_path="/".join(folder_path_parts),
    )
