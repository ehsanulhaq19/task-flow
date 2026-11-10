from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables and the .env file."""

    SECRET_KEY: str = "dev-only-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/taskflow"
    SCREENSHOT_DIR: str = "/data/screenshots"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True
    REPORT_TIMEZONE: str = "Asia/Karachi"
    REPORT_HOUR: int = 23
    REPORT_MINUTE: int = 59
    CORS_ORIGINS: list[str] = [
        "http://localhost:3010",
        "http://127.0.0.1:3010",
        "https://imehsan.com",
        "https://www.imehsan.com",
    ]
    APP_NAME: str = "Taskflow"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings."""
    return Settings()
