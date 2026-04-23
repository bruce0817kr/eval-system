from __future__ import annotations

from typing import Any

from app.services.support_case_repository import InMemoryStatusHistoryRepository, InMemorySupportCaseRepository
from app.services.support_case_repository_db import DBStatusHistoryRepository, DBSupportCaseRepository


def list_supported_repository_modes() -> list[str]:
    return ["inmemory", "db"]


def create_repositories(mode: str = "inmemory", session: Any | None = None):
    if mode == "inmemory":
        return (
            InMemorySupportCaseRepository(
                seed_cases={
                    "case-1": {
                        "id": "case-1",
                        "participant_id": "p-1",
                        "program_id": "pg-1",
                        "agreement_status": "NOT_STARTED",
                        "execution_status": "NOT_PAID",
                        "settlement_status": "NOT_SUBMITTED",
                        "completion_status": "NOT_COMPLETED",
                        "remarks": "sample",
                    }
                }
            ),
            InMemoryStatusHistoryRepository(),
        )

    if mode == "db":
        return (DBSupportCaseRepository(session=session), DBStatusHistoryRepository(session=session))

    raise ValueError(f"Unsupported support-case repository mode: {mode}")
