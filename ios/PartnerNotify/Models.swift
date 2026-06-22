import Foundation

enum ExposureType: String, CaseIterable, Codable, Identifiable {
    case sti = "STI"
    case syphilis = "SYPHILIS"
    case hiv = "HIV"
    case other = "OTHER"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .sti:
            return "General STI"
        case .syphilis:
            return "Syphilis"
        case .hiv:
            return "HIV"
        case .other:
            return "Other or unsure"
        }
    }

    var description: String {
        switch self {
        case .sti:
            return "Use when a specific infection does not need to be named."
        case .syphilis:
            return "Use when syphilis exposure is the reason for notification."
        case .hiv:
            return "Use when HIV exposure is the reason for notification."
        case .other:
            return "Use when the exact infection is unknown or not listed."
        }
    }

    var systemImage: String {
        switch self {
        case .sti:
            return "cross.case"
        case .syphilis:
            return "stethoscope"
        case .hiv:
            return "heart.text.square"
        case .other:
            return "questionmark.circle"
        }
    }
}

enum MessageTone: String, CaseIterable, Codable, Identifiable {
    case neutral = "NEUTRAL"
    case supportive = "SUPPORTIVE"
    case direct = "DIRECT"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .neutral:
            return "Neutral"
        case .supportive:
            return "Supportive"
        case .direct:
            return "Direct"
        }
    }
}

struct RecipientPhone: Identifiable, Equatable {
    let id: UUID
    let e164: String

    init(id: UUID = UUID(), e164: String) {
        self.id = id
        self.e164 = e164
    }

    var displayValue: String {
        guard e164.hasPrefix("+1"), e164.count == 12 else {
            return e164
        }

        let digits = String(e164.dropFirst(2))
        let area = digits.prefix(3)
        let prefix = digits.dropFirst(3).prefix(3)
        let line = digits.suffix(4)
        return "(\(area)) \(prefix)-\(line)"
    }
}

struct NotificationDraft: Equatable {
    var understandsExposurePurpose = false
    var agreesNoHarassment = false
    var exposureType: ExposureType = .sti
    var tone: MessageTone = .neutral
    var phoneNumbers: [RecipientPhone] = []

    var hasConsent: Bool {
        understandsExposurePurpose && agreesNoHarassment
    }
}

enum MessageTemplatePreview {
    static func text(for exposureType: ExposureType, tone: MessageTone) -> String {
        templates[exposureType]?[tone] ?? templates[.sti]![.neutral]!
    }

    private static let templates: [ExposureType: [MessageTone: String]] = [
        .sti: [
            .neutral: "Someone you had sexual contact with recently has reported a possible STI exposure. Consider getting tested and contacting a health care provider or local health department.",
            .supportive: "Health notice: you may have been exposed to an STI. Testing is a practical next step, and treatment is available.",
            .direct: "You may have been exposed to an STI. Please consider getting tested and contacting a health care provider or local health department."
        ],
        .syphilis: [
            .neutral: "Someone you had sexual contact with recently has reported a possible syphilis exposure. Syphilis is treatable. Consider getting tested.",
            .supportive: "Health notice: you may have been exposed to syphilis. Testing and treatment are available.",
            .direct: "You may have been exposed to syphilis. Please consider getting tested and contacting a health care provider or local health department."
        ],
        .hiv: [
            .neutral: "Someone you had sexual contact with recently has reported a possible HIV exposure. Consider HIV testing and contacting a health care provider.",
            .supportive: "Health notice: you may have been exposed to HIV. Testing, prevention, and care options are available.",
            .direct: "You may have been exposed to HIV. Please consider HIV testing and contacting a health care provider or local health department."
        ],
        .other: [
            .neutral: "Someone you had sexual contact with recently has reported a possible STI exposure. Consider getting tested.",
            .supportive: "Health notice: you may have been exposed to an STI. Testing is a practical next step.",
            .direct: "You may have been exposed to an STI. Please consider getting tested and contacting a health care provider or local health department."
        ]
    ]
}
