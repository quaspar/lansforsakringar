from collections.abc import AsyncGenerator, AsyncIterator
from datetime import UTC, datetime

from ulid import ULID

from app.domain.errors import ModelNotAllowed
from app.domain.models import Conversation, Message
from app.providers.base import LLMProvider
from app.repositories.base import ConversationRepository


class ChatService:
    def __init__(
        self,
        repo: ConversationRepository,
        provider: LLMProvider,
        allowed_models: set[str],
    ) -> None:
        self._repo = repo
        self._provider = provider
        self._allowed_models = allowed_models

    async def create_conversation(
        self, owner_sub: str, title: str, model: str
    ) -> Conversation:
        if model not in self._allowed_models:
            raise ModelNotAllowed(model)
        return await self._repo.create_conversation(owner_sub, title, model)

    async def list_conversations(self, owner_sub: str) -> list[Conversation]:
        return await self._repo.list_conversations(owner_sub)

    async def list_messages(
        self, owner_sub: str, conversation_id: str
    ) -> list[Message]:
        return await self._repo.list_messages(owner_sub, conversation_id)

    async def send_message(
        self, owner_sub: str, conversation_id: str, text: str
    ) -> AsyncIterator[str]:
        conv = await self._repo.get_conversation(owner_sub, conversation_id)

        user_msg = Message(
            id=str(ULID()),
            role="user",
            content=text,
            created_at=datetime.now(UTC),
        )
        await self._repo.add_message(owner_sub, conversation_id, user_msg)

        history = await self._repo.list_messages(owner_sub, conversation_id)

        accumulated: list[str] = []

        async def _stream() -> AsyncGenerator[str, None]:
            try:
                async for token in self._provider.stream_completion(
                    conv.model, history
                ):
                    accumulated.append(token)
                    yield token
            finally:
                # Persist whatever was generated — full reply on normal
                # completion, partial on client disconnect. If the provider
                # failed before emitting any token (e.g. InferenceUnavailable),
                # accumulated is empty: skip persisting a blank assistant turn
                # and let the exception propagate so the caller surfaces a 503.
                if accumulated:
                    assistant_msg = Message(
                        id=str(ULID()),
                        role="assistant",
                        content="".join(accumulated),
                        model=conv.model,
                        created_at=datetime.now(UTC),
                    )
                    await self._repo.add_message(
                        owner_sub, conversation_id, assistant_msg
                    )

        return _stream()
