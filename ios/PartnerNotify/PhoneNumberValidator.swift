import Foundation

enum PhoneNumberValidationError: LocalizedError, Equatable {
    case empty
    case invalid

    var errorDescription: String? {
        switch self {
        case .empty:
            return "Enter a phone number."
        case .invalid:
            return "Enter a valid phone number, including area code."
        }
    }
}

enum PhoneNumberValidator {
    private static let e164Pattern = #"^\+[1-9]\d{7,14}$"#

    static func normalize(_ input: String, defaultCountryCode: String = "1") throws -> String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmed.isEmpty {
            throw PhoneNumberValidationError.empty
        }

        let normalized: String
        if trimmed.hasPrefix("+") {
            let digits = trimmed.dropFirst().filter(\.isNumber)
            normalized = "+\(digits)"
        } else {
            let digits = trimmed.filter(\.isNumber)
            if defaultCountryCode == "1", digits.count == 10 {
                normalized = "+1\(digits)"
            } else if defaultCountryCode == "1", digits.count == 11, digits.hasPrefix("1") {
                normalized = "+\(digits)"
            } else {
                normalized = "+\(defaultCountryCode)\(digits)"
            }
        }

        guard normalized.range(of: e164Pattern, options: .regularExpression) != nil else {
            throw PhoneNumberValidationError.invalid
        }

        return normalized
    }
}
