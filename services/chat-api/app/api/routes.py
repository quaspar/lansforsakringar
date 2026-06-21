from collections.abc import AsyncIterator
from logging import getLogger

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.auth import User, get_current_user
from app.api.deps import get_chat_service, get_settings
from app.api.schemas import (
    ConversationResponse,
    CreateConversationRequest,
    MessageResponse,
    SendMessageRequest,
)
from app.config import Settings
from app.domain.errors import InferenceUnavailable
from app.domain.models import Conversation, Message
from app.services.chat_service import ChatService

logger = getLogger(__name__)

router = APIRouter()


def _conv_to_response(conv: Conversation) -> ConversationResponse:
    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        model=conv.model,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


def _msg_to_response(msg: Message) -> MessageResponse:
    return MessageResponse(
        id=msg.id,
        role=msg.role,
        content=msg.content,
        model=msg.model,
        tokens=msg.tokens,
        created_at=msg.created_at,
    )


@router.post("/conversations", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    body: CreateConversationRequest,
    service: ChatService = Depends(get_chat_service),
    user: User = Depends(get_current_user),
) -> ConversationResponse:
    conv = await service.create_conversation(user.sub, body.title, body.model)
    return _conv_to_response(conv)


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    service: ChatService = Depends(get_chat_service),
    user: User = Depends(get_current_user),
) -> list[ConversationResponse]:
    convs = await service.list_conversations(user.sub)
    return [_conv_to_response(c) for c in convs]


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
async def list_messages(
    conversation_id: str,
    service: ChatService = Depends(get_chat_service),
    user: User = Depends(get_current_user),
) -> list[MessageResponse]:
    msgs = await service.list_messages(user.sub, conversation_id)
    return [_msg_to_response(m) for m in msgs]


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SendMessageRequest,
    service: ChatService = Depends(get_chat_service),
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    if len(body.content) > settings.max_message_chars:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Message exceeds {settings.max_message_chars} characters",
        )

    stream = await service.send_message(
        user.sub, conversation_id, body.content, body.model
    )

    async def event_generator() -> AsyncIterator[bytes]:
        # The stream is already a 200 response by the time inference runs,
        # so a provider failure can't become an HTTP error status. Emit a
        # terminal SSE `error` event instead of letting the exception bubble
        # into Starlette (which would raise "response already started").
        try:
            async for token in stream:
                # SSE forbids raw newlines inside a `data:` value: a blank
                # line terminates the event, so a token like "a\n\nb" would
                # be framed as `data: a` followed by bare lines the client
                # drops. Emit one `data:` field per line; the client rejoins
                # them with "\n" to reconstruct the original token.
                payload = "".join(f"data: {line}\n" for line in token.split("\n"))
                yield f"{payload}\n".encode()
        except InferenceUnavailable as exc:
            logger.warning("inference failed mid-stream: %s", exc)
            yield b"event: error\ndata: upstream_error\n\n"
            return
        yield b"event: done\ndata: \n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
