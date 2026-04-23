from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.services.support_case_update_service import apply_support_case_update


HistoryPersister = Callable[[dict[str, Any]], None]


def update_support_case_and_collect_histories(
    current_case: dict[str, Any],
    patch: dict[str, Any],
    changed_by: str | None,
    persist_history: HistoryPersister,
) -> dict[str, Any]:
    result = apply_support_case_update(current_case, patch, changed_by)

    for history in result["status_histories"]:
        persist_history(history)

    return result
