from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "biz-support-hub"
    api_prefix: str = "/api/v1"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60
    database_url: str
    support_case_repository_mode: str = "inmemory"
    admin_login_id: str = "admin"
    admin_password_hash: str = "$5$bizsupport$BeS2VTk9Uv7ieGJNZbg1ugajhEEQkPqBdRPe33dmda2"
    admin_role: str = "ADMIN"
    google_drive_root_folder_id: str | None = None
    google_service_account_file: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
