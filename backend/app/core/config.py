from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MillTrace PK"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://milltrace:milltrace@localhost:5432/milltrace_pk"
    frontend_url: str = "http://localhost:3000"
    seed_demo_data: bool = True
    default_expected_recovery_percentage: float = 10.5
    activated_warehouse_limit_hours: int = 24
    dispatch_receipt_limit_hours: int = 48
    demo_jwt_secret: str = "milltrace-demo-secret-change-me"
    duplicate_vehicle_window_minutes: int = 20
    max_reasonable_recovery_percentage: float = 14.5
    min_reasonable_recovery_percentage: float = 8.0
    allowed_warehouse_locations: str = "WH-A / Bay 03,WH-B / Bay 01"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins(self) -> list[str]:
        return [self.frontend_url, "http://127.0.0.1:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
