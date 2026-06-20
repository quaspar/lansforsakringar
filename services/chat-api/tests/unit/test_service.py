from collections.abc import AsyncIterator

import pytest

from app.domain.errors import (
    ConversationNotFound,
    InferenceUnavailable,
    ModelNotAllowed,
)
from app.domain.models import Message
from app.providers.base import LLMProvider
from app.providers.fake import FakeProvider
from app.repositories.memory import InMemoryRepository
from app.services.chat_service import ChatService

MODEL = "test-model"
ALT_MODEL = "alt-model"
ALLOWED = {MODEL}


class FailingProvider(LLMProvider):
    """Raises before emitting any token, simulating an unavailable model."""

    async def stream_completion(
        self, model: str, messages: list[Message]
    ) -> AsyncIterator[str]:
        raise InferenceUnavailable("boom")
        yield ""  # pragma: no cover — makes this an async generator


@pytest.fixture
def svc() -> ChatService:
    return ChatService(InMemoryRepository(), FakeProvider(), ALLOWED)


async def test_create_and_list_conversation(svc: ChatService) -> None:
    conv = await svc.create_conversation("user1", "My Chat", MODEL)
    assert conv.owner_sub == "user1"
    convs = await svc.list_conversations("user1")
    assert len(convs) == 1
    assert convs[0].id == conv.id


async def test_model_not_allowed(svc: ChatService) -> None:
    with pytest.raises(ModelNotAllowed):
        await svc.create_conversation("user1", "Chat", "forbidden-model")


async def test_isolation_get(svc: ChatService) -> None:
    conv = await svc.create_conversation("userA", "Chat", MODEL)
    with pytest.raises(ConversationNotFound):
        await svc.list_messages("userB", conv.id)


async def test_send_message_persists(svc: ChatService) -> None:
    conv = await svc.create_conversation("user1", "Chat", MODEL)
    tokens: list[str] = []
    stream = await svc.send_message("user1", conv.id, "hello")
    async for t in stream:
        tokens.append(t)
    assert tokens
    msgs = await svc.list_messages("user1", conv.id)
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[1].role == "assistant"
    assert "hello" in msgs[1].content


async def test_send_message_model_override_recorded() -> None:
    # A per-message model override is used for inference and stamped on the
    # persisted assistant message, even though the conversation was created
    # with a different model.
    svc = ChatService(InMemoryRepository(), FakeProvider(), {MODEL, ALT_MODEL})
    conv = await svc.create_conversation("user1", "Chat", MODEL)
    stream = await svc.send_message("user1", conv.id, "hello", ALT_MODEL)
    async for _ in stream:
        pass
    msgs = await svc.list_messages("user1", conv.id)
    assert msgs[1].role == "assistant"
    assert msgs[1].model == ALT_MODEL


async def test_send_message_override_not_allowed(svc: ChatService) -> None:
    conv = await svc.create_conversation("user1", "Chat", MODEL)
    with pytest.raises(ModelNotAllowed):
        await svc.send_message("user1", conv.id, "hello", "forbidden-model")


async def test_partial_stream_persists(svc: ChatService) -> None:
    conv = await svc.create_conversation("user1", "Chat", MODEL)
    stream = await svc.send_message("user1", conv.id, "partial")
    # consume only one token then explicitly close (mirrors how FastAPI
    # handles client disconnect — it calls aclose() on the generator)
    async for _ in stream:
        break
    await stream.aclose()
    msgs = await svc.list_messages("user1", conv.id)
    # user + assistant (possibly partial)
    assert len(msgs) == 2


async def test_list_messages_ordering(svc: ChatService) -> None:
    conv = await svc.create_conversation("user1", "Chat", MODEL)
    stream = await svc.send_message("user1", conv.id, "first")
    async for _ in stream:
        pass
    msgs = await svc.list_messages("user1", conv.id)
    assert msgs[0].role == "user"
    assert msgs[1].role == "assistant"


async def test_inference_failure_persists_no_blank_assistant() -> None:
    # On immediate inference failure the user message is kept, the error
    # propagates, and no empty assistant turn is persisted.
    svc = ChatService(InMemoryRepository(), FailingProvider(), ALLOWED)
    conv = await svc.create_conversation("user1", "Chat", MODEL)
    stream = await svc.send_message("user1", conv.id, "hello")
    with pytest.raises(InferenceUnavailable):
        async for _ in stream:
            pass
    msgs = await svc.list_messages("user1", conv.id)
    assert len(msgs) == 1
    assert msgs[0].role == "user"
