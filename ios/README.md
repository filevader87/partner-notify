# Partner Notify iOS

Archived SwiftUI client for constrained STI partner notification.

The production launch path is the web app plus backend API. This iOS project is retained for reference and is not part of the current release plan.

## Open

Open `PartnerNotify.xcodeproj` in Xcode on macOS.

## Required configuration

Update `PartnerNotify/Info.plist` before release:

- `API_BASE_URL`: deployed backend URL.
- `CAPTCHA_DEVELOPMENT_TOKEN`: leave empty for release builds.

The current client includes a `CaptchaTokenProviding` boundary, but the included implementation is development-only. Do not submit or distribute this client without a separate production hardening plan.

## Tests

The project includes XCTest coverage for phone normalization and send request construction. Run from macOS:

```bash
xcodebuild test -project PartnerNotify.xcodeproj -scheme PartnerNotify -destination 'platform=iOS Simulator,name=iPhone 16'
```

## Privacy posture

- The app does not request Contacts access.
- Recipient phone numbers are entered manually and kept only in current SwiftUI state before submission.
- The app sends only recipient phone numbers, selected template type, selected tone, captcha token, and a one-way hash of an installation secret.
- The app does not collect diagnosis records, test results, address-book contacts, photos, location, or analytics.
