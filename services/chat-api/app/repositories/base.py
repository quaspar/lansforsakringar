from abc import ABC, abstractmethod

from app.domain.models import Conversation, Message


class ConversationRepository(ABC):
    async def startup(self) -> None:
        """Open any long-lived resources. No-op by default."""

    async def aclose(self) -> None:
        """Release any long-lived resources. No-op by default."""

    @abstractmethod
    async def create_conversation(
        self, owner_sub: str, title: str, model: str
    ) -> Conversation: ...

    @abstractmethod
    async def get_conversation(
        self, owner_sub: str, conversation_id: str
    ) -> Conversation: ...

    @abstractmethod
    async def list_conversations(self, owner_sub: str) -> list[Conversation]: ...

    @abstractmethod
    async def add_message(
        self, owner_sub: str, conversation_id: str, message: Message
    ) -> Message: ...

    @abstractmethod
    async def list_messages(
        self, owner_sub: str, conversation_id: str
    ) -> list[Message]: ...
