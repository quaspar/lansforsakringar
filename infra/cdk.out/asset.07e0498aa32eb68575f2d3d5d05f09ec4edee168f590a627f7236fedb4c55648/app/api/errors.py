import logging

from fastapi import Request
from fastapi.responses import JSONResponse

from app.domain.errors import (
    ConversationNotFound,
    InferenceUnavailable,
    ModelNotAllowed,
    NotOwner,
)

logger = logging.getLogger(__name__)


def _envelope(code: str, message: str) -> dict[str, object]:
    return {"error": {"code": code, "message": message}}


async def conversation_not_found_handler(
    request: Request, exc: ConversationNotFound
) -> JSONResponse:
    return JSONResponse(
        status_code=404, content=_envelope("NOT_FOUND", "Conversation not found")
    )


async def not_owner_handler(request: Request, exc: NotOwner) -> JSONResponse:
    return JSONResponse(
        status_code=403, content=_envelope("FORBIDDEN", "Access denied")
    )


async def model_not_allowed_handler(
    request: Request, exc: ModelNotAllowed
) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content=_envelope("MODEL_NOT_ALLOWED", f"Model not allowed: {exc}"),
    )


async def inference_unavailable_handler(
    request: Request, exc: InferenceUnavailable
) -> JSONResponse:
    logger.error("Inference unavailable: %s", exc)
    return JSONResponse(
        status_code=503,
        content=_envelope("INFERENCE_UNAVAILABLE", "Inference service unavailable"),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content=_envelope("INTERNAL_ERROR", "An internal error occurred"),
    )
