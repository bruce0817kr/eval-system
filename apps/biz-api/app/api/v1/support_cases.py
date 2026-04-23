from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings

from app.schemas.support_case import (
    SupportCaseCreateRequest,
    SupportCaseHistoryListResponse,
    SupportCaseListResponse,
    SupportCaseMutationResponse,
    SupportCaseUpdateRequest,
)
from app.services.support_case_api_service import (
    handle_create_support_case,
    handle_list_support_case_histories,
    handle_list_support_cases,
    handle_support_case_update,
)
from app.services.support_case_repository import StatusHistoryRepository, SupportCaseRepository
from app.services.support_case_repository_factory import create_repositories

router = APIRouter()
RepositoryPair = tuple[SupportCaseRepository, StatusHistoryRepository]

memory_case_repo, memory_history_repo = create_repositories(mode="inmemory")


def get_support_case_repositories(
    db: Annotated[Session, Depends(get_db)],
) -> RepositoryPair:
    if settings.support_case_repository_mode == "db":
        return create_repositories(mode="db", session=db)
    return memory_case_repo, memory_history_repo


@router.get('', response_model=SupportCaseListResponse)
def get_support_cases(
    repositories: Annotated[RepositoryPair, Depends(get_support_case_repositories)],
    agreement_status: str | None = None,
    participant_id: str | None = None,
) -> SupportCaseListResponse:
    case_repo, _ = repositories
    query = {
        "agreement_status": agreement_status,
        "participant_id": participant_id,
    }
    return handle_list_support_cases(case_repo, query)


@router.get('/{case_id}/histories', response_model=SupportCaseHistoryListResponse)
def get_support_case_histories(
    case_id: str,
    repositories: Annotated[RepositoryPair, Depends(get_support_case_repositories)],
) -> dict:
    _, history_repo = repositories
    return handle_list_support_case_histories(history_repo, case_id)


@router.post('', response_model=SupportCaseMutationResponse)
def create_support_case(
    payload: SupportCaseCreateRequest,
    repositories: Annotated[RepositoryPair, Depends(get_support_case_repositories)],
) -> dict:
    case_repo, _ = repositories
    return handle_create_support_case(case_repo, payload.model_dump(exclude_none=True))


@router.put('/{case_id}', response_model=SupportCaseMutationResponse)
def update_support_case(
    case_id: str,
    payload: SupportCaseUpdateRequest,
    repositories: Annotated[RepositoryPair, Depends(get_support_case_repositories)],
) -> dict:
    case_repo, history_repo = repositories
    return handle_support_case_update(case_repo, history_repo, case_id, payload.model_dump(exclude_none=True))
