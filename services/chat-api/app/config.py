from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    aws_region: str = "us-east-1"
    dynamo_table_name: str = "chat-service"
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_region: str = "us-east-1"
    allowed_models: list[str] = [
        "anthropic.claude-haiku-4-5-20251001-v1:0",
        "anthropic.claude-3-5-sonnet-20241022-v2:0",
    ]
    repository: Literal["memory", "dynamo"] = "memory"
    provider: Literal["fake", "bedrock"] = "fake"
    auth_mode: Literal["cognito", "dev"] = "dev"
    max_message_chars: int = 8000


def get_settings() -> Settings:
    return Settings()
