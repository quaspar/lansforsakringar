import asyncio
from collections.abc import AsyncIterator

import aioboto3

from app.domain.errors import InferenceUnavailable
from app.domain.models import Message
from app.providers.base import LLMProvider

_MAX_RETRIES = 3
_RETRY_BASE = 1.0
_MAX_TOKENS = 4096


class BedrockProvider(LLMProvider):
    def __init__(self, region: str) -> None:
        self._region = region
        self._session = aioboto3.Session()

    def _format_messages(self, messages: list[Message]) -> list[dict[str, object]]:
        # The Converse API uses a provider-agnostic message shape, so the same
        # code path works for Anthropic, Meta Llama and OpenAI models on Bedrock.
        return [
            {"role": m.role, "content": [{"text": m.content}]} for m in messages
        ]

    async def stream_completion(
        self, model: str, messages: list[Message]
    ) -> AsyncIterator[str]:
        formatted = self._format_messages(messages)
        for attempt in range(_MAX_RETRIES):
            try:
                async with self._session.client(
                    "bedrock-runtime", region_name=self._region
                ) as client:
                    response = await client.converse_stream(
                        modelId=model,
                        messages=formatted,
                        inferenceConfig={"maxTokens": _MAX_TOKENS},
                    )
                    stream = response.get("stream")
                    if stream is None:
                        raise InferenceUnavailable("empty response stream")
                    async for event in stream:
                        delta = event.get("contentBlockDelta", {}).get("delta", {})
                        text = delta.get("text")
                        if text:
                            yield text
                    return
            except InferenceUnavailable:
                raise
            except Exception as exc:
                if attempt >= _MAX_RETRIES - 1:
                    raise InferenceUnavailable(str(exc)) from exc
                await asyncio.sleep(_RETRY_BASE * (2**attempt))

