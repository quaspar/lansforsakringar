# Architecture

## Overview

A single-user-isolated AI chat service built on AWS, with clean seams between the API, LLM inference, and persistence layers so each can be tested or swapped independently.

```
Browser → CloudFront → ALB → Fargate (FastAPI) → Bedrock (streaming)
                                    ↕
                               DynamoDB (single-table)
                                    ↑
                             Cognito JWT (auth)
```

## Layer boundaries

### API layer (`app/api/`)
HTTP surface only. Validates input, authenticates requests, translates domain errors to HTTP codes. Never talks to AWS directly.

### Service layer (`app/services/chat_service.py`)
Orchestrates the business logic: conversation lifecycle, message persistence, LLM streaming, partial-stream persistence on disconnect. Depends only on the abstract `ConversationRepository` and `LLMProvider` interfaces.

### Repository layer (`app/repositories/`)
Persistence abstraction. `InMemoryRepository` is used in CI and local dev without any AWS dependency. `DynamoDBRepository` is the production backend.

### Provider layer (`app/providers/`)
LLM abstraction. `FakeProvider` streams canned tokens for local dev and tests. `BedrockProvider` calls the real model.

## Data model — single DynamoDB table

| PK | SK | Description |
|---|---|---|
| `USER#<sub>` | `CONV#<ulid>` | Conversation metadata |
| `USER#<sub>` | `CONV#<cid>#MSG#<ulid>` | Message item |

ULID sort keys provide chronological ordering without a GSI. All queries are scoped to a single partition (`USER#<sub>`), so cross-user data is unreachable by construction — not just by authorization logic.

## Auth & isolation

The `owner_sub` is always extracted from the Cognito JWT (`sub` claim) by the FastAPI dependency `get_current_user`. It is passed as the first argument to every repository method, which enforces ownership at query time. Client input never supplies or influences the owner identity.

User B querying user A's conversation gets a `ConversationNotFound` (404), not a 403 — this avoids leaking the existence of a resource.

## Streaming

Messages are streamed over Server-Sent Events (SSE). The Fargate compute target is required because ALB + Lambda would buffer the response. The `ChatService.send_message` contract guarantees the assistant message is persisted via `try/finally`, even if the client disconnects mid-stream.

## Local dev (no AWS)

Set `REPOSITORY=memory`, `PROVIDER=fake`, `AUTH_MODE=dev`. No credentials needed. `X-Dev-Sub: <any>` is accepted as the identity header.

## Security notes

- Secrets come from environment variables (SSM/Secrets Manager in prod via ECS task env).
- Bedrock IAM policy is scoped to the specific model ARNs in `allowed_models`.
- DynamoDB IAM policy is scoped to the single table.
- CORS is permissive in dev; should be locked to the CloudFront domain in prod.
