from datetime import UTC, datetime
from typing import Any

import aioboto3

from app.domain.errors import ConversationNotFound
from app.domain.models import Conversation, Message
from app.repositories.base import ConversationRepository

_R = "dynamodb"


class DynamoDBRepository(ConversationRepository):
    def __init__(self, table_name: str, region: str) -> None:
        self._table_name = table_name
        self._region = region
        self._session = aioboto3.Session()

    def _pk(self, owner_sub: str) -> str:
        return f"USER#{owner_sub}"

    def _conv_sk(self, conversation_id: str) -> str:
        return f"CONV#{conversation_id}"

    def _msg_sk(self, conversation_id: str, message_id: str) -> str:
        return f"CONV#{conversation_id}#MSG#{message_id}"

    def _item_to_conversation(self, item: dict[str, Any]) -> Conversation:
        return Conversation(
            id=item["conversationId"],
            owner_sub=item["ownerSub"],
            title=item["title"],
            model=item["model"],
            created_at=datetime.fromisoformat(item["createdAt"]),
            updated_at=datetime.fromisoformat(item["updatedAt"]),
        )

    def _item_to_message(self, item: dict[str, Any]) -> Message:
        return Message(
            id=item["messageId"],
            role=item["role"],
            content=item["content"],
            model=item.get("model"),
            tokens=item.get("tokens"),
            created_at=datetime.fromisoformat(item["createdAt"]),
        )

    def _resource(self) -> Any:
        return self._session.resource(_R, region_name=self._region)

    async def create_conversation(
        self, owner_sub: str, title: str, model: str
    ) -> Conversation:
        from ulid import ULID

        now = datetime.now(UTC)
        conv_id = str(ULID())
        item = {
            "PK": self._pk(owner_sub),
            "SK": self._conv_sk(conv_id),
            "conversationId": conv_id,
            "ownerSub": owner_sub,
            "title": title,
            "model": model,
            "createdAt": now.isoformat(),
            "updatedAt": now.isoformat(),
        }
        async with self._resource() as dynamo:
            table = await dynamo.Table(self._table_name)
            await table.put_item(Item=item)
        return Conversation(
            id=conv_id,
            owner_sub=owner_sub,
            title=title,
            model=model,
            created_at=now,
            updated_at=now,
        )

    async def get_conversation(
        self, owner_sub: str, conversation_id: str
    ) -> Conversation:
        async with self._resource() as dynamo:
            table = await dynamo.Table(self._table_name)
            resp = await table.get_item(
                Key={
                    "PK": self._pk(owner_sub),
                    "SK": self._conv_sk(conversation_id),
                }
            )
        item = resp.get("Item")
        if item is None:
            raise ConversationNotFound(conversation_id)
        return self._item_to_conversation(item)

    async def list_conversations(self, owner_sub: str) -> list[Conversation]:
        from boto3.dynamodb.conditions import Attr, Key

        async with self._resource() as dynamo:
            table = await dynamo.Table(self._table_name)
            resp = await table.query(
                KeyConditionExpression=Key("PK").eq(self._pk(owner_sub))
                & Key("SK").begins_with("CONV#"),
                FilterExpression=Attr("SK").not_contains("#MSG#"),  # type: ignore[attr-defined]
            )
        return [self._item_to_conversation(item) for item in resp.get("Items", [])]

    async def add_message(
        self, owner_sub: str, conversation_id: str, message: Message
    ) -> Message:
        await self.get_conversation(owner_sub, conversation_id)
        now = datetime.now(UTC)
        item: dict[str, Any] = {
            "PK": self._pk(owner_sub),
            "SK": self._msg_sk(conversation_id, message.id),
            "messageId": message.id,
            "conversationId": conversation_id,
            "role": message.role,
            "content": message.content,
            "createdAt": message.created_at.isoformat(),
        }
        if message.model is not None:
            item["model"] = message.model
        if message.tokens is not None:
            item["tokens"] = message.tokens

        async with self._resource() as dynamo:
            table = await dynamo.Table(self._table_name)
            await table.put_item(Item=item)
            await table.update_item(
                Key={
                    "PK": self._pk(owner_sub),
                    "SK": self._conv_sk(conversation_id),
                },
                UpdateExpression="SET updatedAt = :ts",
                ExpressionAttributeValues={":ts": now.isoformat()},
            )
        return message

    async def list_messages(
        self, owner_sub: str, conversation_id: str
    ) -> list[Message]:
        await self.get_conversation(owner_sub, conversation_id)
        from boto3.dynamodb.conditions import Key

        async with self._resource() as dynamo:
            table = await dynamo.Table(self._table_name)
            resp = await table.query(
                KeyConditionExpression=Key("PK").eq(self._pk(owner_sub))
                & Key("SK").begins_with(f"CONV#{conversation_id}#MSG#"),
            )
        return [self._item_to_message(item) for item in resp.get("Items", [])]
