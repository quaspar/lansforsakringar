from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Message(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    model: str | None = None
    tokens: int | None = None
    created_at: datetime


class Conversation(BaseModel):
    id: str
    owner_sub: str
    title: str
    model: str
    created_at: datetime
    updated_at: datetime
