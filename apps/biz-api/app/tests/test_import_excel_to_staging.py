from scripts.import_excel_to_staging import is_skippable_row, filter_valid_rows, normalize_row


def test_should_skip_row_when_contains_total_keyword():
    row = ["합계", "1000"]
    assert is_skippable_row(row) is True


def test_should_skip_row_when_all_values_blank_or_nan():
    row = [None, float('nan'), '   ']
    assert is_skippable_row(row) is True


def test_should_keep_normal_data_row():
    row = ["기업A", "123-45-67890", "1,000,000"]
    assert is_skippable_row(row) is False


def test_should_filter_out_header_like_rows_and_totals():
    rows = [
        ["기업명", "사업자등록번호", "지원금"],
        ["기업A", "123-45-67890", "1,000"],
        ["총계", "", "1,000"],
    ]

    valid = filter_valid_rows(rows)

    assert len(valid) == 1
    assert valid[0][0] == "기업A"


def test_should_normalize_row_values_for_staging_payload():
    row = {
        "participant_name": "  기업A  ",
        "biz_no": "123-45-67890",
        "support_amount": "1,200,000",
    }

    normalized = normalize_row(row)

    assert normalized["participant_name"] == "기업A"
    assert normalized["biz_no"] == "1234567890"
    assert normalized["support_amount"] == 1200000.0
