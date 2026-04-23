from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.crud.crud_participant import create_participant, list_participants
from app.schemas.participant import ParticipantCreate, ParticipantRead

router = APIRouter()


@router.get('', response_model=list[ParticipantRead])
def get_participants(db: Session = Depends(get_db)):
    return list_participants(db)


@router.post('', response_model=ParticipantRead)
def post_participant(payload: ParticipantCreate, db: Session = Depends(get_db)):
    return create_participant(db, payload)
