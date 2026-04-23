from sqlalchemy.orm import Session
from app.models.entities import Participant
from app.schemas.participant import ParticipantCreate


def create_participant(db: Session, payload: ParticipantCreate) -> Participant:
    item = Participant(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_participants(db: Session) -> list[Participant]:
    return db.query(Participant).order_by(Participant.created_at.desc()).all()
