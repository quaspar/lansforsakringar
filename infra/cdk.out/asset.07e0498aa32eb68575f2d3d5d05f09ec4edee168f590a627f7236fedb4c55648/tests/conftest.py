import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.providers.fake import FakeProvider
from app.repositories.memory import InMemoryRepository
from app.services.chat_service import ChatService


@pytest.fixture
def settings() -> Settings:
    return Settings(
        allowed_models=["test-model", "anthropic.claude-3-haiku-20240307-v1:0"],
        repository="memory",
        provider="fake",
        auth_mode="dev",
    )


@pytest.fixture
def repo() -> InMemoryRepository:
    return InMemoryRepository()


@pytest.fixture
def provider() -> FakeProvider:
    return FakeProvider()


@pytest.fixture
def service(
    repo: InMemoryRepository, provider: FakeProvider, settings: Settings
) -> ChatService:
    return ChatService(repo, provider, set(settings.allowed_models))


@pytest.fixture
def client(settings: Settings) -> TestClient:
    app = create_app(settings)
    return TestClient(app)
