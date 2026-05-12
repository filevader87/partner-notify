# Web Adoption Plan

## Overall Assessment

The web version is the correct adoption surface. It avoids mobile app store dependency, supports mobile browsers immediately, and can be distributed through QR codes, clinic workflows, lab portals, public health pages, and outreach materials.

## Primary Channels

1. Clinic visit handoff: staff provides QR code during STI counseling.
2. Lab/result portal link: patient sees "Notify partners" beside result follow-up instructions.
3. Public health page: health department hosts or links to the service.
4. Outreach/event tablet: kiosk mode on staff-supervised clinic tablets.

## Required Operating Controls

- Abuse report contact visible on the public site and SMS landing page.
- Centralized rate limiting across backend instances.
- Production captcha or device attestation.
- A2P 10DLC or toll-free registration for SMS deliverability.
- Privacy policy and terms.
- Retention policy for request metadata.
- Staff SOP for kiosk sessions.

## What To Avoid

- Do not market this as anonymous texting.
- Do not request contact-book access.
- Do not add free-form message fields.
- Do not add accounts unless a clinic admin layer requires them.
- Do not imply confirmed exposure or diagnosis.
- Do not store recipient phone numbers beyond what is required for delivery and abuse controls.

## Next Product Layer

The next commercially useful layer is a clinic/public-health admin portal:

- QR session generation.
- Organization-approved templates.
- Aggregate, non-PII volume reporting.
- Blocklist and abuse review.
- Staff training checklist.
- Organization-specific privacy/support links.
