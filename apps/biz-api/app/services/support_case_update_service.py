from __future__ import annotations

from typing import Any

from app.services.support_case_status_service import build_status_histories


def apply_support_case_update(
    current_case: dict[str, Any],
    patch: dict[str, Any],
    changed_by: str | None,
) -> dict[str, Any]:
    updated_case = dict(current_case)
    updated_case.update(patch)

    histories = build_status_histories(current_case, updated_case, changed_by=changed_by)

    return {
        "support_case": updated_case,
        "status_histories": histories,
    }
