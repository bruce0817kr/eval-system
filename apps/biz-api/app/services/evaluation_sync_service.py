from sqlalchemy.orm import Session
from app.models.entities import EvaluationResult, SupportCase


def sync_selected_to_support_case(db: Session, evaluation: EvaluationResult) -> SupportCase | None:
    if not evaluation.selected_yn:
        return None

    existing = db.query(SupportCase).filter(SupportCase.evaluation_result_id == evaluation.id).one_or_none()
    if existing:
        evaluation.sync_status = "SYNCED"
        return existing

    support_case = SupportCase(
        participant_id=evaluation.participant_id,
        program_id=evaluation.program_id,
        evaluation_result_id=evaluation.id,
        selection_result="SELECTED",
    )
    db.add(support_case)
    evaluation.sync_status = "SYNCED"
    db.commit()
    db.refresh(support_case)
    return support_case
