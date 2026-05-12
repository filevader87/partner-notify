import XCTest
@testable import PartnerNotify

@MainActor
final class NotificationFlowModelTests: XCTestCase {
    func testSendBuildsConstrainedRequest() async {
        let api = RecordingAPIClient()
        let model = NotificationFlowModel(
            apiClient: api,
            deviceIdentityProvider: StubDeviceIdentityProvider(deviceHashValue: String(repeating: "a", count: 64)),
            captchaTokenProvider: StubCaptchaTokenProvider(tokenValue: "captcha-ok")
        )

        model.draft.exposureType = .hiv
        model.draft.tone = .direct
        model.draft.phoneNumbers = [RecipientPhone(e164: "+12035551234")]

        await model.send()

        XCTAssertEqual(api.lastRequest?.phoneNumbers, ["+12035551234"])
        XCTAssertEqual(api.lastRequest?.templateType, .hiv)
        XCTAssertEqual(api.lastRequest?.tone, .direct)
        XCTAssertEqual(api.lastRequest?.captchaToken, "captcha-ok")
        XCTAssertEqual(api.lastRequest?.deviceHash, String(repeating: "a", count: 64))
    }
}

private final class RecordingAPIClient: PartnerNotifyAPI {
    private(set) var lastRequest: SendNotificationRequest?

    func sendNotification(_ request: SendNotificationRequest) async throws -> SendNotificationResponse {
        lastRequest = request
        return SendNotificationResponse(success: true, sentCount: request.phoneNumbers.count, requestId: "request-id")
    }
}

private struct StubDeviceIdentityProvider: DeviceIdentityProviding {
    private let deviceHashValue: String

    init(deviceHashValue: String) {
        self.deviceHashValue = deviceHashValue
    }

    func deviceHash() throws -> String {
        deviceHashValue
    }
}

private struct StubCaptchaTokenProvider: CaptchaTokenProviding {
    let tokenValue: String

    func token() async throws -> String {
        tokenValue
    }
}
