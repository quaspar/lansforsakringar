# Implementation Plan — AI Chat Service

> Hand-off document. A developer (or a less-capable agent) should be able to
> execute this top-to-bottom without further design decisions. Architecture
> rationale lives in `docs/architecture.md` — read it first. This file is the
> *how*; that file is the *why*.

## Context

We are building a small AI chat service for a recruitment case. A user logs in,
creates conversations, sends messages, and gets streamed answers from an LLM.
History is persisted permanently. The point of the exercise is to demonstrate
clean structure, clear seams between API / LLM / data layers, and a credible
path to commercial use.

**Locked decisions (do not revisit):**
- Backend: Python 3.12 + FastAPI, async.
- LLM: AWS Bedrock, **model chosen by the user from a server-side allowlist**.
- DB: DynamoDB (single-table), on-demand billing.
- Auth: Amazon Cognito (JWT, `sub` claim = tenant key).
- Frontend: React + Tailwind (Vite).
- Compute: AWS Fargate (needed for SSE token streaming).
- IaC: AWS CDK (TypeScript).
- Local dev runs with **no AWS account** via DynamoDB Local + a `FakeProvider`.

**Guiding principle for the whole build:** the owner id (`owner_sub`) is always
taken from the verified JWT, never from client input, and is a **mandatory
argument** on every repository method. This is the user-isolation guarantee.

## Build philosophy

Build in phases. **Each phase must end runnable and with its tests green
before starting the next.** Phases 0–3 use in-memory fakes and need no AWS;
phases 4–5 swap real backends in behind the interfaces; 6–7 add UI and infra.
A reviewer can stop after Phase 5 and still have a complete backend that meets
every required capability.

---

## Target repository structure

```
.
├── docker-compose.yml              # chat-api + dynamodb-local + frontend (dev)
├── README.md                       # run instructions + design write-up
├── docs/
│   ├── architecture.md             # (exists) rationale + diagrams
│   └── implementation-plan.md      # (this file, copied in — see Phase 0)
├── .github/workflows/ci.yml        # lint, type-check, test, cdk synth
├── services/
│   └── chat-api/
│       ├── pyproject.toml
│       ├── Dockerfile
│       ├── .env.example
│       ├── app/
│       │   ├── __init__.py
│       │   ├── main.py             # FastAPI app factory, router + handler wiring
│       │   ├── config.py           # Settings (pydantic-settings)
│       │   ├── domain/
│       │   │   ├── models.py       # Conversation, Message (Pydantic)
│       │   │   └── errors.py       # ConversationNotFound, NotOwner, ...
│       │   ├── api/
│       │   │   ├── routes.py       # routers / endpoints
│       │   │   ├── schemas.py      # request/response DTOs
│       │   │   ├── auth.py         # Cognito JWT verification dependency
│       │   │   └── errors.py       # exception handlers -> HTTP envelope
│       │   ├── services/
│       │   │   └── chat_service.py # ChatService orchestration
│       │   ├── repositories/
│       │   │   ├── base.py         # ConversationRepository (ABC)
│       │   │   ├── memory.py       # InMemoryRepository
│       │   │   └── dynamo.py       # DynamoDBRepository
│       │   └── providers/
│       │       ├── base.py         # LLMProvider (ABC)
│       │       ├── fake.py         # FakeProvider (streams canned tokens)
│       │       └── bedrock.py      # BedrockProvider
│       ├── scripts/
│       │   └── create_local_table.py
│       └── tests/
│           ├── conftest.py
│           ├── unit/               # service + domain, against fakes
│           └── integration/        # dynamo.py against DynamoDB Local
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── api/client.ts           # fetch wrapper, attaches JWT, SSE parsing
│       ├── auth/                   # Cognito OIDC login
│       ├── components/             # ConversationList, ChatView, ModelPicker...
│       └── pages/
└── infra/                          # AWS CDK (TypeScript)
    ├── package.json
    ├── cdk.json
    ├── bin/app.ts
    └── lib/
        ├── network-stack.ts        # VPC, ALB
        ├── data-stack.ts           # DynamoDB table
        ├── auth-stack.ts           # Cognito user pool + client
        ├── compute-stack.ts        # Fargate service
        └── frontend-stack.ts       # S3 + CloudFront
```

## Conventions

- Python: ruff (lint+format), mypy (strict on `app/`), pytest. Line length 88.
- All I/O async (`async def`); use `aioboto3` for DynamoDB + Bedrock.
- Pydantic v2 everywhere. Domain models are separate from API DTOs.
- No secrets in code. Config via env, validated at startup.
- Conventional commits; one phase ≈ one or a few commits.

---

## Phase 0 — Scaffolding & tooling

**Goal:** empty app that lints, type-checks, tests, and runs `/health`.

Tasks:
1. Create the directory tree above (empty `__init__.py` files where needed).
2. Copy this plan to `docs/implementation-plan.md` (tracked).
3. `services/chat-api/pyproject.toml` with deps:
   `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `pydantic-settings`,
   `aioboto3`, `python-jose[cryptography]` (JWT), `ulid-py`, `httpx`;
   dev: `pytest`, `pytest-asyncio`, `ruff`, `mypy`, `types-*`.
4. `app/main.py`: `create_app()` factory returning a FastAPI instance with a
   `GET /health` → `{"status":"ok"}`.
5. `Dockerfile` (python:3.12-slim, non-root user, uvicorn entrypoint).
6. `.github/workflows/ci.yml`: matrix runs `ruff check`, `mypy`, `pytest`,
   and `cd infra && npm ci && npx cdk synth` (added later, guard if missing).
7. Root `docker-compose.yml` with the `chat-api` service (others added later).

**Acceptance:** `docker compose up chat-api` serves `/health`; `ruff`, `mypy`,
`pytest` pass locally and in CI (CI may have zero tests at this point — allow).

---

## Phase 1 — Domain core & interfaces (no AWS)

**Goal:** all business logic, fully unit-tested against in-memory fakes.

### `app/domain/models.py`

```python
class Message(BaseModel):
    id: str                 # ULID
    role: Literal["user", "assistant"]
    content: str
    model: str | None       # model used for assistant messages
    tokens: int | None
    created_at: datetime

class Conversation(BaseModel):
    id: str                 # ULID
    owner_sub: str
    title: str
    model: str              # default model for the conversation
    created_at: datetime
    updated_at: datetime
```

### `app/domain/errors.py`
Domain exceptions (plain `Exception` subclasses, no HTTP knowledge):
`ConversationNotFound`, `NotOwner`, `ModelNotAllowed`, `InferenceUnavailable`.

### `app/repositories/base.py` — `ConversationRepository(ABC)`
Every method takes `owner_sub` first. Async.

```python
async def create_conversation(self, owner_sub: str, title: str, model: str) -> Conversation
async def get_conversation(self, owner_sub: str, conversation_id: str) -> Conversation   # raises ConversationNotFound
async def list_conversations(self, owner_sub: str) -> list[Conversation]
async def add_message(self, owner_sub: str, conversation_id: str, message: Message) -> Message
async def list_messages(self, owner_sub: str, conversation_id: str) -> list[Message]
```

### `app/providers/base.py` — `LLMProvider(ABC)`

```python
async def stream_completion(self, model: str, messages: list[Message]) -> AsyncIterator[str]
```

Yields text token chunks.

### `app/providers/fake.py` — `FakeProvider`
Streams a canned reply word-by-word with small `asyncio.sleep` so the SSE path
is realistic. Echoes the last user message so tests can assert content.

### `app/repositories/memory.py` — `InMemoryRepository`
Dict keyed by `owner_sub` → conversations/messages. Enforces ownership
(get/add on a conversation not owned by `owner_sub` raises
`ConversationNotFound`).

### `app/services/chat_service.py` — `ChatService`
Constructor: `(repo: ConversationRepository, provider: LLMProvider, allowed_models: set[str])`.

```python
async def create_conversation(owner_sub, title, model) -> Conversation   # raises ModelNotAllowed
async def list_conversations(owner_sub) -> list[Conversation]
async def list_messages(owner_sub, conversation_id) -> list[Message]
async def send_message(owner_sub, conversation_id, text) -> AsyncIterator[str]
```

`send_message` contract (critical, reused by streaming):
1. `get_conversation(owner_sub, cid)` — raises if missing/not owner.
2. Build + persist the user `Message`.
3. Load history via `list_messages`.
4. `provider.stream_completion(model, history)`; yield each token to caller
   **and** accumulate them.
5. On stream completion, persist the assistant `Message` with full content.
6. If the consumer stops early (client disconnect), still persist whatever was
   accumulated (use try/finally).

### `tests/unit/`
Cover, at minimum:
- create/list/get round-trips.
- **isolation:** user B cannot get/add to user A's conversation (expect
  `ConversationNotFound`).
- `send_message` persists both user and assistant messages and streams tokens.
- partial-stream still persists the partial assistant message.
- `ModelNotAllowed` when model not in allowlist.

**Acceptance:** `pytest tests/unit` green; no AWS imports executed.

---

## Phase 2 — API layer

**Goal:** HTTP surface running against the in-memory repo + fake provider.

### `app/config.py` — `Settings(BaseSettings)`
Fields (env-driven, validated at startup):
`aws_region`, `dynamo_table_name`, `cognito_user_pool_id`, `cognito_client_id`,
`cognito_region`, `allowed_models: list[str]`, `repository: Literal["memory","dynamo"]`,
`provider: Literal["fake","bedrock"]`, `auth_mode: Literal["cognito","dev"]`,
`max_message_chars: int = 8000`. Provide `.env.example`.

### `app/api/auth.py` — JWT verification dependency
- `get_current_user() -> User(sub, email)` FastAPI dependency.
- Cognito mode: fetch + cache JWKS from
  `https://cognito-idp.{region}.amazonaws.com/{pool}/.well-known/jwks.json`;
  verify signature, `iss`, `aud`/`client_id`, `exp`. Return `sub`.
- Dev mode (`auth_mode=dev`): accept a header `X-Dev-Sub` → use as `sub`
  (local/testing only; never enabled in prod config).

### `app/api/schemas.py`
Request/response DTOs distinct from domain models:
`CreateConversationRequest{title, model}`, `ConversationResponse`,
`MessageResponse`, `SendMessageRequest{content}`.

### `app/api/routes.py` — endpoints (all depend on `get_current_user`)

```
POST   /conversations                      -> ConversationResponse
GET    /conversations                      -> list[ConversationResponse]
GET    /conversations/{id}/messages        -> list[MessageResponse]
POST   /conversations/{id}/messages        -> text/event-stream (Phase 3)
```

`owner_sub` is always `user.sub`; never read an owner id from path/body.
Validate `content` length against `max_message_chars`; enforce model allowlist.

### `app/api/errors.py` — exception handlers
Map domain errors → HTTP and the envelope `{"error":{"code","message"}}`:
`ConversationNotFound`→404, `NotOwner`→403, `ModelNotAllowed`→400,
`InferenceUnavailable`→503, validation→422, fallback→500 (log detail, don't leak).

### Wiring (`app/main.py`)
Build `Settings`, select repo/provider by config (factory functions), construct
`ChatService`, register routers + handlers. Use dependency-injection so tests
can override repo/provider.

### Tests
`TestClient`-based endpoint tests in dev auth mode against in-memory repo,
including a cross-user 404 test at the HTTP layer.

**Acceptance:** all endpoints work locally (non-streaming POST may return the
full message for now); endpoint tests green.

---

## Phase 3 — Streaming (SSE)

**Goal:** `POST /conversations/{id}/messages` streams tokens.

Tasks:
1. Endpoint returns `StreamingResponse(generator, media_type="text/event-stream")`.
2. Generator wraps `ChatService.send_message`, formatting each chunk as an SSE
   `data:` line; emit a terminal `event: done` frame.
3. Confirm the assistant message is persisted **after** the stream completes
   (and on early disconnect) — reuse the Phase 1 try/finally contract.
4. `FakeProvider` already streams; assert SSE framing in a test that reads the
   streamed body.

**Acceptance:** `curl -N` against the local endpoint shows incremental tokens
then `done`; message persisted; streaming test green.

---

## Phase 4 — DynamoDB repository

**Goal:** swap persistence to DynamoDB behind the same interface.

### Table design (single table)
- PK = `USER#<sub>`, SK = `CONV#<conversationId>` (conversation item) and
  `CONV#<cid>#MSG#<ulid>` (message item).
- Conversation attrs: `title, model, createdAt, updatedAt`.
- Message attrs: `role, content, model, tokens, createdAt`.

### `app/repositories/dynamo.py` — `DynamoDBRepository`
- `create_conversation`: `PutItem` conversation item.
- `get_conversation`: `GetItem` by PK+SK; raise `ConversationNotFound` if absent.
- `list_conversations`: `Query PK=USER#<sub>, begins_with(SK,"CONV#")`, keep
  items whose SK has no `#MSG#`.
- `add_message`: `PutItem` message item; update conversation `updatedAt`.
- `list_messages`: `Query PK=USER#<sub>, begins_with(SK,"CONV#<cid>#MSG#")`,
  ordered by SK (ULID → chronological). First verify the conversation exists
  for this owner.

### Local infra
- Add `dynamodb-local` to `docker-compose.yml`.
- `scripts/create_local_table.py` creates the table (on-demand billing).

### Tests (`tests/integration/`)
Run `dynamo.py` against DynamoDB Local: round-trips, ordering, and the
isolation test (queries scoped to the partition return nothing cross-user).

**Acceptance:** with `repository=dynamo`, full app works against DynamoDB Local;
integration tests green. Unit suite unchanged (still uses in-memory).

---

## Phase 5 — Bedrock provider

**Goal:** real inference, streamed, model selectable.

### `app/providers/bedrock.py` — `BedrockProvider`
- Use `aioboto3` `bedrock-runtime`, `invoke_model_with_response_stream`.
- Map `list[Message]` → the request body for the selected model family
  (start with Anthropic-on-Bedrock message format; keep the mapping isolated so
  other families can be added). The model id comes from the conversation.
- Parse the streaming response, yielding text deltas as they arrive.
- Wrap in timeout + bounded retry/backoff on throttling; on failure raise
  `InferenceUnavailable` (→503).

### Config
`provider=bedrock`, `allowed_models=[...]` (the ids exposed to users). IAM role
must allow `bedrock:InvokeModel*` for those models.

**Acceptance:** with AWS creds + `provider=bedrock`, sending a message streams a
real model reply and persists it. `provider=fake` remains default for CI/local.

---

## Phase 6 — Frontend (React + Tailwind)

**Goal:** clickable UI for the whole flow.

- Vite + React + TS + Tailwind. `api/client.ts` attaches the Cognito JWT and
  parses the SSE stream (incremental render).
- Cognito Hosted UI / OIDC login (`auth/`), store tokens, redirect handling.
- Components: `ConversationList`, `ChatView` (streaming bubbles), `MessageInput`,
  `ModelPicker` (populated from an allowlist endpoint or config), new-conversation
  action.
- Handle the error envelope and 401 (re-auth).
- Add `frontend` to `docker-compose.yml` for local dev (proxy to chat-api).

**Acceptance:** log in, create a conversation, pick a model, send a message,
watch tokens stream in, reload and see history.

---

## Phase 7 — Infrastructure (AWS CDK, TypeScript)

**Goal:** `cdk deploy` stands up the stack reproducibly.

Stacks (`infra/lib/`):
- `auth-stack`: Cognito user pool + app client (OIDC, hosted UI domain).
- `data-stack`: DynamoDB table (PK/SK, on-demand, KMS, point-in-time recovery).
- `network-stack`: VPC + ALB.
- `compute-stack`: ECS Fargate service running the chat-api image; ALB listener;
  task IAM role scoped to the table + `bedrock:InvokeModel*`; env vars from
  config/SSM; CloudWatch logs.
- `frontend-stack`: S3 bucket + CloudFront for the SPA.

Wire `cdk synth` into CI.

**Acceptance:** `cd infra && npx cdk deploy --all` provisions everything; the
deployed URL serves the app end-to-end with real Cognito + Bedrock + DynamoDB.

---

## Phase 8 — Docs, runbook, polish

- `README.md`: two run paths — (a) local: `docker compose up`, dev auth,
  fake provider, DynamoDB Local; (b) AWS: `cdk deploy`, real services. List all
  env vars (point to `.env.example`). Add a short "motivate your choices"
  section linking `architecture.md`.
- Add per-user `DELETE /conversations/{id}` and a data-export endpoint as the
  GDPR stub (implement if time).
- Final pass: structured logging + request-id middleware, per-user rate-limit
  hook, confirm error envelope everywhere, confirm no secrets in repo.

**Acceptance:** a fresh clone can be run locally from the README with no AWS
account; the design write-up answers every discussion topic in the case
(data model, tech choices, architecture, SDLC, security, error handling).

---

## End-to-end verification (do this after Phases 0–5, again after 6–7)

1. **Local backend smoke (no AWS):**
   - `docker compose up chat-api dynamodb-local`; run `create_local_table.py`.
   - `auth_mode=dev`, `provider=fake`, `repository=dynamo`.
   - `POST /conversations` (with `X-Dev-Sub: userA`) → 201.
   - `POST /conversations/{id}/messages` with `curl -N` → streamed tokens + done.
   - `GET /conversations/{id}/messages` → user + assistant messages persisted.
2. **Isolation check:** repeat the GET with `X-Dev-Sub: userB` against userA's
   conversation id → **404** (not 403, not data). This is the key security test.
3. **Test suites:** `pytest tests/unit` and `pytest tests/integration` green;
   `ruff`, `mypy` clean; `cdk synth` succeeds.
4. **Real-stack (optional, needs AWS):** `provider=bedrock`,
   `auth_mode=cognito`; log in via the UI, send a message, confirm a real
   streamed reply and persisted history in DynamoDB.

## Notes for the implementer

- Do **not** introduce an endpoint that accepts a user/owner id from the client.
  `owner_sub` always comes from `get_current_user`. This is the isolation
  contract — every repository method enforces it by signature.
- Keep `FakeProvider` and `InMemoryRepository` working for the life of the
  project; CI depends on them so it needs no AWS credentials.
- The interfaces (`ConversationRepository`, `LLMProvider`) are the seams the
  whole design sells — don't leak `boto3`/Bedrock types above the
  repository/provider boundary.
