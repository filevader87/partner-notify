# Let Them Know Web

Web client for sending simple STI health messages.

## Modes

- Public mode: `/`
- Clinic kiosk mode: `/?mode=kiosk`

Both modes use the same send contract and server-selected templates. Kiosk mode changes the framing and staff workflow guidance, not the notification rules.

## Local Development

```bash
npm install
npm test
npm run dev
```

Create `.env.local` when targeting a deployed backend:

```bash
VITE_API_BASE_URL=https://api.partnernotify.app
VITE_TURNSTILE_SITE_KEY=
```

Development uses Cloudflare Turnstile's public test site key when `VITE_TURNSTILE_SITE_KEY` is omitted. Production must set a real site key.

## Backend Contract

The client sends:

```json
{
  "phoneNumbers": ["+12035551234"],
  "templateType": "STI",
  "tone": "NEUTRAL",
  "captchaToken": "captcha-token",
  "deviceHash": "sha256-installation-hash",
  "idempotencyKey": "uuid"
}
```

The client never sends a message body.

## Deployment Notes

- Deploy as a static site behind HTTPS.
- Configure `VITE_API_BASE_URL` at build time.
- Add a real captcha/App Attest equivalent before broad public access.
- Use `/?mode=kiosk` on clinic tablets.
- Configure browser or MDM policy to clear site data between kiosk sessions when possible.
- `vercel.json` includes baseline security headers for a Vercel static deployment.
- Review `PRODUCTION_CHECKLIST.md` before public launch.
