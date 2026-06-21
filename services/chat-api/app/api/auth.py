import asyncio
import time
from typing import Any

import httpx
from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel

from app.api.deps import get_settings
from app.config import Settings


class User(BaseModel):
    sub: str
    email: str = ""


_jwks_cache: dict[str, Any] = {}
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 3600.0
_jwks_lock = asyncio.Lock()


async def _get_jwks(settings: Settings) -> dict[str, Any]:
    global _jwks_fetched_at, _jwks_cache
    async with _jwks_lock:
        now = time.monotonic()
        if _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL:
            return _jwks_cache
        url = (
            f"https://cognito-idp.{settings.cognito_region}.amazonaws.com"
            f"/{settings.cognito_user_pool_id}/.well-known/jwks.json"
        )
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_fetched_at = now
    return _jwks_cache


async def get_current_user(
    x_dev_sub: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> User:
    if settings.auth_mode == "dev":
        sub = x_dev_sub or "dev-user"
        return User(sub=sub)

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = authorization.removeprefix("Bearer ")
    issuer = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com"
        f"/{settings.cognito_user_pool_id}"
    )
    try:
        jwks = await _get_jwks(settings)
        payload: dict[str, Any] = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.cognito_client_id,
            issuer=issuer,
            options={"verify_at_hash": False},
        )
        jwt_sub: str = payload.get("sub", "")
        if not jwt_sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )
        return User(sub=jwt_sub, email=payload.get("email", ""))
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
