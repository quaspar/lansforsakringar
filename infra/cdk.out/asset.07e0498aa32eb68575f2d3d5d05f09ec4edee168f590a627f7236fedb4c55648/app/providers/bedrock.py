import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

import aioboto3

from app.domain.errors import InferenceUnavailable
from app.domain.models import Message
from app.providers.base import LLMProvider

_MAX_RETRIES = 3
_RETRY_BASE = 1.0


class BedrockProvider(LLMProvider):
    def __init__(self, region: str) -> None:
        self._region = region
        self._session = aioboto3.Session()

    def _build_request_body(
        self, model: str, messages: list[Message]
    ) -> dict[str, Any]:
        formatted = [{"role": m.role, "content": m.content} for m in messages]
        return {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "messages": formatted,
        }

    async def stream_completion(
        self, model: str, messages: list[Message]
    ) -> AsyncIterator[str]:
        body = self._build_request_body(model, messages)
        for attempt in range(_MAX_RETRIES):
            try:
                async with self._session.client(
                    "bedrock-runtime", region_name=self._region
                ) as client:
                    response = await client.invoke_model_with_response_stream(
                        modelId=model,
                        body=json.dumps(body),
                        contentType="application/json",
                        accept="application/json",
                    )
                    stream = response.get("body")
                    if stream is None:
                        raise InferenceUnavailable("empty response stream")
                    async for event in stream:
                        chunk = event.get("chunk")
                        if chunk:
                            data = json.loads(chunk["bytes"])
                            if data.get("type") == "content_block_delta":
                                delta = data.get("delta", {})
                                if delta.get("type") == "text_delta":
                                    yield delta.get("text", "")
                    return
            except InferenceUnavailable:
                raise
            except Exception as exc:
                if attempt >= _MAX_RETRIES - 1:
                    raise InferenceUnavailable(str(exc)) from exc
                await asyncio.sleep(_RETRY_BASE * (2**attempt))
