from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    aws_region: str = "us-east-1"
    dynamo_table_name: str = "chat-service"
    dynamo_endpoint: str = ""
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_region: str = "us-east-1"
    allowed_models: list[str] = [
        # Claude 4.x and Llama 3.3 require cross-region inference profiles
        # (the `us.` prefix); gpt-oss-120b is on-demand only (no profile).
        "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        "us.anthropic.claude-sonnet-4-6",
        "us.meta.llama3-3-70b-instruct-v1:0",
        "openai.gpt-oss-120b-1:0",
    ]
    repository: Literal["memory", "dynamo"] = "memory"
    provider: Literal["fake", "bedrock"] = "fake"
    auth_mode: Literal["cognito", "dev"] = "dev"
    max_message_chars: int = 8000


def get_settings() -> Settings:
    return Settings()
