# Let Them Know Production Checklist

## Current Status

The web app is deployable as a static site. It is not production-ready for public use until the backend and operations items below are complete.

Use `PRODUCTION_READINESS_PLAN.md` for the step-by-step plan to close each blocker.

## Must Be Done Before Public Launch

- Deploy the backend over HTTPS.
- Set `VITE_API_BASE_URL` to the deployed backend URL.
- Set backend `ALLOWED_ORIGINS` to the exact web domain.
- Set `MOCK_SMS_DELIVERY=false`.
- Configure valid Twilio credentials and `TWILIO_MESSAGING_SERVICE_SID`.
- Complete SMS compliance registration for the sending number.
- Configure production Cloudflare Turnstile site key and secret.
- Configure Redis REST rate limiting.
- Set `PHONE_HASH_SECRET` to a high-entropy secret.
- Set `PUBLIC_BASE_URL`, `PRIVACY_URL`, `SUPPORT_URL`, and `ABUSE_REPORT_URL`.
- Publish privacy policy, support contact, and abuse report instructions.
- Decide how long request metadata is kept and document the retention period.
- Run a Twilio status callback test against `/twilio/status`.
- Test public flow and kiosk flow on iPhone Safari, Android Chrome, desktop Chrome, and clinic tablet hardware.

## Should Be Done Before Clinic Rollout

- Create a clinic tablet reset process.
- Use browser or MDM settings to clear site data between sessions.
- Add clinic-specific QR codes for `/` and `/?mode=kiosk`.
- Train staff to explain that the message does not say the recipient has an STI.
- Create an abuse/blocklist review process.
- Confirm clinic tablets clear browser local storage between sessions.

## Do Not Add

- Contact-book import.
- Free-text message fields.
- Accounts for public users.
- Diagnosis certainty language.
- Analytics that collect phone numbers or health message choices.
