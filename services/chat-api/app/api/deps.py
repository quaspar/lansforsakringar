"""FastAPI dependency providers.

These callables are the seams the rest of the app depends on. In production
they resolve the app-scoped singletons that `create_app` stores on
`app.state`; in tests they are swapped via `app.dependency_overrides` so no
production wiring (Bedrock/DynamoDB selection, settings env loading) runs.
"""

from typing import cast

from fastapi import Depends, Request

from app.config import Settings
from app.providers.base import LLMProvider
from app.repositories.base import ConversationRepository
from app.services.chat_service import ChatService


def get_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def get_repository(request: Request) -> ConversationRepository:
    return cast(ConversationRepository, request.app.state.repository)


def get_provider(request: Request) -> LLMProvider:
    return cast(LLMProvider, request.app.state.provider)


def get_chat_service(
    repo: ConversationRepository = Depends(get_repository),
    provider: LLMProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> ChatService:
    return ChatService(repo, provider, set(settings.allowed_models))
