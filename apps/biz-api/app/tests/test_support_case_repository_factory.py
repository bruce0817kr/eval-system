import pytest

from app.services.support_case_repository import InMemoryStatusHistoryRepository, InMemorySupportCaseRepository
from app.services.support_case_repository_factory import create_repositories


def test_should_create_inmemory_repositories_for_inmemory_mode():
    case_repo, history_repo = create_repositories(mode="inmemory")

    assert isinstance(case_repo, InMemorySupportCaseRepository)
    assert isinstance(history_repo, InMemoryStatusHistoryRepository)


def test_should_raise_for_unknown_repository_mode():
    with pytest.raises(ValueError):
        create_repositories(mode="unknown")
