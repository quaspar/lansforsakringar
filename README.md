# AI Chat Service

A streamed AI chat service built for a recruitment case study. Users create conversations, send messages, and receive token-by-token streamed answers from AWS Bedrock. All history is persisted in DynamoDB.

See [docs/architecture.md](docs/architecture.md) for design rationale and [docs/implementation-plan.md](docs/implementation-plan.md) for the build plan.

---

## Run locally (no AWS account required)

Prerequisites: Docker, Docker Compose.

```bash
# 1. Start DynamoDB Local and the API
docker compose up chat-api dynamodb-local -d

# 2. Create the local table
cd services/chat-api
pip install -e ".[dev]"
DYNAMO_ENDPOINT=http://localhost:8001 \
AWS_ACCESS_KEY_ID=dummy \
AWS_SECRET_ACCESS_KEY=dummy \
python scripts/create_local_table.py

# 3. Test the API (dev auth mode — no JWT needed)
curl -s http://localhost:8000/health

# Create a conversation
curl -s -X POST http://localhost:8000/conversations \
  -H "Content-Type: application/json" \
  -H "X-Dev-Sub: alice" \
  -d '{"title":"My Chat","model":"anthropic.claude-3-haiku-20240307-v1:0"}' | jq

# Stream a message (replace <id> with the conversation id)
curl -N -X POST http://localhost:8000/conversations/<id>/messages \
  -H "Content-Type: application/json" \
  -H "X-Dev-Sub: alice" \
  -d '{"content":"Hello!"}'

# 4. Start the frontend
docker compose up frontend -d
# Open http://localhost:5173
```

### Isolation smoke test

```bash
# As userB — should get 404, not userA's data
curl -s http://localhost:8000/conversations/<alice-conv-id>/messages \
  -H "X-Dev-Sub: bob"
# {"error":{"code":"NOT_FOUND","message":"Conversation not found"}}
```

### Run tests

```bash
cd services/chat-api
pytest tests/unit -v          # unit tests (no AWS)

# Integration tests need DynamoDB Local running
DYNAMO_ENDPOINT=http://localhost:8001 \
AWS_ACCESS_KEY_ID=dummy \
AWS_SECRET_ACCESS_KEY=dummy \
pytest tests/integration -v
```

---

## Deploy to AWS

Prerequisites: AWS CLI configured, Docker, Node 20, CDK bootstrapped.

```bash
# 1. Bootstrap CDK (once per account/region)
cd infra
npm ci
npx cdk bootstrap

# 2. Deploy all stacks
npx cdk deploy --all

# Outputs include: UserPoolId, UserPoolClientId, CognitoDomain, ApiEndpoint, FrontendUrl

# 3. Update the Cognito app client callback URL to the CloudFront URL
# (or set it in the CDK before deploying)
```

### Environment variables (`.env.example`)

| Variable | Default | Description |
|---|---|---|
| `AWS_REGION` | `us-east-1` | AWS region |
| `DYNAMO_TABLE_NAME` | `chat-service` | DynamoDB table name |
| `COGNITO_USER_POOL_ID` | — | Cognito user pool ID |
| `COGNITO_CLIENT_ID` | — | Cognito app client ID |
| `COGNITO_REGION` | `us-east-1` | Cognito region |
| `ALLOWED_MODELS` | Claude Haiku, Sonnet | Comma-separated Bedrock model IDs |
| `REPOSITORY` | `memory` | `memory` or `dynamo` |
| `PROVIDER` | `fake` | `fake` or `bedrock` |
| `AUTH_MODE` | `dev` | `dev` (X-Dev-Sub header) or `cognito` (JWT) |
| `MAX_MESSAGE_CHARS` | `8000` | Max message length |

---

## Design choices

**Single-table DynamoDB** — all conversation and message data lives under `USER#<sub>` partition keys, making all queries O(1) by user with no cross-user access possible at the storage level.

**SSE over WebSockets** — simpler to implement and proxy; sufficient for a chat use case where only the server pushes data. Fargate (not Lambda) is used to avoid response buffering.

**Interface-first design** — `ConversationRepository` and `LLMProvider` are ABCs. CI runs entirely against in-memory fakes with no AWS credentials. Real backends are swapped in via config.

**Owner-sub from JWT always** — the `owner_sub` is extracted from the verified Cognito JWT and is a mandatory first argument on every repository method. Client input can never influence which user's data is accessed.

**Partial-stream persistence** — `send_message` uses `try/finally` to persist whatever tokens were accumulated, even if the client disconnects before the stream completes.
