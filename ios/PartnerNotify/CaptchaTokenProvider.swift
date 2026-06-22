import Foundation

protocol CaptchaTokenProviding {
    func token() async throws -> String
}

enum CaptchaTokenError: LocalizedError {
    case missingProductionProvider

    var errorDescription: String? {
        switch self {
        case .missingProductionProvider:
            return "Human verification is not configured for this build."
        }
    }
}

struct ConfiguredCaptchaTokenProvider: CaptchaTokenProviding {
    func token() async throws -> String {
        if let developmentToken = AppConfiguration.captchaDevelopmentToken {
            return developmentToken
        }

        throw CaptchaTokenError.missingProductionProvider
    }
}
