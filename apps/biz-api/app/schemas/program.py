import uuid
from pydantic import BaseModel, ConfigDict


class ProgramCreate(BaseModel):
    year: int
    program_name: str
    sub_program_name: str | None = None


class ProgramRead(ProgramCreate):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
