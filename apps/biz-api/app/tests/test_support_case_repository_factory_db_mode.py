import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.services.support_case_repository_db import DBStatusHistoryRepository, DBSupportCaseRepository
from app.services.support_case_repository_factory import create_repositories, list_supported_repository_modes


def test_should_include_inmemory_and_db_modes_in_supported_list():
    modes = list_supported_repository_modes()

    assert "inmemory" in modes
    assert "db" in modes


def test_should_create_db_repository_adapters_for_db_mode():
    case_repo, history_repo = create_repositories(mode="db")

    assert isinstance(case_repo, DBSupportCaseRepository)
    assert isinstance(history_repo, DBStatusHistoryRepository)


def test_should_pass_session_to_db_repository_adapters():
    session = object()

    case_repo, history_repo = create_repositories(mode="db", session=session)

    assert case_repo.session is session
    assert history_repo.session is session
