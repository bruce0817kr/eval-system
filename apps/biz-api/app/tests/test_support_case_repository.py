from app.services.support_case_repository import InMemorySupportCaseRepository


def test_should_generate_non_conflicting_case_id_when_seed_exists():
    repo = InMemorySupportCaseRepository(
        seed_cases={
            "case-1": {"id": "case-1", "participant_id": "p1", "program_id": "pg1"},
            "case-2": {"id": "case-2", "participant_id": "p2", "program_id": "pg2"},
        }
    )

    created = repo.create({"participant_id": "p3", "program_id": "pg3"})

    assert created["id"] == "case-3"
    assert repo.get("case-3") is not None
