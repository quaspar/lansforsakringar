from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CreateConversationRequest(BaseModel):
    title: str
    model: str


class ConversationResponse(BaseModel):
    id: str
    title: str
    model: str
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    model: str | None = None
    tokens: int | None = None
    created_at: datetime


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1)
    # Optional per-message model override. When set, this message is generated
    # with this model instead of the conversation's stored model, letting the
    # user switch models mid-conversation.
    model: str | None = None
