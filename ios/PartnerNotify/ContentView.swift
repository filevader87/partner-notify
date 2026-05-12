import SwiftUI

struct ContentView: View {
    @StateObject private var model = NotificationFlowModel(
        apiClient: PartnerNotifyAPIClient(baseURL: AppConfiguration.apiBaseURL),
        deviceIdentityProvider: DeviceIdentityProvider(),
        captchaTokenProvider: ConfiguredCaptchaTokenProvider()
    )
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if model.step != .landing && model.step != .confirmation {
                    ProgressView(value: model.step.progress)
                        .tint(.teal)
                        .padding(.horizontal)
                        .padding(.top, 12)
                }

                Group {
                    switch model.step {
                    case .landing:
                        LandingScreen(start: model.start)
                    case .consent:
                        ConsentScreen(model: model)
                    case .exposure:
                        ExposureScreen(model: model)
                    case .tone:
                        ToneScreen(model: model)
                    case .recipients:
                        RecipientsScreen(model: model)
                    case .review:
                        ReviewScreen(model: model)
                    case .confirmation:
                        ConfirmationScreen(
                            requestId: model.lastRequestId,
                            findTesting: { openURL(AppConfiguration.testingLocatorURL) },
                            reset: model.reset
                        )
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if model.step.rawValue > NotificationStep.landing.rawValue &&
                    model.step.rawValue < NotificationStep.confirmation.rawValue {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            model.back()
                        } label: {
                            Label("Back", systemImage: "chevron.left")
                        }
                    }
                }
            }
            .alert("Action needed", isPresented: Binding(
                get: { model.alertMessage != nil },
                set: { if !$0 { model.dismissAlert() } }
            )) {
                Button("OK", role: .cancel) {
                    model.dismissAlert()
                }
            } message: {
                Text(model.alertMessage ?? "")
            }
        }
    }

    private var navigationTitle: String {
        switch model.step {
        case .landing:
            return "Partner Notify"
        case .consent:
            return "Before You Continue"
        case .exposure:
            return "Exposure Type"
        case .tone:
            return "Message Tone"
        case .recipients:
            return "Recipients"
        case .review:
            return "Review"
        case .confirmation:
            return "Sent"
        }
    }
}

private struct LandingScreen: View {
    let start: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            Spacer()

            Image(systemName: "shield.lefthalf.filled")
                .font(.system(size: 56, weight: .semibold))
                .foregroundStyle(.teal)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 12) {
                Text("Notify a Partner")
                    .font(.system(.largeTitle, design: .rounded, weight: .bold))
                Text("Send a constrained health notification so a recent partner can consider testing and care.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(alignment: .leading, spacing: 12) {
                Label("No contact-book access", systemImage: "person.crop.circle.badge.xmark")
                Label("No custom message text", systemImage: "text.badge.checkmark")
                Label("Phone numbers are only sent to deliver the request", systemImage: "lock.shield")
            }
            .font(.callout)
            .foregroundStyle(.secondary)

            Spacer()

            PrimaryButton(title: "Start", systemImage: "arrow.right", action: start)
        }
        .padding(24)
    }
}

private struct ConsentScreen: View {
    @ObservedObject var model: NotificationFlowModel

    var body: some View {
        FormScreen {
            VStack(alignment: .leading, spacing: 18) {
                Text("This tool sends a prewritten health notice. It is not for threats, harassment, jokes, retaliation, or false reports.")
                    .font(.body)
                    .foregroundStyle(.secondary)

                Toggle(isOn: $model.draft.understandsExposurePurpose) {
                    Text("I understand this is for notifying someone of a possible STI exposure.")
                }

                Toggle(isOn: $model.draft.agreesNoHarassment) {
                    Text("I will not use this to harass someone or send a false notification.")
                }
            }
        } footer: {
            PrimaryButton(title: "Continue", systemImage: "arrow.right", isDisabled: !model.canContinueFromConsent) {
                model.next()
            }
        }
    }
}

private struct ExposureScreen: View {
    @ObservedObject var model: NotificationFlowModel

    var body: some View {
        FormScreen {
            VStack(spacing: 12) {
                ForEach(ExposureType.allCases) { exposureType in
                    SelectionRow(
                        title: exposureType.title,
                        subtitle: exposureType.description,
                        systemImage: exposureType.systemImage,
                        isSelected: model.draft.exposureType == exposureType
                    ) {
                        model.draft.exposureType = exposureType
                    }
                }
            }
        } footer: {
            PrimaryButton(title: "Next", systemImage: "arrow.right") {
                model.next()
            }
        }
    }
}

private struct ToneScreen: View {
    @ObservedObject var model: NotificationFlowModel

    var body: some View {
        FormScreen {
            VStack(alignment: .leading, spacing: 18) {
                Picker("Tone", selection: $model.draft.tone) {
                    ForEach(MessageTone.allCases) { tone in
                        Text(tone.title).tag(tone)
                    }
                }
                .pickerStyle(.segmented)

                VStack(alignment: .leading, spacing: 8) {
                    Label("Preview", systemImage: "message")
                        .font(.headline)
                    Text(model.messagePreview)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        } footer: {
            PrimaryButton(title: "Next", systemImage: "arrow.right") {
                model.next()
            }
        }
    }
}

private struct RecipientsScreen: View {
    @ObservedObject var model: NotificationFlowModel

    var body: some View {
        FormScreen {
            VStack(alignment: .leading, spacing: 16) {
                Text("Enter up to three phone numbers. The app does not access your contacts.")
                    .font(.body)
                    .foregroundStyle(.secondary)

                HStack(spacing: 10) {
                    TextField("Phone number", text: $model.phoneInput)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .submitLabel(.done)
                        .onSubmit(model.addPhoneNumber)
                        .padding(12)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    Button(action: model.addPhoneNumber) {
                        Image(systemName: "plus")
                            .font(.headline)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.teal)
                    .accessibilityLabel("Add phone number")
                }

                if let error = model.phoneInputError {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                VStack(spacing: 8) {
                    ForEach(model.draft.phoneNumbers) { recipient in
                        HStack {
                            Label(recipient.displayValue, systemImage: "phone")
                            Spacer()
                            Button(role: .destructive) {
                                model.removePhoneNumber(recipient)
                            } label: {
                                Image(systemName: "trash")
                            }
                            .accessibilityLabel("Remove \(recipient.displayValue)")
                        }
                        .padding(12)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
        } footer: {
            PrimaryButton(title: "Next", systemImage: "arrow.right", isDisabled: !model.canContinueFromRecipients) {
                model.next()
            }
        }
    }
}

private struct ReviewScreen: View {
    @ObservedObject var model: NotificationFlowModel

    var body: some View {
        FormScreen {
            VStack(alignment: .leading, spacing: 18) {
                ReviewSection(title: "Message", systemImage: "message") {
                    Text(model.messagePreview)
                        .foregroundStyle(.secondary)
                }

                ReviewSection(title: "Recipients", systemImage: "person.2") {
                    ForEach(model.draft.phoneNumbers) { recipient in
                        Text(recipient.displayValue)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        } footer: {
            Button {
                Task { await model.send() }
            } label: {
                HStack {
                    if model.isSending {
                        ProgressView()
                    } else {
                        Image(systemName: "paperplane.fill")
                    }
                    Text(model.isSending ? "Sending" : "Send Notification")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
            }
            .buttonStyle(.borderedProminent)
            .tint(.teal)
            .disabled(model.isSending)
        }
    }
}

private struct ConfirmationScreen: View {
    let requestId: String?
    let findTesting: () -> Void
    let reset: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 64, weight: .semibold))
                .foregroundStyle(.teal)
                .accessibilityHidden(true)

            VStack(spacing: 8) {
                Text("Notification sent")
                    .font(.title.bold())
                Text("The request was accepted by the notification service.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            if let requestId {
                Text("Reference: \(requestId)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }

            Spacer()

            VStack(spacing: 12) {
                PrimaryButton(title: "Find Testing Near You", systemImage: "location.magnifyingglass", action: findTesting)
                SecondaryButton(title: "Start Another", systemImage: "arrow.counterclockwise", action: reset)
            }
        }
        .padding(24)
    }
}

private struct FormScreen<Content: View, Footer: View>: View {
    @ViewBuilder let content: Content
    @ViewBuilder let footer: Footer

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                content
                    .padding(20)
                    .frame(maxWidth: 640, alignment: .center)
            }

            footer
                .padding(20)
                .background(.regularMaterial)
        }
    }
}

private struct SelectionRow: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .frame(width: 28)
                    .foregroundStyle(.teal)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? .teal : .secondary)
            }
            .padding(14)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

private struct ReviewSection<Content: View>: View {
    let title: String
    let systemImage: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: systemImage)
                .font(.headline)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

private struct PrimaryButton: View {
    let title: String
    let systemImage: String
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
        }
        .buttonStyle(.borderedProminent)
        .tint(.teal)
        .disabled(isDisabled)
    }
}

private struct SecondaryButton: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
        }
        .buttonStyle(.bordered)
    }
}

#Preview {
    ContentView()
}
