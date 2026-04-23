from __future__ import annotations

from dataclasses import dataclass, field
from itertools import count
from typing import Any, Protocol


class SupportCaseRepository(Protocol):
    def get(self, case_id: str) -> dict[str, Any] | None: ...

    def save(self, case_id: str, support_case: dict[str, Any]) -> dict[str, Any]: ...

    def create(self, support_case: dict[str, Any]) -> dict[str, Any]: ...

    def list(self) -> list[dict[str, Any]]: ...


class StatusHistoryRepository(Protocol):
    def add(self, item: dict[str, Any]) -> None: ...

    def list_by_case_id(self, case_id: str) -> list[dict[str, Any]]: ...


@dataclass
class InMemorySupportCaseRepository:
    seed_cases: dict[str, dict[str, Any]] = field(default_factory=dict)
    _seq: count = field(init=False)

    def __post_init__(self) -> None:
        max_id = 0
        for case_id in self.seed_cases.keys():
            if case_id.startswith("case-"):
                suffix = case_id.replace("case-", "", 1)
                if suffix.isdigit():
                    max_id = max(max_id, int(suffix))
        self._seq = count(max_id + 1)

    def get(self, case_id: str) -> dict[str, Any] | None:
        item = self.seed_cases.get(case_id)
        return dict(item) if item else None

    def save(self, case_id: str, support_case: dict[str, Any]) -> dict[str, Any]:
        self.seed_cases[case_id] = dict(support_case)
        return self.seed_cases[case_id]

    def create(self, support_case: dict[str, Any]) -> dict[str, Any]:
        case_id = f"case-{next(self._seq)}"
        payload = {"id": case_id, **support_case}
        self.seed_cases[case_id] = payload
        return dict(payload)

    def list(self) -> list[dict[str, Any]]:
        return [dict(item) for item in self.seed_cases.values()]


@dataclass
class InMemoryStatusHistoryRepository:
    items: list[dict[str, Any]] = field(default_factory=list)

    def add(self, item: dict[str, Any]) -> None:
        self.items.append(dict(item))

    def list_by_case_id(self, case_id: str) -> list[dict[str, Any]]:
        return [dict(item) for item in self.items if item.get("case_id") == case_id]
