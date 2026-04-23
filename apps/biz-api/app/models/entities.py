import enum
import uuid
from datetime import UTC, datetime, date
from sqlalchemy import String, DateTime, Date, Boolean, Numeric, Integer, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class ParticipantType(str, enum.Enum):
    COMPANY = "COMPANY"
    PRE_STARTUP = "PRE_STARTUP"


class UserAccount(Base):
    __tablename__ = "user_accounts"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    login_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(30), default="OPERATOR")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)


class Participant(Base):
    __tablename__ = "participants"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    participant_type: Mapped[ParticipantType]
    biz_no: Mapped[str | None] = mapped_column(String(20))
    participant_name: Mapped[str] = mapped_column(String(255))
    normalized_name: Mapped[str | None] = mapped_column(String(255))
    ceo_name: Mapped[str | None] = mapped_column(String(100))
    region_code: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    industry_code: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)


class Program(Base):
    __tablename__ = "programs"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    year: Mapped[int]
    program_name: Mapped[str] = mapped_column(String(255))
    sub_program_name: Mapped[str | None] = mapped_column(String(255))
    managing_dept: Mapped[str | None] = mapped_column(String(255))
    funding_source: Mapped[str | None] = mapped_column(String(100))
    total_budget: Mapped[float | None] = mapped_column(Numeric(18, 2))
    status: Mapped[str] = mapped_column(String(30), default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    external_eval_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    participant_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("participants.id"))
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("programs.id"))
    total_score: Mapped[float | None] = mapped_column(Numeric(8, 2))
    ranking: Mapped[int | None] = mapped_column(Integer)
    selected_yn: Mapped[bool | None] = mapped_column(Boolean)
    reserve_yn: Mapped[bool | None] = mapped_column(Boolean)
    selected_date: Mapped[date | None] = mapped_column(Date)
    sync_status: Mapped[str] = mapped_column(String(30), default="PENDING")
    synced_at: Mapped[datetime | None] = mapped_column(DateTime)


class SupportCase(Base):
    __tablename__ = "support_cases"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    participant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("participants.id"))
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("programs.id"))
    evaluation_result_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("evaluation_results.id"))
    selection_result: Mapped[str] = mapped_column(String(30), default="APPLIED")
    agreement_status: Mapped[str] = mapped_column(String(30), default="NOT_STARTED")
    execution_status: Mapped[str] = mapped_column(String(30), default="NOT_PAID")
    settlement_status: Mapped[str] = mapped_column(String(30), default="NOT_SUBMITTED")
    completion_status: Mapped[str] = mapped_column(String(30), default="NOT_COMPLETED")
    support_amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    self_fund_amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)


class SupportCaseStatusHistory(Base):
    __tablename__ = "support_case_status_histories"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    support_case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("support_cases.id"))
    status_category: Mapped[str] = mapped_column(String(50))
    old_value: Mapped[str | None] = mapped_column(String(50))
    new_value: Mapped[str | None] = mapped_column(String(50))
    changed_by: Mapped[str | None] = mapped_column(String(100))
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class Attachment(Base):
    __tablename__ = "attachments"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    support_case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("support_cases.id"))
    file_type: Mapped[str] = mapped_column(String(50))
    original_file_name: Mapped[str] = mapped_column(String(255))
    drive_file_id: Mapped[str] = mapped_column(String(255))
    drive_web_link: Mapped[str | None] = mapped_column(Text)
    folder_path: Mapped[str | None] = mapped_column(Text)
    version_no: Mapped[int] = mapped_column(Integer, default=1)
    is_latest: Mapped[bool] = mapped_column(Boolean, default=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class StagingSupportRaw(Base):
    __tablename__ = "staging_support_raw"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_file_name: Mapped[str] = mapped_column(String(255))
    source_sheet_name: Mapped[str | None] = mapped_column(String(255))
    row_no: Mapped[int | None] = mapped_column(Integer)
    participant_name_raw: Mapped[str | None] = mapped_column(Text)
    biz_no_raw: Mapped[str | None] = mapped_column(Text)
    program_name_raw: Mapped[str | None] = mapped_column(Text)
    sub_program_name_raw: Mapped[str | None] = mapped_column(Text)
    support_amount_raw: Mapped[str | None] = mapped_column(Text)
    raw_payload_json: Mapped[dict | None] = mapped_column(JSON)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
