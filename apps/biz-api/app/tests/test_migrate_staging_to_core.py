from scripts.migrate_staging_to_core import migrate_staging_rows


def test_should_build_participant_program_and_support_case_from_valid_row():
    rows = [
        {
            "participant_name_raw": "기업A",
            "biz_no_raw": "123-45-67890",
            "ceo_name_raw": "홍길동",
            "program_name_raw": "수출지원",
            "sub_program_name_raw": "초보기업",
            "support_amount_raw": "1,000,000",
            "year": 2026,
        }
    ]

    result = migrate_staging_rows(rows)

    assert len(result.participants) == 1
    assert result.participants[0]["biz_no"] == "1234567890"
    assert len(result.programs) == 1
    assert result.programs[0]["program_name"] == "수출지원"
    assert len(result.support_cases) == 1
    assert result.support_cases[0]["support_amount"] == 1000000.0
    assert result.errors == []


def test_should_deduplicate_participants_by_business_number():
    rows = [
        {
            "participant_name_raw": "기업A",
            "biz_no_raw": "123-45-67890",
            "ceo_name_raw": "홍길동",
            "program_name_raw": "수출지원",
            "sub_program_name_raw": "초보기업",
            "year": 2026,
        },
        {
            "participant_name_raw": "기업A 주식회사",
            "biz_no_raw": "1234567890",
            "ceo_name_raw": "홍길동",
            "program_name_raw": "R&D",
            "sub_program_name_raw": "고도화",
            "year": 2026,
        },
    ]

    result = migrate_staging_rows(rows)

    assert len(result.participants) == 1
    assert len(result.support_cases) == 2


def test_should_mark_error_when_required_fields_are_missing():
    rows = [
        {
            "participant_name_raw": "",
            "biz_no_raw": None,
            "program_name_raw": "",
            "sub_program_name_raw": "초보기업",
            "year": 2026,
        }
    ]

    result = migrate_staging_rows(rows)

    assert len(result.errors) == 1
    assert result.errors[0]["reason"] == "MISSING_REQUIRED_FIELDS"
    assert result.support_cases == []


def test_should_classify_participant_as_pre_startup_without_business_number():
    rows = [
        {
            "participant_name_raw": "예비창업자A",
            "biz_no_raw": "",
            "ceo_name_raw": "김예비",
            "program_name_raw": "창업지원",
            "sub_program_name_raw": "예비트랙",
            "year": 2026,
        }
    ]

    result = migrate_staging_rows(rows)

    assert result.participants[0]["participant_type"] == "PRE_STARTUP"
