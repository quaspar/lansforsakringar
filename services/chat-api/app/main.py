import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import (
    conversation_not_found_handler,
    inference_unavailable_handler,
    model_not_allowed_handler,
    not_owner_handler,
    unhandled_exception_handler,
)
from app.api.routes import router
from app.config import Settings
from app.domain.errors import (
    ConversationNotFound,
    InferenceUnavailable,
    ModelNotAllowed,
    NotOwner,
)
from app.providers.base import LLMProvider
from app.repositories.base import ConversationRepository

logging.basicConfig(level=logging.INFO)


def _build_repository(settings: Settings) -> ConversationRepository:
    # Imports are per-branch so a production process only ever loads the
    # backend it actually uses, and an unrecognised value fails closed
    # rather than silently falling back to the in-memory store.
    match settings.repository:
        case "dynamo":
            from app.repositories.dynamo import DynamoDBRepository

            return DynamoDBRepository(
                table_name=settings.dynamo_table_name,
                region=settings.aws_region,
            )
        case "memory":
            from app.repositories.memory import InMemoryRepository

            return InMemoryRepository()
        case other:
            raise ValueError(f"Unknown repository backend: {other!r}")


def _build_provider(settings: Settings) -> LLMProvider:
    match settings.provider:
        case "bedrock":
            from app.providers.bedrock import BedrockProvider

            return BedrockProvider(region=settings.aws_region)
        case "fake":
            from app.providers.fake import FakeProvider

            return FakeProvider()
        case other:
            raise ValueError(f"Unknown provider: {other!r}")


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

    # App-scoped singletons read back by the dependency layer (app/api/deps.py)
    # via request.app.state. Tests bypass this wiring entirely by registering
    # app.dependency_overrides for get_repository / get_provider / etc.
    app.state.settings = settings
    app.state.repository = _build_repository(settings)
    app.state.provider = _build_provider(settings)

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
