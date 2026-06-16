import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import make_auth_dependency
from app.api.errors import (
    conversation_not_found_handler,
    inference_unavailable_handler,
    model_not_allowed_handler,
    not_owner_handler,
    unhandled_exception_handler,
)
from app.api.routes import make_router
from app.config import Settings
from app.domain.errors import (
    ConversationNotFound,
    InferenceUnavailable,
    ModelNotAllowed,
    NotOwner,
)
from app.providers.base import LLMProvider
from app.providers.bedrock import BedrockProvider
from app.providers.fake import FakeProvider
from app.repositories.base import ConversationRepository
from app.repositories.memory import InMemoryRepository
from app.services.chat_service import ChatService

logging.basicConfig(level=logging.INFO)


def _make_repository(settings: Settings) -> ConversationRepository:
    if settings.repository == "dynamo":
        from app.repositories.dynamo import DynamoDBRepository

        return DynamoDBRepository(
            table_name=settings.dynamo_table_name,
            region=settings.aws_region,
        )
    return InMemoryRepository()


def _make_provider(settings: Settings) -> LLMProvider:
    if settings.provider == "bedrock":
        return BedrockProvider(region=settings.aws_region)
    return FakeProvider()


def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is None:
        settings = Settings()

    app = FastAPI(title="Chat API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    repo = _make_repository(settings)
    provider = _make_provider(settings)
    service = ChatService(repo, provider, set(settings.allowed_models))
    get_current_user = make_auth_dependency(settings)

    router = make_router(service, get_current_user, settings.max_message_chars)
    app.include_router(router)

    app.add_exception_handler(ConversationNotFound, conversation_not_found_handler)  # type: ignore[arg-type]
    app.add_exception_handler(NotOwner, not_owner_handler)  # type: ignore[arg-type]
    app.add_exception_handler(ModelNotAllowed, model_not_allowed_handler)  # type: ignore[arg-type]
    app.add_exception_handler(InferenceUnavailable, inference_unavailable_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_exception_handler)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
