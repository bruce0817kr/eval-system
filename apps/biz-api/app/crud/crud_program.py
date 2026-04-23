from sqlalchemy.orm import Session
from app.models.entities import Program
from app.schemas.program import ProgramCreate


def create_program(db: Session, payload: ProgramCreate) -> Program:
    item = Program(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_programs(db: Session) -> list[Program]:
    return db.query(Program).order_by(Program.created_at.desc()).all()
