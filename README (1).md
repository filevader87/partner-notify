# Partner Notify Web

Production-gated web and API system for constrained STI partner notification.

## Current Contents
- `web`: React web client with public and clinic kiosk modes
- `backend-20260428T174413Z-3-001/backend`: Node.js API for template, Turnstile, rate-limit, idempotency, and Twilio delivery controls
- `WEB_ADOPTION_PLAN.md`: web distribution and operating plan

The iOS source remains in the workspace as archived/non-release code. It is not part of the production launch path.

## Implemented Features
- Prewritten SMS notifications
- No free-text SMS content
- Turnstile-backed abuse gate for the public web flow
- Rate limiting by IP, device hash, and hashed recipient
- Idempotent send requests
- Non-PII delivery ledger records
- Pre-approved DIS-aligned messaging
- Public web message flow
- Clinic tablet/kiosk mode
- Privacy, support, and abuse reporting pages

## Tech Stack
- Node.js (Express)
- Twilio API
- React/Vite
- Cloudflare Turnstile
- Redis-compatible REST store for production rate limits

## Backend Setup
```bash
cd backend-20260428T174413Z-3-001/backend
npm install
npm test
npm start
```

## Web Setup
```bash
cd web
npm install
npm test
npm run dev
```

Open public mode at `http://127.0.0.1:5173/`.

Open clinic kiosk mode at `http://127.0.0.1:5173/?mode=kiosk`.

## iOS Setup
Open `ios/PartnerNotify.xcodeproj` in Xcode on macOS and configure `API_BASE_URL` in `PartnerNotify/Info.plist`.

## Release Warning
Do not publicly launch until Turnstile, Redis rate limiting, approved Twilio sender configuration, privacy/support/abuse routes, and a full production test send are complete.
