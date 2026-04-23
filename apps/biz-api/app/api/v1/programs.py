from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.crud.crud_program import create_program, list_programs
from app.schemas.program import ProgramCreate, ProgramRead

router = APIRouter()


@router.get('', response_model=list[ProgramRead])
def get_programs(db: Session = Depends(get_db)):
    return list_programs(db)


@router.post('', response_model=ProgramRead)
def post_program(payload: ProgramCreate, db: Session = Depends(get_db)):
    return create_program(db, payload)
