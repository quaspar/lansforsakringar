from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.auth import AuthDependency, User
from app.api.schemas import (
    ConversationResponse,
    CreateConversationRequest,
    MessageResponse,
    SendMessageRequest,
)
from app.domain.models import Conversation, Message
from app.services.chat_service import ChatService


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


def make_router(
    service: ChatService, get_current_user: AuthDependency, max_message_chars: int
) -> APIRouter:
    router = APIRouter()

    @router.post("/conversations", response_model=ConversationResponse, status_code=201)
    async def create_conversation(
        body: CreateConversationRequest,
        user: User = Depends(get_current_user),
    ) -> ConversationResponse:
        conv = await service.create_conversation(user.sub, body.title, body.model)
        return _conv_to_response(conv)

    @router.get("/conversations", response_model=list[ConversationResponse])
    async def list_conversations(
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
        user: User = Depends(get_current_user),
    ) -> list[MessageResponse]:
        msgs = await service.list_messages(user.sub, conversation_id)
        return [_msg_to_response(m) for m in msgs]

    @router.post("/conversations/{conversation_id}/messages")
    async def send_message(
        conversation_id: str,
        body: SendMessageRequest,
        user: User = Depends(get_current_user),
    ) -> StreamingResponse:
        if len(body.content) > max_message_chars:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Message exceeds {max_message_chars} characters",
            )

        stream = await service.send_message(user.sub, conversation_id, body.content)

        async def event_generator() -> AsyncIterator[bytes]:
            async for token in stream:
                yield f"data: {token}\n\n".encode()
            yield b"event: done\ndata: \n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    return router
