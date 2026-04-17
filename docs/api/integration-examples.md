# Integration API Examples

Base URL for local development:

```bash
BASE_URL=http://localhost:3003
TOKEN=test-integration-key
```

All integration endpoints require:

```http
Authorization: Bearer <INTEGRATION_API_KEY>
```

Integration API responses use the shared envelope:

```json
{
  "status": "ok",
  "message": "optional message",
  "data": {}
}
```

Status values follow the business-management convention: `ok`, `created`, `updated`, `failed`, and `not_found`.

## 1. Upsert Evaluation Session

Check API health first:

```bash
curl "$BASE_URL/api/v1/integration/health" \
  -H "Authorization: Bearer $TOKEN"
```

```bash
curl -X PUT "$BASE_URL/api/v1/integration/sessions/ext-notice-2026-001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "2026 External Support Program",
    "description": "Synchronized from the business-management system",
    "committeeSize": 5,
    "trimRule": "exclude_min_max"
  }'
```

## 2. Upsert Applications

```bash
curl -X PUT "$BASE_URL/api/v1/integration/sessions/ext-notice-2026-001/applications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applications": [
      {
        "externalApplicationId": "ext-application-0001",
        "evaluationOrder": 1,
        "notes": "Initial sync",
        "company": {
          "externalCompanyId": "ext-company-0001",
          "name": "Example Company",
          "businessNumber": "123-45-67890",
          "ceoName": "Example CEO",
          "phone": "02-1234-5678",
          "email": "contact@example.com",
          "address": "Seoul",
          "industry": "AI"
        }
      }
    ]
  }'
```

## 3. Upload Application PDF

Use `Idempotency-Key` for retry-safe uploads. Reusing the same key for the same application returns the original document.
PDF uploads are limited to 50MB.

```bash
curl -X POST "$BASE_URL/api/v1/integration/applications/ext-application-0001/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: ext-application-0001-business-plan-v1" \
  -F "docType=business_plan" \
  -F "file=@business-plan.pdf;type=application/pdf"
```

## 4. Read Results

```bash
curl "$BASE_URL/api/v1/integration/sessions/ext-notice-2026-001/results" \
  -H "Authorization: Bearer $TOKEN"
```

The `selected` field is `true` when the application rank is 1, 2, or 3.

## 5. Replay Webhook

Webhook delivery records can be replayed by event id.

```bash
curl -X POST "$BASE_URL/api/v1/integration/webhooks/evaluation.finalized:ext-notice-2026-001:2026-04-16T00%3A00%3A00.000Z/replay" \
  -H "Authorization: Bearer $TOKEN"
```

## Finalized Webhook

When a session is finalized, the app sends a `POST` to `INTEGRATION_WEBHOOK_URL`.

Headers:

```http
Content-Type: application/json
X-Event-Id: evaluation.finalized:<sessionId>:<finalizedAt>
X-Signature: sha256=<hmac>
```

`X-Signature` is an HMAC-SHA256 over the raw JSON body using `INTEGRATION_WEBHOOK_HMAC_SECRET`; if unset, `AUTH_SECRET` is used.
The receiver must store `X-Event-Id` and ignore duplicate event ids so retries do not update the same support case more than once.

Payload:

```json
{
  "eventId": "evaluation.finalized:ext-notice-2026-001:2026-04-16T00:00:00.000Z",
  "event": "evaluation.finalized",
  "sessionId": "ext-notice-2026-001",
  "title": "2026 External Support Program",
  "status": "finalized",
  "finalizedAt": "2026-04-16T00:00:00.000Z",
  "selectedApplications": [
    {
      "applicationId": "ext-application-0001",
      "companyName": "Example Company",
      "rank": 1,
      "finalScore": 94.5
    }
  ]
}
```

## Deployment Checklist

```bash
DATABASE_URL=<production-db-url> npm run db:migrate:deploy
npm run db:generate
npm run build
```

Required environment variables for production:

```bash
INTEGRATION_API_KEY=<strong random token>
INTEGRATION_WEBHOOK_URL=<business-management callback URL>
INTEGRATION_WEBHOOK_HMAC_SECRET=<strong random secret>
AUTH_SECRET=<strong random secret>
```
