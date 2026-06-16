from datetime import UTC, datetime

import pytest
from ulid import ULID

from app.domain.errors import ConversationNotFound
from app.domain.models import Message
from app.repositories.memory import InMemoryRepository

MODEL = "test-model"


@pytest.fixture
def repo() -> InMemoryRepository:
    return InMemoryRepository()


async def test_create_and_get(repo: InMemoryRepository) -> None:
    conv = await repo.create_conversation("user1", "Title", MODEL)
    fetched = await repo.get_conversation("user1", conv.id)
    assert fetched.id == conv.id


async def test_get_not_found(repo: InMemoryRepository) -> None:
    with pytest.raises(ConversationNotFound):
        await repo.get_conversation("user1", "nonexistent")


async def test_isolation(repo: InMemoryRepository) -> None:
    conv = await repo.create_conversation("userA", "Chat", MODEL)
    with pytest.raises(ConversationNotFound):
        await repo.get_conversation("userB", conv.id)


async def test_add_message_isolation(repo: InMemoryRepository) -> None:
    conv = await repo.create_conversation("userA", "Chat", MODEL)
    msg = Message(
        id=str(ULID()),
        role="user",
        content="hi",
        created_at=datetime.now(UTC),
    )
    with pytest.raises(ConversationNotFound):
        await repo.add_message("userB", conv.id, msg)


async def test_list_messages(repo: InMemoryRepository) -> None:
    conv = await repo.create_conversation("user1", "Chat", MODEL)
    msg = Message(
        id=str(ULID()),
        role="user",
        content="hi",
        created_at=datetime.now(UTC),
    )
    await repo.add_message("user1", conv.id, msg)
    msgs = await repo.list_messages("user1", conv.id)
    assert len(msgs) == 1
    assert msgs[0].content == "hi"
