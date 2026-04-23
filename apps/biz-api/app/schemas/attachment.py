from typing import Literal

from pydantic import BaseModel


class AttachmentRead(BaseModel):
    id: str
    support_case_id: str
    file_type: str
    original_file_name: str
    drive_file_id: str
    drive_web_link: str | None = None
    folder_path: str | None = None
    version_no: int
    is_latest: bool


class AttachmentUploadResponse(BaseModel):
    status: Literal["completed", "failed"]
    attachment: AttachmentRead | None = None
    message: str | None = None
