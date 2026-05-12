import type { ExposureType, MessageTone } from './domain';

export type SendNotificationRequest = {
  phoneNumbers: string[];
  templateType: ExposureType;
  tone: MessageTone;
  captchaToken: string;
  deviceHash: string;
  idempotencyKey: string;
};

export type SendNotificationResponse = {
  success: boolean;
  status: 'accepted' | 'duplicate' | 'partial_failed' | 'failed';
  duplicate: boolean;
  sentCount: number;
  failedCount: number;
  requestId: string;
};

export type TemplateCatalog = {
  version: string;
  templates: Partial<Record<ExposureType, Partial<Record<MessageTone, string>>>>;
};

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class PartnerNotifyApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PartnerNotifyApiError';
    this.code = code;
  }
}

export class PartnerNotifyApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async sendNotification(request: SendNotificationRequest): Promise<SendNotificationResponse> {
    const response = await fetch(`${this.baseUrl}/send`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const errorPayload = payload as ApiErrorEnvelope | null;
      throw new PartnerNotifyApiError(
        errorPayload?.error?.code || 'REQUEST_FAILED',
        errorPayload?.error?.message || 'The notification service could not process this request.'
      );
    }

    return payload as SendNotificationResponse;
  }

  async getTemplates(): Promise<TemplateCatalog> {
    const response = await fetch(`${this.baseUrl}/templates`);
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.templates || !payload?.version) {
      throw new PartnerNotifyApiError('TEMPLATES_UNAVAILABLE', 'Message templates could not be loaded.');
    }

    return payload as TemplateCatalog;
  }
}
