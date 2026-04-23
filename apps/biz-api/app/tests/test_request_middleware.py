import os

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.main import app


client = TestClient(app)
error_client = TestClient(app, raise_server_exceptions=False)


@app.get("/__test-unhandled-error")
def raise_unhandled_error():
    raise RuntimeError("boom")


def test_request_id_header_should_be_returned():
    response = client.get("/health", headers={"X-Request-ID": "req-test-1"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "req-test-1"


def test_unhandled_exception_should_return_json_with_request_id():
    response = error_client.get("/__test-unhandled-error", headers={"X-Request-ID": "err-test-1"})

    assert response.status_code == 500
    assert response.headers["X-Request-ID"] == "err-test-1"
    assert response.json() == {
        "status": "error",
        "message": "Internal server error",
        "request_id": "err-test-1",
    }
