import CryptoKit
import Foundation
import Security

enum DeviceIdentityError: LocalizedError {
    case keychainReadFailed
    case keychainWriteFailed

    var errorDescription: String? {
        switch self {
        case .keychainReadFailed:
            return "Could not read the device notification key."
        case .keychainWriteFailed:
            return "Could not save the device notification key."
        }
    }
}

protocol DeviceIdentityProviding {
    func deviceHash() throws -> String
}

final class DeviceIdentityProvider: DeviceIdentityProviding {
    private let account = "partnernotify.installation-secret"
    private let service = "app.partnernotify"

    func deviceHash() throws -> String {
        let secret = try existingSecret() ?? createSecret()
        let digest = SHA256.hash(data: Data(secret.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private func existingSecret() throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8) else {
            throw DeviceIdentityError.keychainReadFailed
        }

        return value
    }

    private func createSecret() throws -> String {
        let secret = UUID().uuidString + "." + UUID().uuidString
        let data = Data(secret.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw DeviceIdentityError.keychainWriteFailed
        }

        return secret
    }
}
