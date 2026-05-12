import XCTest
@testable import PartnerNotify

final class PhoneNumberValidatorTests: XCTestCase {
    func testNormalizeAcceptsTenDigitUSNumber() throws {
        XCTAssertEqual(try PhoneNumberValidator.normalize("(203) 555-1234"), "+12035551234")
    }

    func testNormalizeAcceptsExistingE164Number() throws {
        XCTAssertEqual(try PhoneNumberValidator.normalize("+44 20 7183 8750"), "+442071838750")
    }

    func testNormalizeRejectsEmptyInput() {
        XCTAssertThrowsError(try PhoneNumberValidator.normalize("")) { error in
            XCTAssertEqual(error as? PhoneNumberValidationError, .empty)
        }
    }

    func testNormalizeRejectsInvalidShortNumber() {
        XCTAssertThrowsError(try PhoneNumberValidator.normalize("555-1234")) { error in
            XCTAssertEqual(error as? PhoneNumberValidationError, .invalid)
        }
    }
}
