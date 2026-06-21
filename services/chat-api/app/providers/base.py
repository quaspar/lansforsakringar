from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from app.domain.models import Message


class LLMProvider(ABC):
    async def startup(self) -> None:
        """Open any long-lived resources. No-op by default."""

    async def aclose(self) -> None:
        """Release any long-lived resources. No-op by default."""

    @abstractmethod
    def stream_completion(
        self, model: str, messages: list[Message]
    ) -> AsyncIterator[str]: ...
