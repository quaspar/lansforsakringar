import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_provider
from app.config import Settings
from app.main import create_app

MODEL = "test-model"


@pytest.fixture
def client() -> TestClient:
    settings = Settings(
        allowed_models=[MODEL],
        repository="memory",
        provider="fake",
        auth_mode="dev",
    )
    return TestClient(create_app(settings))


def test_health(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_create_conversation(client: TestClient) -> None:
    resp = client.post(
        "/conversations",
        json={"title": "Test", "model": MODEL},
        headers={"X-Dev-Sub": "userA"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test"
    assert data["model"] == MODEL


def test_list_conversations(client: TestClient) -> None:
    client.post(
        "/conversations",
        json={"title": "Chat", "model": MODEL},
        headers={"X-Dev-Sub": "userA"},
    )
    resp = client.get("/conversations", headers={"X-Dev-Sub": "userA"})
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_cross_user_404(client: TestClient) -> None:
    resp_a = client.post(
        "/conversations",
        json={"title": "Secret", "model": MODEL},
        headers={"X-Dev-Sub": "userA"},
    )
    conv_id = resp_a.json()["id"]

    resp_b = client.get(
        f"/conversations/{conv_id}/messages",
        headers={"X-Dev-Sub": "userB"},
    )
    assert resp_b.status_code == 404


def test_model_not_allowed(client: TestClient) -> None:
    resp = client.post(
        "/conversations",
        json={"title": "Chat", "model": "evil-model"},
        headers={"X-Dev-Sub": "userA"},
    )
    assert resp.status_code == 400


def test_send_message_streaming(client: TestClient) -> None:
    resp = client.post(
        "/conversations",
        json={"title": "Chat", "model": MODEL},
        headers={"X-Dev-Sub": "userA"},
    )
    conv_id = resp.json()["id"]

    with client.stream(
        "POST",
        f"/conversations/{conv_id}/messages",
        json={"content": "hello"},
        headers={"X-Dev-Sub": "userA"},
    ) as r:
        assert r.status_code == 200
        chunks = list(r.iter_lines())

    assert any("done" in chunk for chunk in chunks)


def test_send_message_stream_preserves_newlines_in_tokens(
    client: TestClient,
) -> None:
    # A token containing newlines must not break SSE framing: each line is sent
    # as its own `data:` field so an embedded newline can't terminate the event
    # early and drop the rest of the token.
    from app.domain.models import Message
    from app.providers.base import LLMProvider

    class NewlineProvider(LLMProvider):
        async def stream_completion(self, model: str, messages: list[Message]):  # type: ignore[no-untyped-def]
            yield "# Title\n\nbody"

    client.app.dependency_overrides[get_provider] = NewlineProvider

    resp = client.post(
        "/conversations",
        json={"title": "Chat", "model": MODEL},
        headers={"X-Dev-Sub": "userA"},
    )
    conv_id = resp.json()["id"]

    with client.stream(
        "POST",
        f"/conversations/{conv_id}/messages",
        json={"content": "hello"},
        headers={"X-Dev-Sub": "userA"},
    ) as r:
        assert r.status_code == 200
        body = r.read().decode()

    # Every content line is its own `data:` field; no bare (prefix-less) lines.
    content_event = body.split("event: done")[0]
    for line in content_event.splitlines():
        assert line == "" or line.startswith("data:"), line
    # Rejoining the data fields reconstructs the original token verbatim.
    data_values = [
        line[len("data: ") :] if line.startswith("data: ") else line[len("data:") :]
        for line in content_event.splitlines()
        if line.startswith("data:")
    ]
    assert "\n".join(data_values) == "# Title\n\nbody"


def test_send_message_stream_error_event(
    client: TestClient,
) -> None:
    # When inference fails after the SSE stream has started, the endpoint emits
    # a terminal `event: error` instead of a `done` event (and without bubbling
    # an exception into the already-started response).
    from app.domain.errors import InferenceUnavailable
    from app.domain.models import Message
    from app.providers.base import LLMProvider

    class BoomProvider(LLMProvider):
        async def stream_completion(self, model: str, messages: list[Message]):  # type: ignore[no-untyped-def]
            raise InferenceUnavailable("boom")
            yield ""  # pragma: no cover — makes this an async generator

    client.app.dependency_overrides[get_provider] = BoomProvider

    resp = client.post(
        "/conversations",
        json={"title": "Chat", "model": MODEL},
        headers={"X-Dev-Sub": "userA"},
    )
    conv_id = resp.json()["id"]

    with client.stream(
        "POST",
        f"/conversations/{conv_id}/messages",
        json={"content": "hello"},
        headers={"X-Dev-Sub": "userA"},
    ) as r:
        assert r.status_code == 200
        chunks = list(r.iter_lines())

    assert any("event: error" in chunk for chunk in chunks)
    assert not any("done" in chunk for chunk in chunks)


def test_lifespan_startup_and_shutdown() -> None:
    with TestClient(
        create_app(Settings(repository="memory", provider="fake", auth_mode="dev"))
    ) as c:
        resp = c.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_message_too_long(client: TestClient) -> None:
    settings = Settings(
        allowed_models=[MODEL],
        repository="memory",
        provider="fake",
        auth_mode="dev",
        max_message_chars=10,
    )
    c = TestClient(create_app(settings))
    resp_conv = c.post(
        "/conversations",
        json={"title": "Chat", "model": MODEL},
        headers={"X-Dev-Sub": "userA"},
    )
    conv_id = resp_conv.json()["id"]
    resp = c.post(
        f"/conversations/{conv_id}/messages",
        json={"content": "x" * 11},
        headers={"X-Dev-Sub": "userA"},
    )
    assert resp.status_code == 422
