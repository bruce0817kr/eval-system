import os

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.main import app


client = TestClient(app)


def auth_headers() -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "admin"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_auth_contracts_are_named_in_openapi():
    schema = client.get("/openapi.json").json()

    schemas = schema["components"]["schemas"]

    assert "TokenResponse" in schemas
    assert "CurrentUserResponse" in schemas
    assert (
        schema["paths"]["/api/v1/auth/login"]["post"]["responses"]["200"]["content"]["application/json"]["schema"][
            "$ref"
        ]
        == "#/components/schemas/TokenResponse"
    )
    assert (
        schema["paths"]["/api/v1/auth/me"]["get"]["responses"]["200"]["content"]["application/json"]["schema"][
            "$ref"
        ]
        == "#/components/schemas/CurrentUserResponse"
    )


def test_support_case_create_contract_rejects_missing_required_fields():
    response = client.post("/api/v1/support-cases", json={"remarks": "missing ids"}, headers=auth_headers())

    assert response.status_code == 422


def test_support_case_contracts_are_named_in_openapi():
    schema = client.get("/openapi.json").json()

    schemas = schema["components"]["schemas"]
    create_request = schema["paths"]["/api/v1/support-cases"]["post"]["requestBody"]["content"][
        "application/json"
    ]["schema"]

    assert "SupportCaseCreateRequest" in schemas
    assert "SupportCaseUpdateRequest" in schemas
    assert "SupportCaseListResponse" in schemas
    assert "SupportCaseMutationResponse" in schemas
    assert "SupportCaseHistoryListResponse" in schemas
    assert create_request["$ref"] == "#/components/schemas/SupportCaseCreateRequest"


def test_import_contract_rejects_rows_that_are_not_a_list():
    response = client.post(
        "/api/v1/imports/staging-to-core",
        json={"rows": {"participant_name_raw": "기업A"}},
        headers=auth_headers(),
    )

    assert response.status_code == 422


def test_import_contracts_are_named_in_openapi():
    schema = client.get("/openapi.json").json()

    schemas = schema["components"]["schemas"]
    request_schema = schema["paths"]["/api/v1/imports/staging-to-core"]["post"]["requestBody"]["content"][
        "application/json"
    ]["schema"]
    response_schema = schema["paths"]["/api/v1/imports/staging-to-core"]["post"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"]

    assert "ImportStagingToCoreRequest" in schemas
    assert "ImportStagingToCoreResponse" in schemas
    assert request_schema["$ref"] == "#/components/schemas/ImportStagingToCoreRequest"
    assert response_schema["$ref"] == "#/components/schemas/ImportStagingToCoreResponse"
