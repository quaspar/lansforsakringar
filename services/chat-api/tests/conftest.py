import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_chat_service
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
def client(settings: Settings, service: ChatService) -> TestClient:
    # Inject the test's ChatService (and its repo/provider) straight into the
    # app via FastAPI's override mechanism, so requests share the exact same
    # instances the test can inspect — no production wiring runs.
    app = create_app(settings)
    app.dependency_overrides[get_chat_service] = lambda: service
    return TestClient(app)
