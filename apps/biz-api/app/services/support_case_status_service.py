from __future__ import annotations

from datetime import datetime, UTC
from typing import Any

TRACKED_STATUS_FIELDS = (
    "agreement_status",
    "execution_status",
    "settlement_status",
    "completion_status",
)


def build_status_histories(
    old_case: dict[str, Any],
    new_case: dict[str, Any],
    changed_by: str | None,
) -> list[dict[str, Any]]:
    histories: list[dict[str, Any]] = []
    changed_at = datetime.now(UTC).isoformat()

    for field in TRACKED_STATUS_FIELDS:
        old_value = old_case.get(field)
        new_value = new_case.get(field)
        if old_value == new_value:
            continue

        histories.append(
            {
                "status_category": field,
                "old_value": old_value,
                "new_value": new_value,
                "changed_by": changed_by,
                "changed_at": changed_at,
            }
        )

    return histories
