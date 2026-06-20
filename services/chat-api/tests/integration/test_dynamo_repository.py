"""Integration tests against DynamoDB Local.

Run with:
    DYNAMO_ENDPOINT=http://localhost:8000 pytest tests/integration
"""

import os
from datetime import UTC, datetime

import pytest
from ulid import ULID

from app.domain.errors import ConversationNotFound
from app.domain.models import Message
from app.repositories.dynamo import DynamoDBRepository

pytestmark = pytest.mark.skipif(
    os.getenv("DYNAMO_ENDPOINT") is None,
    reason="DYNAMO_ENDPOINT not set — skipping DynamoDB integration tests",
)

TABLE = os.getenv("DYNAMO_TABLE_NAME", "chat-service")
REGION = os.getenv("AWS_REGION", "us-east-1")
MODEL = "test-model"


@pytest.fixture
def repo() -> DynamoDBRepository:

    import aioboto3

    endpoint = os.getenv("DYNAMO_ENDPOINT", "http://localhost:8000")

    async def _patch_session(r: DynamoDBRepository) -> None:
        import aioboto3

        session = aioboto3.Session()
        r._session = session
        r._endpoint = endpoint

    r = DynamoDBRepository(table_name=TABLE, region=REGION)
    r._endpoint = endpoint  # type: ignore[attr-defined]
    original_resource = aioboto3.Session.resource

    def patched_resource(self, service, **kwargs):  # type: ignore[no-untyped-def]
        kwargs.setdefault("endpoint_url", endpoint)
        kwargs.setdefault("aws_access_key_id", "dummy")
        kwargs.setdefault("aws_secret_access_key", "dummy")
        return original_resource(self, service, **kwargs)

    import aioboto3

    aioboto3.Session.resource = patched_resource  # type: ignore[method-assign]
    yield r
    aioboto3.Session.resource = original_resource  # type: ignore[method-assign]


async def test_create_and_get(repo: DynamoDBRepository) -> None:
    conv = await repo.create_conversation("itest-userA", "Title", MODEL)
    fetched = await repo.get_conversation("itest-userA", conv.id)
    assert fetched.id == conv.id
    assert fetched.title == "Title"


async def test_isolation(repo: DynamoDBRepository) -> None:
    conv = await repo.create_conversation("itest-userA", "Private", MODEL)
    with pytest.raises(ConversationNotFound):
        await repo.get_conversation("itest-userB", conv.id)


async def test_add_and_list_messages(repo: DynamoDBRepository) -> None:
    conv = await repo.create_conversation("itest-userA", "MsgTest", MODEL)
    msg = Message(
        id=str(ULID()),
        role="user",
        content="integration test",
        created_at=datetime.now(UTC),
    )
    await repo.add_message("itest-userA", conv.id, msg)
    msgs = await repo.list_messages("itest-userA", conv.id)
    assert len(msgs) == 1
    assert msgs[0].content == "integration test"


async def test_list_conversations_excludes_messages(repo: DynamoDBRepository) -> None:
    # Two conversations for the same user, one of which has a message. Listing
    # must return only the conversation items and never the message items,
    # which share the same partition key. This exercises the FilterExpression
    # in list_conversations against real DynamoDB.
    conv_a = await repo.create_conversation("itest-listuser", "First", MODEL)
    conv_b = await repo.create_conversation("itest-listuser", "Second", MODEL)
    await repo.add_message(
        "itest-listuser",
        conv_a.id,
        Message(
            id=str(ULID()),
            role="user",
            content="hello",
            created_at=datetime.now(UTC),
        ),
    )

    convs = await repo.list_conversations("itest-listuser")
    listed_ids = {c.id for c in convs}
    assert {conv_a.id, conv_b.id} <= listed_ids
    # No message item leaked in as a "conversation".
    assert all(c.title in {"First", "Second"} for c in convs if c.id in listed_ids)


async def test_message_ordering(repo: DynamoDBRepository) -> None:
    import asyncio

    conv = await repo.create_conversation("itest-userA", "Order", MODEL)
    for i in range(3):
        await asyncio.sleep(0.01)
        msg = Message(
            id=str(ULID()),
            role="user",
            content=f"msg-{i}",
            created_at=datetime.now(UTC),
        )
        await repo.add_message("itest-userA", conv.id, msg)
    msgs = await repo.list_messages("itest-userA", conv.id)
    assert [m.content for m in msgs] == ["msg-0", "msg-1", "msg-2"]
