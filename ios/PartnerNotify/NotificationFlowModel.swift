import Foundation

enum NotificationStep: Int, CaseIterable {
    case landing
    case consent
    case exposure
    case tone
    case recipients
    case review
    case confirmation

    var progress: Double {
        Double(rawValue + 1) / Double(Self.allCases.count)
    }
}

@MainActor
final class NotificationFlowModel: ObservableObject {
    @Published private(set) var step: NotificationStep = .landing
    @Published var draft = NotificationDraft()
    @Published var phoneInput = ""
    @Published private(set) var phoneInputError: String?
    @Published private(set) var isSending = false
    @Published private(set) var alertMessage: String?
    @Published private(set) var lastRequestId: String?

    private let apiClient: PartnerNotifyAPI
    private let deviceIdentityProvider: DeviceIdentityProviding
    private let captchaTokenProvider: CaptchaTokenProviding

    init(
        apiClient: PartnerNotifyAPI,
        deviceIdentityProvider: DeviceIdentityProviding,
        captchaTokenProvider: CaptchaTokenProviding
    ) {
        self.apiClient = apiClient
        self.deviceIdentityProvider = deviceIdentityProvider
        self.captchaTokenProvider = captchaTokenProvider
    }

    var messagePreview: String {
        MessageTemplatePreview.text(for: draft.exposureType, tone: draft.tone)
    }

    var canContinueFromConsent: Bool {
        draft.hasConsent
    }

    var canContinueFromRecipients: Bool {
        !draft.phoneNumbers.isEmpty
    }

    func start() {
        step = .consent
    }

    func next() {
        guard let nextStep = NotificationStep(rawValue: step.rawValue + 1) else {
            return
        }
        step = nextStep
    }

    func back() {
        guard let previousStep = NotificationStep(rawValue: step.rawValue - 1) else {
            return
        }
        step = previousStep
    }

    func addPhoneNumber() {
        do {
            let normalized = try PhoneNumberValidator.normalize(phoneInput)
            guard !draft.phoneNumbers.contains(where: { $0.e164 == normalized }) else {
                phoneInputError = "This recipient is already added."
                return
            }
            draft.phoneNumbers.append(RecipientPhone(e164: normalized))
            phoneInput = ""
            phoneInputError = nil
        } catch {
            phoneInputError = error.localizedDescription
        }
    }

    func removePhoneNumber(_ recipient: RecipientPhone) {
        draft.phoneNumbers.removeAll { $0.id == recipient.id }
    }

    func send() async {
        guard !isSending else {
            return
        }

        isSending = true
        defer { isSending = false }

        do {
            let request = SendNotificationRequest(
                phoneNumbers: draft.phoneNumbers.map(\.e164),
                templateType: draft.exposureType,
                tone: draft.tone,
                captchaToken: try await captchaTokenProvider.token(),
                deviceHash: try deviceIdentityProvider.deviceHash()
            )
            let response = try await apiClient.sendNotification(request)
            lastRequestId = response.requestId
            step = .confirmation
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    func dismissAlert() {
        alertMessage = nil
    }

    func reset() {
        draft = NotificationDraft()
        phoneInput = ""
        phoneInputError = nil
        lastRequestId = nil
        step = .landing
    }
}
