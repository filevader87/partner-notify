import Foundation

enum AppConfiguration {
    static var apiBaseURL: URL {
        if let value = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           let url = URL(string: value),
           !value.isEmpty {
            return url
        }

        return URL(string: "https://api.partnernotify.app")!
    }

    static var captchaDevelopmentToken: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "CAPTCHA_DEVELOPMENT_TOKEN") as? String,
              !value.isEmpty else {
            return nil
        }
        return value
    }

    static var testingLocatorURL: URL {
        URL(string: "https://gettested.cdc.gov/")!
    }
}
