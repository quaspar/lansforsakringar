# AI-chattjänst

En strömmad AI-chattjänst byggd för en rekryteringsuppgift. Användare skapar konversationer, skickar meddelanden och får svar strömmade token för token från AWS Bedrock. All historik lagras permanent i DynamoDB.

Se [docs/architecture.md](docs/architecture.md) för designresonemang.

---

## Kör lokalt (inget AWS-konto krävs)

Förutsättningar: Docker, Docker Compose.

```bash
# Starta allt (DynamoDB Local, API, frontend) — tabellen skapas automatiskt
docker compose up -d
# Öppna http://localhost:5173
```

API:et körs i dev-autentiseringsläge (ingen JWT behövs). Testa via curl:

```bash
curl -s http://localhost:8000/health

# Skapa en konversation
curl -s -X POST http://localhost:8000/conversations \
  -H "Content-Type: application/json" \
  -H "X-Dev-Sub: alice" \
  -d '{"title":"My Chat","model":"us.anthropic.claude-haiku-4-5-20251001-v1:0"}' | jq

# Strömma ett meddelande (ersätt <id> med konversationens id)
curl -N -X POST http://localhost:8000/conversations/<id>/messages \
  -H "Content-Type: application/json" \
  -H "X-Dev-Sub: alice" \
  -d '{"content":"Hello!"}'
```

### Röktest för isolering

```bash
# Som userB — ska få 404, inte userA:s data
curl -s http://localhost:8000/conversations/<alice-conv-id>/messages \
  -H "X-Dev-Sub: bob"
# {"error":{"code":"NOT_FOUND","message":"Conversation not found"}}
```

### Kör tester

```bash
cd services/chat-api
pytest tests/unit -v          # enhetstester (ingen AWS)

# Integrationstester kräver att DynamoDB Local körs
DYNAMO_ENDPOINT=http://localhost:8001 \
AWS_ACCESS_KEY_ID=dummy \
AWS_SECRET_ACCESS_KEY=dummy \
pytest tests/integration -v
```

---

## Driftsätt till AWS

Förutsättningar: AWS CLI konfigurerat, Docker, Node 20, CDK bootstrappat.

```bash
# 1. Bootstrappa CDK (en gång per konto/region)
cd infra
npm ci
npx cdk bootstrap

# 2. Driftsätt alla stackar
npx cdk deploy --all

# Utdata inkluderar: UserPoolId, UserPoolClientId, CognitoDomain, ApiEndpoint, FrontendUrl

# 3. Uppdatera Cognito-appklientens callback-URL till CloudFront-URL:en
# (eller ange den i CDK innan driftsättning)
```

### Miljövariabler (`.env.example`)

| Variabel | Standard | Beskrivning |
|---|---|---|
| `AWS_REGION` | `us-east-1` | AWS-region |
| `DYNAMO_TABLE_NAME` | `chat-service` | Namn på DynamoDB-tabellen |
| `COGNITO_USER_POOL_ID` | — | Cognito user pool-ID |
| `COGNITO_CLIENT_ID` | — | Cognito appklient-ID |
| `COGNITO_REGION` | `us-east-1` | Cognito-region |
| `ALLOWED_MODELS` | Claude Haiku, Sonnet | Kommaseparerade Bedrock-modell-ID:n |
| `REPOSITORY` | `memory` | `memory` eller `dynamo` |
| `PROVIDER` | `fake` | `fake` eller `bedrock` |
| `AUTH_MODE` | `dev` | `dev` (X-Dev-Sub-header) eller `cognito` (JWT) |
| `MAX_MESSAGE_CHARS` | `8000` | Maximal meddelandelängd |

---

## Designval

**DynamoDB med en enda tabell** — all konversations- och meddelandedata lagras under partitionsnycklar av typen `USER#<sub>`, vilket gör alla förfrågningar O(1) per användare utan att åtkomst mellan användare är möjlig på lagringsnivå.

**SSE framför WebSockets** — enklare att implementera och proxa; tillräckligt för ett chattfall där enbart servern skickar data. Fargate (inte Lambda) används för att undvika buffring av svar.

**Gränssnittsfirst-design** — `ConversationRepository` och `LLMProvider` är abstrakta basklasser (ABC:er). CI körs helt mot in-memory-fakes utan AWS-credentials. Verkliga backends kopplas in via konfiguration.

**Owner-sub alltid från JWT** — `owner_sub` extraheras från den verifierade Cognito-JWT:n och är ett obligatoriskt första argument på varje repository-metod. Klientindata kan aldrig påverka vilken användares data som nås.

**Persistens av delvis ström** — `send_message` använder `try/finally` för att lagra de tokens som hunnit ackumuleras, även om klienten kopplar ner innan strömmen är klar.
