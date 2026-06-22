import Foundation

protocol PartnerNotifyAPI {
    func sendNotification(_ request: SendNotificationRequest) async throws -> SendNotificationResponse
}

struct SendNotificationRequest: Encodable {
    let phoneNumbers: [String]
    let templateType: ExposureType
    let tone: MessageTone
    let captchaToken: String
    let deviceHash: String
}

struct SendNotificationResponse: Decodable, Equatable {
    let success: Bool
    let sentCount: Int
    let requestId: String
}

enum PartnerNotifyAPIError: LocalizedError, Equatable {
    case invalidResponse
    case server(code: String, message: String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server returned an invalid response."
        case let .server(_, message):
            return message
        case let .transport(message):
            return message
        }
    }
}

final class PartnerNotifyAPIClient: PartnerNotifyAPI {
    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func sendNotification(_ request: SendNotificationRequest) async throws -> SendNotificationResponse {
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent("send"))
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
        urlRequest.httpBody = try encoder.encode(request)
        urlRequest.timeoutInterval = 20

        do {
            let (data, response) = try await session.data(for: urlRequest)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw PartnerNotifyAPIError.invalidResponse
            }

            switch httpResponse.statusCode {
            case 200..<300:
                return try decoder.decode(SendNotificationResponse.self, from: data)
            default:
                if let envelope = try? decoder.decode(APIErrorEnvelope.self, from: data) {
                    throw PartnerNotifyAPIError.server(code: envelope.error.code, message: envelope.error.message)
                }
                throw PartnerNotifyAPIError.invalidResponse
            }
        } catch let error as PartnerNotifyAPIError {
            throw error
        } catch {
            throw PartnerNotifyAPIError.transport(error.localizedDescription)
        }
    }
}

private struct APIErrorEnvelope: Decodable {
    let error: APIErrorBody
}

private struct APIErrorBody: Decodable {
    let code: String
    let message: String
}
