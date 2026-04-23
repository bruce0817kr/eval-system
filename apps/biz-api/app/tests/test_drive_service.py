import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.services import drive_service


class FakeExecute:
    def __init__(self, payload):
        self.payload = payload

    def execute(self):
        return self.payload


class FakeFiles:
    def __init__(self):
        self.created_bodies = []
        self.created_media = []

    def list(self, **kwargs):
        return FakeExecute({"files": []})

    def create(self, *, body, fields, media_body=None, **kwargs):
        self.created_bodies.append((body, fields))
        self.created_media.append(media_body)
        if body.get("mimeType") == drive_service.GOOGLE_DRIVE_FOLDER_MIME_TYPE:
            return FakeExecute({"id": f"folder-{len(self.created_bodies)}"})
        return FakeExecute({"id": "drive-file-1", "webViewLink": "https://drive.example/file/1"})


class FakeDrive:
    def __init__(self):
        self.files_resource = FakeFiles()

    def files(self):
        return self.files_resource


def test_upload_to_google_drive_creates_case_folders_and_uploads_bytes(monkeypatch):
    fake_drive = FakeDrive()

    monkeypatch.setattr(drive_service.settings, "google_drive_root_folder_id", "root-folder")
    monkeypatch.setattr(drive_service.settings, "google_service_account_file", "service-account.json")
    monkeypatch.setattr(drive_service.service_account.Credentials, "from_service_account_file", lambda *args, **kwargs: "creds")
    monkeypatch.setattr(drive_service, "build", lambda *args, **kwargs: fake_drive)

    result = drive_service.upload_to_google_drive(
        support_case_id="case-1",
        file_type="AGREEMENT",
        file_name="agreement.pdf",
        content=b"pdf-bytes",
    )

    assert result.drive_file_id == "drive-file-1"
    assert result.drive_web_link == "https://drive.example/file/1"
    assert result.folder_path == "support_cases/case-1/AGREEMENT"

    created_bodies = [body for body, _fields in fake_drive.files_resource.created_bodies]
    assert created_bodies[0] == {
        "name": "support_cases",
        "mimeType": drive_service.GOOGLE_DRIVE_FOLDER_MIME_TYPE,
        "parents": ["root-folder"],
    }
    assert created_bodies[1]["name"] == "case-1"
    assert created_bodies[1]["parents"] == ["folder-1"]
    assert created_bodies[2]["name"] == "AGREEMENT"
    assert created_bodies[2]["parents"] == ["folder-2"]
    assert created_bodies[3]["name"] == "agreement.pdf"
    assert created_bodies[3]["parents"] == ["folder-3"]
    assert fake_drive.files_resource.created_media[-1] is not None
