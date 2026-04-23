import uuid
from pydantic import BaseModel, ConfigDict


class ParticipantBase(BaseModel):
    participant_type: str
    participant_name: str
    biz_no: str | None = None


class ParticipantCreate(ParticipantBase):
    pass


class ParticipantRead(ParticipantBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
