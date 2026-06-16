from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from app.domain.models import Message


class LLMProvider(ABC):
    @abstractmethod
    def stream_completion(
        self, model: str, messages: list[Message]
    ) -> AsyncIterator[str]: ...
