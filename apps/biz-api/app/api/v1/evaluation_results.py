from typing import Annotated

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.entities import EvaluationResult, SupportCase
from app.schemas.evaluation import EvaluationUploadResponse
from app.services.evaluation_sync_service import sync_selected_to_support_case
from app.services.evaluation_upload_service import parse_evaluation_csv, parse_evaluation_rows

router = APIRouter()


@router.post('/upload-csv', response_model=EvaluationUploadResponse)
async def upload_csv(file: UploadFile, db: Annotated[Session, Depends(get_db)]) -> EvaluationUploadResponse:
    try:
        content = await file.read()
        summary = parse_evaluation_csv(content)
        rows = parse_evaluation_rows(content)
    except Exception as exc:
        return EvaluationUploadResponse(status="failed", filename=file.filename, message=str(exc))

    synced_count = 0
    for row in rows:
        external_eval_id = row.get("external_eval_id")
        evaluation = None
        if external_eval_id:
            evaluation = db.query(EvaluationResult).filter(EvaluationResult.external_eval_id == external_eval_id).one_or_none()

        if evaluation is None:
            evaluation = EvaluationResult(**row)
            db.add(evaluation)
        else:
            for key, value in row.items():
                setattr(evaluation, key, value)

        db.flush()
        had_support_case = (
            evaluation.id is not None
            and db.query(SupportCase).filter(SupportCase.evaluation_result_id == evaluation.id).one_or_none() is not None
        )
        if sync_selected_to_support_case(db, evaluation) is not None:
            if not had_support_case:
                synced_count += 1

    db.commit()

    return EvaluationUploadResponse(
        status="completed",
        filename=file.filename,
        rows_count=summary["rows_count"],
        selected_count=summary["selected_count"],
        synced_support_cases_count=synced_count,
        sync_status="SYNCED" if synced_count == summary["selected_count"] else "PENDING",
    )
