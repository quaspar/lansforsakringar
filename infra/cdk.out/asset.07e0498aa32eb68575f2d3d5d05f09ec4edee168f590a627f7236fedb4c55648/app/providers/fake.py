import asyncio
from collections.abc import AsyncIterator

from app.domain.models import Message
from app.providers.base import LLMProvider


class FakeProvider(LLMProvider):
    async def stream_completion(
        self, model: str, messages: list[Message]
    ) -> AsyncIterator[str]:
        last_user = next(
            (m.content for m in reversed(messages) if m.role == "user"), "hello"
        )
        reply = f"Echo: {last_user}"
        for word in reply.split():
            yield word + " "
            await asyncio.sleep(0.02)
