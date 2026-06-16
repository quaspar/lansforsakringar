import pytest

from app.domain.errors import ConversationNotFound, ModelNotAllowed
from app.providers.fake import FakeProvider
from app.repositories.memory import InMemoryRepository
from app.services.chat_service import ChatService

MODEL = "test-model"
ALLOWED = {MODEL}


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
