# Let Them Know Backend

Constrained SMS delivery API for the iOS app.

## Run locally

```bash
npm install
npm test
npm start
```

Local development accepts Cloudflare Turnstile's public test token behavior when `TURNSTILE_SECRET` is not set. Production rejects startup unless captcha verification is configured.

## Environment

- `PORT`: API port. Defaults to `3000`.
- `NODE_ENV`: use `production` in deployed environments.
- `TWILIO_SID`: Twilio account SID.
- `TWILIO_TOKEN`: Twilio auth token.
- `TWILIO_MESSAGING_SERVICE_SID`: Twilio Messaging Service SID. Use this instead of a raw sending number for production.
- `TWILIO_STATUS_CALLBACK_URL`: public status callback endpoint, usually `/twilio/status`.
- `TURNSTILE_SECRET`: Cloudflare Turnstile secret for abuse prevention.
- `ALLOWED_ORIGINS`: comma-separated web origins allowed to call the API.
- `MOCK_SMS_DELIVERY`: set to `true` only for local demos or non-production QA.
- `OPERATOR_NAME`: accountable service operator name.
- `PUBLIC_BASE_URL`, `PRIVACY_URL`, `SUPPORT_URL`, `ABUSE_REPORT_URL`: public trust and support URLs.
- `PHONE_HASH_SECRET`: HMAC secret for non-PII recipient hashes.
- `REDIS_REST_URL`, `REDIS_REST_TOKEN`: Redis-compatible REST store for production rate limits.

## Contract

`POST /send`

```json
{
  "phoneNumbers": ["+12035551234"],
  "templateType": "STI",
  "tone": "NEUTRAL",
  "captchaToken": "captcha-token",
  "deviceHash": "64-character-sha256-hex",
  "idempotencyKey": "11111111-1111-4111-8111-111111111111"
}
```

The API rejects any client-supplied `message` field. SMS bodies are selected from server-owned templates only.

## Production Gaps

Live launch still depends on external Twilio approval, support/abuse inbox operation, and a successful production end-to-end send/status-callback test.
