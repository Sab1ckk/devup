from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT / '.env', ROOT / 'backend' / '.env'), extra='ignore', hide_input_in_errors=True)
    database_url: str
    secret_key: str
    base_url: str = 'http://localhost:5173'
    cookie_secure: bool = False
    mail_backend: str = 'console'
    smtp_host: str = 'localhost'
    smtp_port: int = 1025
    smtp_user: str = ''
    smtp_password: str = ''
    smtp_starttls: bool = False
    mail_from: str = 'devup@localhost'
    code_minutes: int = 10
    code_attempts: int = 5
    resend_seconds: int = 60
    resend_max: int = 5
    login_ip_limit: int = 10
    login_email_limit: int = 5
    mail_email_limit: int = 5
    mail_ip_limit: int = 20
    claim_ip_limit: int = 20
    claim_request_limit: int = 5
    register_ip_limit: int = 10
    guest_request_limit: int = 5
    user_request_limit: int = 20
    session_days: int = 14
    session_max_days: int = 30
    guest_days: int = 30
    media_root: Path = ROOT / 'media'
    media_url_prefix: str = '/media'
    file_storage_backend: str = 'local'
    max_upload_bytes: int = 5 * 1024 * 1024
    max_image_side: int = 8000
    admin_session_idle_minutes: int = 30
    admin_session_max_hours: int = 8

    chat_max_message_length: int = 2000
    chat_page_size: int = 50
    chat_rate_per_minute: int = 10
    chat_rate_per_day: int = 200
    chat_manager_rate_per_minute: int = 30
    chat_email_throttle_minutes: int = 30
    chat_active_window_seconds: int = 120

    @property
    def sync_url(self):
        if not self.database_url.startswith(('postgresql://','postgresql+psycopg://','postgresql+asyncpg://')):
            raise RuntimeError('DATABASE_URL must point to PostgreSQL')
        return self.database_url.replace('postgresql+asyncpg://', 'postgresql+psycopg://').replace('postgresql://', 'postgresql+psycopg://')

@lru_cache
def settings():
    value = Settings()
    if len(value.secret_key) < 32:
        raise RuntimeError('SECRET_KEY must contain at least 32 characters')
    return value
