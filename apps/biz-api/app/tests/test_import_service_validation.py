import pytest

from app.services.import_service import ImportValidationError, validate_import_payload


def test_should_raise_when_rows_key_missing():
    with pytest.raises(ImportValidationError):
        validate_import_payload({})


def test_should_raise_when_rows_is_not_list():
    with pytest.raises(ImportValidationError):
        validate_import_payload({"rows": {"participant_name_raw": "기업A"}})


def test_should_raise_when_row_item_is_not_object():
    with pytest.raises(ImportValidationError):
        validate_import_payload({"rows": ["invalid"]})


def test_should_return_rows_when_payload_is_valid():
    payload = {
        "rows": [
            {
                "participant_name_raw": "기업A",
                "program_name_raw": "수출지원",
                "year": 2026,
            }
        ]
    }

    rows = validate_import_payload(payload)

    assert len(rows) == 1
    assert rows[0]["participant_name_raw"] == "기업A"
