import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.entities import Attachment, SupportCase
from app.schemas.attachment import AttachmentRead, AttachmentUploadResponse
from app.services.drive_service import DriveUploader, DriveUploadError, upload_to_google_drive

router = APIRouter()


def get_drive_uploader() -> DriveUploader:
    return upload_to_google_drive


def _attachment_to_read(item: Attachment) -> AttachmentRead:
    return AttachmentRead(
        id=str(item.id),
        support_case_id=str(item.support_case_id),
        file_type=item.file_type,
        original_file_name=item.original_file_name,
        drive_file_id=item.drive_file_id,
        drive_web_link=item.drive_web_link,
        folder_path=item.folder_path,
        version_no=item.version_no,
        is_latest=item.is_latest,
    )


@router.post('/upload', response_model=AttachmentUploadResponse)
async def upload_attachment(
    support_case_id: Annotated[str, Form()],
    file_type: Annotated[str, Form()],
    file: UploadFile,
    db: Annotated[Session, Depends(get_db)],
    drive_uploader: Annotated[DriveUploader, Depends(get_drive_uploader)],
) -> AttachmentUploadResponse:
    support_case = db.get(SupportCase, uuid.UUID(support_case_id))
    if support_case is None:
        return AttachmentUploadResponse(status="failed", message="지원건을 찾을 수 없습니다.")

    try:
        upload_result = drive_uploader(
            support_case_id=support_case_id,
            file_type=file_type,
            file_name=file.filename or "uploaded-file",
            content=await file.read(),
        )
    except DriveUploadError as exc:
        return AttachmentUploadResponse(status="failed", message=str(exc))

    attachment = Attachment(
        support_case_id=support_case.id,
        file_type=file_type,
        original_file_name=file.filename or "uploaded-file",
        drive_file_id=upload_result.drive_file_id,
        drive_web_link=upload_result.drive_web_link,
        folder_path=upload_result.folder_path,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return AttachmentUploadResponse(status="completed", attachment=_attachment_to_read(attachment))
