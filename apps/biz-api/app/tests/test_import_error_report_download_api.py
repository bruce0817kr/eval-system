import os
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.main import app


client = TestClient(app)


def auth_headers() -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "admin"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_error_report_download_should_return_csv_contents(tmp_path: Path):
    report_dir = Path("reports")
    report_dir.mkdir(exist_ok=True)
    report_path = report_dir / "download-test.csv"
    report_path.write_text("row_no,reason\n2,MISSING_REQUIRED_FIELDS\n", encoding="utf-8")

    response = client.get(
        "/api/v1/imports/error-report",
        headers=auth_headers(),
        params={"path": str(report_path)},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "MISSING_REQUIRED_FIELDS" in response.text

    report_path.unlink(missing_ok=True)


def test_error_report_download_should_reject_path_outside_reports():
    response = client.get(
        "/api/v1/imports/error-report",
        headers=auth_headers(),
        params={"path": "../secret.txt"},
    )

    assert response.status_code == 400
