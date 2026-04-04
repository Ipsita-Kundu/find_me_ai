from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Find Me AI"
    app_env: str = "development"
    app_version: str = "0.1.0"
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "find_me_ai"
    jwt_secret_key: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    google_client_id: str | None = None
    embedding_model: str = "insightface-buffalo_l-arcface"
    embedding_backend: str = "auto"
    insightface_det_size: int = 480
    similarity_threshold: float = 0.50
    cors_origins: list[str] = ["*"]
    face_weight: float = 0.85
    metadata_weight: float = 0.15
    metadata_min_score: float = 0.0
    max_matches_per_report: int = 10
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60
    audit_log_enabled: bool = True

    @field_validator("app_env")
    @classmethod
    def validate_app_env(cls, value: str) -> str:
        allowed = {"development", "staging", "production", "test"}
        normalized = value.strip().lower()
        if normalized not in allowed:
            raise ValueError(f"app_env must be one of: {', '.join(sorted(allowed))}")
        return normalized

    @field_validator("google_client_id")
    @classmethod
    def validate_google_client_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @property
    def google_client_ids(self) -> list[str]:
        if not self.google_client_id:
            return []
        return [
            client_id.strip()
            for client_id in self.google_client_id.split(",")
            if client_id.strip()
        ]


settings = Settings()
