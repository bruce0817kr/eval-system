from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.entities import StagingSupportRaw
from app.schemas.imports import (
    ExcelToStagingResponse,
    ImportStagingToCoreRequest,
    ImportStagingToCoreResponse,
    dump_import_rows,
)
from app.services.import_service import (
    ImportReportPathError,
    ImportValidationError,
    process_staging_batch,
    resolve_error_report_path,
    validate_import_payload,
)
from app.services.import_excel_service import parse_excel_to_staging_rows

router = APIRouter()
REPORTS_DIR = Path('reports')


@router.post('/excel-to-staging', response_model=ExcelToStagingResponse)
async def excel_to_staging(file: UploadFile, db: Annotated[Session, Depends(get_db)]) -> ExcelToStagingResponse:
    try:
        rows = parse_excel_to_staging_rows(await file.read())
    except Exception as exc:
        return ExcelToStagingResponse(status='failed', filename=file.filename, message=str(exc))

    for row in rows:
        db.add(
            StagingSupportRaw(
                source_file_name=file.filename or "uploaded.xlsx",
                source_sheet_name=row.get("_source_sheet_name"),
                row_no=row.get("_row_no"),
                participant_name_raw=row.get("participant_name_raw"),
                biz_no_raw=row.get("biz_no_raw"),
                program_name_raw=row.get("program_name_raw"),
                sub_program_name_raw=row.get("sub_program_name_raw"),
                support_amount_raw=str(row["support_amount_raw"]) if row.get("support_amount_raw") is not None else None,
                raw_payload_json={key: value for key, value in row.items() if not key.startswith("_")},
            )
        )
    db.commit()

    return ExcelToStagingResponse(
        status='completed',
        filename=file.filename,
        rows_count=len(rows),
        rows=[{key: value for key, value in row.items() if not key.startswith("_")} for row in rows],
    )


@router.post('/staging-to-core', response_model=ImportStagingToCoreResponse)
def staging_to_core(payload: ImportStagingToCoreRequest, db: Annotated[Session, Depends(get_db)]) -> ImportStagingToCoreResponse:
    try:
        if payload.rows is not None:
            rows = validate_import_payload({"rows": dump_import_rows(payload.rows)})
        elif payload.source_file_name:
            source_rows = (
                db.query(StagingSupportRaw)
                .filter(StagingSupportRaw.source_file_name == payload.source_file_name)
                .order_by(StagingSupportRaw.row_no.asc())
                .all()
            )
            rows = validate_import_payload(
                {
                    "rows": [
                        (row.raw_payload_json or {})
                        for row in source_rows
                    ]
                }
            )
        else:
            raise ImportValidationError("'rows' 또는 'source_file_name' 중 하나는 필수입니다.")
    except ImportValidationError as exc:
        return ImportStagingToCoreResponse(status='failed', message=str(exc))

    summary = process_staging_batch(rows, report_dir=Path('reports'))
    return ImportStagingToCoreResponse(status='completed', summary=summary)


@router.get('/error-report')
def download_error_report(path: Annotated[str, Query(min_length=1)]) -> FileResponse:
    try:
        report_path = resolve_error_report_path(path, REPORTS_DIR)
    except ImportReportPathError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return FileResponse(path=report_path, media_type='text/csv', filename=report_path.name)
