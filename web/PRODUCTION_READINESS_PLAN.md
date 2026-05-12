# Let Them Know Production Readiness Plan

## Objective

Move Let Them Know from a working local web app to a controlled production launch.

This plan addresses each current blocker:

- Real deployed backend URL
- Real Twilio credentials
- `MOCK_SMS_DELIVERY=false`
- Real Turnstile abuse check instead of development defaults
- Backend `ALLOWED_ORIGINS` set to the final web domain
- Centralized rate limiting before scaling
- Privacy policy, support contact, abuse report process
- SMS compliance registration for the sending number

## Release Standard

Production means:

- The public web app is served over HTTPS.
- The backend is served over HTTPS.
- Real SMS delivery works.
- Demo/mock SMS mode is off.
- Abuse controls are active.
- The web origin is locked down.
- Rate limits work across all backend instances.
- Send retries are idempotent.
- Delivery records use hashed recipients, not raw recipient phone numbers.
- Public privacy/support/abuse materials exist.
- SMS sending number is registered and compliant.

Do not publicly launch until every Critical item below is complete.

---

## Phase 1: Decide Final Domains

**Blockers addressed**

- Real deployed backend URL
- Backend `ALLOWED_ORIGINS` set to the final web domain

**Required decisions**

- Public web domain, for example: `https://letthemknow.org`
- API domain, for example: `https://api.letthemknow.org`
- Support email, for example: `support@letthemknow.org`
- Abuse email, for example: `abuse@letthemknow.org`

**Tasks**

1. Buy or assign the final domain.
2. Create DNS records:
   - `letthemknow.org` for the web app.
   - `www.letthemknow.org` if using a `www` redirect.
   - `api.letthemknow.org` for the backend.
3. Confirm HTTPS is available for both web and API.
4. Update web environment:

```bash
VITE_API_BASE_URL=https://api.letthemknow.org
VITE_TURNSTILE_SITE_KEY=<production Turnstile site key>
```

5. Update backend environment:

```bash
ALLOWED_ORIGINS=https://letthemknow.org,https://www.letthemknow.org
```

**Acceptance criteria**

- Web app loads at the final HTTPS domain.
- API `/health` loads at the final HTTPS API domain.
- Browser calls from the web app to `/send` are allowed.
- Browser calls from unlisted origins are blocked by CORS.

**Failure condition**

- Do not launch if `ALLOWED_ORIGINS=*` is used in production.

---

## Phase 2: Deploy Backend

**Blockers addressed**

- Real deployed backend URL
- `MOCK_SMS_DELIVERY=false`

**Recommended deployment target**

Use Render, Fly.io, Railway, or another managed Node host that supports:

- HTTPS
- Environment variables
- Health checks
- Logs
- Autoscaling controls

**Tasks**

1. Deploy `backend-20260428T174413Z-3-001/backend`.
2. Set backend environment:

```bash
NODE_ENV=production
PORT=3000
MOCK_SMS_DELIVERY=false
ALLOWED_ORIGINS=https://letthemknow.org,https://www.letthemknow.org
TWILIO_SID=
TWILIO_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_STATUS_CALLBACK_URL=https://api.letthemknow.org/twilio/status
TURNSTILE_SECRET=
PHONE_HASH_SECRET=
REDIS_REST_URL=
REDIS_REST_TOKEN=
PUBLIC_BASE_URL=https://letthemknow.org
PRIVACY_URL=https://letthemknow.org/privacy
SUPPORT_URL=https://letthemknow.org/support
ABUSE_REPORT_URL=https://letthemknow.org/report-abuse
```

3. Configure health check:

```text
GET /health
```

4. Confirm logs and delivery records do not include raw phone numbers.
5. Confirm `/send` rejects requests with a client-supplied `message` field.
6. Confirm duplicate idempotency keys do not resend SMS.

**Acceptance criteria**

- `GET /health` returns `{"status":"ok"}`.
- Backend starts with `NODE_ENV=production`.
- `MOCK_SMS_DELIVERY=false`.
- Invalid requests return structured errors.
- Logs show request IDs and counts, not phone numbers.
- Delivery records show request IDs, template metadata, hashed recipients, provider SID, and delivery state.

**Failure condition**

- Do not launch if backend sends mock SMS responses in production.

---

## Phase 3: Configure Real SMS Delivery

**Blockers addressed**

- Real Twilio credentials
- SMS compliance registration for the sending number

**Tasks**

1. Create or select a Twilio account owned by the operating organization.
2. Buy or assign a sending number and attach it to a Twilio Messaging Service.
3. Complete required US SMS registration:
   - A2P 10DLC if using a 10DLC number.
   - Toll-free verification if using a toll-free number.
4. Configure required SMS handling:
   - `STOP`
   - `HELP`
   - abuse/support contact
5. Add production credentials to backend:

```bash
TWILIO_SID=<production account sid>
TWILIO_TOKEN=<production auth token>
TWILIO_MESSAGING_SERVICE_SID=<approved messaging service sid>
TWILIO_STATUS_CALLBACK_URL=https://api.letthemknow.org/twilio/status
```

6. Send test messages to internal test phones only.
7. Confirm the received SMS text matches backend templates.
8. Confirm status callbacks update provider status records without storing raw phone numbers.

**Acceptance criteria**

- Twilio registration status is approved.
- Test SMS sends successfully.
- Received text does not include free-form user text.
- `STOP` works.
- `HELP` returns useful support information.

**Failure condition**

- Do not launch with an unregistered number or trial Twilio account.

---

## Phase 4: Replace Development Abuse Check

**Blockers addressed**

- Real abuse check instead of dev captcha token

**Minimum acceptable approach**

Use Cloudflare Turnstile.

**Better later approach**

For higher-trust clinic deployments, add clinic-issued session codes or organization-issued links.

**Tasks**

1. Create Cloudflare Turnstile site key and secret.
2. Add the Turnstile widget or invisible challenge to the web app.
3. Set `VITE_TURNSTILE_SITE_KEY` in production builds.
4. Set backend:

```bash
TURNSTILE_SECRET=<production secret>
```

5. Confirm backend rejects missing, invalid, and expired tokens.
6. Confirm backend accepts valid tokens.

**Acceptance criteria**

- Public send attempts require a valid challenge token.
- Invalid tokens return `CAPTCHA_FAILED` or equivalent.
- Production frontend does not ship a hardcoded captcha token.

**Failure condition**

- Do not launch if a send can bypass a valid Turnstile token.

---

## Phase 5: Add Centralized Rate Limiting

**Blockers addressed**

- Centralized rate limiting before scaling

**Recommended store**

Use Redis, Upstash Redis, or another managed low-latency key/value store.

**Rate limits to enforce**

- Per device hash.
- Per IP address.
- Per recipient phone number hash.
- Per organization or clinic session later.

**Tasks**

1. Add Redis connection settings:

```bash
REDIS_URL=
```

2. Replace the in-memory rate limiter with a Redis-backed limiter.
3. Store only hashed rate-limit keys.
4. Preserve current limit behavior:
   - max 5 sends per device per 24 hours
   - max 3 recipients per request
   - recipient-hash limits across devices
5. Add tests for:
   - allowed first request
   - blocked request after limit
   - TTL expiry
   - Redis unavailable behavior

**Acceptance criteria**

- Rate limits work across two backend instances.
- Redis keys do not contain raw phone numbers.
- Backend fails closed or degrades safely if Redis is unavailable.

**Failure condition**

- Do not run more than one backend instance with only in-memory rate limiting.

---

## Phase 6: Publish Privacy, Support, and Abuse Process

**Blockers addressed**

- Privacy policy
- Support contact
- Abuse report process

**Required public pages**

- `/privacy`
- `/support`
- `/report-abuse`

**Privacy policy must state**

- What data is sent.
- What data is stored.
- Whether phone numbers are stored.
- How long request metadata is retained.
- Who operates the service.
- How to contact support.
- How to report misuse.

**Support page must include**

- What the service does.
- What the service does not do.
- How to get STI testing.
- How to report a harmful or false message.
- How recipients can request help.

**Abuse process must include**

- Intake email or form.
- Blocklist process.
- Review owner.
- Response SLA.
- Escalation process for serious threats.

**Acceptance criteria**

- Privacy, support, and abuse pages are live before launch.
- SMS messages link to a support or information page if message length allows.
- Support inbox works.
- Abuse inbox works.
- Someone is assigned to review reports.

**Failure condition**

- Do not launch without a real support and abuse contact.

---

## Phase 7: Deploy Web App

**Blockers addressed**

- Real deployed backend URL
- Backend `ALLOWED_ORIGINS`

**Tasks**

1. Deploy `web` as a static app.
2. Set production environment:

```bash
VITE_API_BASE_URL=https://api.letthemknow.org
VITE_TURNSTILE_SITE_KEY=<production Turnstile site key>
```

3. Confirm `vercel.json` headers are active if deploying on Vercel.
4. Test:
   - `/`
   - `/?mode=kiosk`
   - `/manifest.webmanifest`
   - `/favicon.svg`
5. Confirm the web app can call the production API.

**Acceptance criteria**

- Public mode loads on mobile and desktop.
- Kiosk mode loads on tablet.
- The app can complete a test send using production backend.
- Security headers are present.
- Browser console has no app errors.

**Failure condition**

- Do not launch if production web still points to localhost or a staging API.

---

## Phase 8: End-to-End Launch Test

**Tasks**

1. Use a test phone number controlled by the team.
2. Complete public flow from the production web domain.
3. Complete kiosk flow from the production web domain.
4. Confirm SMS delivery.
5. Confirm received SMS text.
6. Confirm support and abuse links/contact routes.
7. Confirm logs contain no raw phone numbers.
8. Confirm rate limits block repeated attempts.

**Acceptance criteria**

- Public flow succeeds.
- Kiosk flow succeeds.
- SMS is delivered.
- Rate limits work.
- Abuse/support process is reachable.
- No raw phone numbers appear in logs.

---

## Production Launch Decision

Launch only when all Critical items are complete:

- Backend HTTPS URL live.
- Web HTTPS URL live.
- Twilio credentials configured.
- SMS registration approved.
- `MOCK_SMS_DELIVERY=false`.
- Real abuse check active.
- `ALLOWED_ORIGINS` locked to the final domain.
- Centralized Redis rate limiting active.
- Idempotent send retries verified.
- Privacy/support/abuse pages live.
- End-to-end production test passes.

## Recommended Order

1. Finalize domains.
2. Deploy backend.
3. Complete Twilio registration.
4. Add real abuse check.
5. Add centralized rate limiting.
6. Publish privacy/support/abuse pages.
7. Deploy web app.
8. Run end-to-end launch test.
