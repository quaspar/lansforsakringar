from datetime import UTC, datetime

from ulid import ULID

from app.domain.errors import ConversationNotFound
from app.domain.models import Conversation, Message
from app.repositories.base import ConversationRepository


class InMemoryRepository(ConversationRepository):
    def __init__(self) -> None:
        self._conversations: dict[str, dict[str, Conversation]] = {}
        self._messages: dict[str, dict[str, list[Message]]] = {}

    async def create_conversation(
        self, owner_sub: str, title: str, model: str
    ) -> Conversation:
        now = datetime.now(UTC)
        conv = Conversation(
            id=str(ULID()),
            owner_sub=owner_sub,
            title=title,
            model=model,
            created_at=now,
            updated_at=now,
        )
        self._conversations.setdefault(owner_sub, {})[conv.id] = conv
        self._messages.setdefault(owner_sub, {})[conv.id] = []
        return conv

    async def get_conversation(
        self, owner_sub: str, conversation_id: str
    ) -> Conversation:
        conv = self._conversations.get(owner_sub, {}).get(conversation_id)
        if conv is None:
            raise ConversationNotFound(conversation_id)
        return conv

    async def list_conversations(self, owner_sub: str) -> list[Conversation]:
        return list(self._conversations.get(owner_sub, {}).values())

    async def add_message(
        self, owner_sub: str, conversation_id: str, message: Message
    ) -> Message:
        await self.get_conversation(owner_sub, conversation_id)
        self._messages.setdefault(owner_sub, {}).setdefault(conversation_id, []).append(
            message
        )
        conv = self._conversations[owner_sub][conversation_id]
        self._conversations[owner_sub][conversation_id] = conv.model_copy(
            update={"updated_at": datetime.now(UTC)}
        )
        return message

    async def list_messages(
        self, owner_sub: str, conversation_id: str
    ) -> list[Message]:
        await self.get_conversation(owner_sub, conversation_id)
        return list(self._messages.get(owner_sub, {}).get(conversation_id, []))
