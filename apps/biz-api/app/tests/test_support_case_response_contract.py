from app.services.support_case_api_service import build_response


def test_should_build_standard_response_with_data_and_message():
    payload = {"support_case": {"id": "case-1"}}

    result = build_response(status="updated", data=payload, message="ok")

    assert result["status"] == "updated"
    assert result["message"] == "ok"
    assert result["data"] == payload
    assert result["support_case"]["id"] == "case-1"
