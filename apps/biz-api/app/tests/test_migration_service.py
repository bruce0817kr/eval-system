from app.services.migration_service import normalize_biz_no, clean_text, parse_amount


def test_normalize_biz_no_removes_non_digits():
    assert normalize_biz_no('123-45-67890') == '1234567890'


def test_clean_text_returns_none_for_blank():
    assert clean_text('   ') is None


def test_parse_amount_removes_commas_and_currency_symbols():
    assert parse_amount('₩1,234,567') == 1234567.0
