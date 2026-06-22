export type ExposureType = 'STI' | 'SYPHILIS' | 'HIV' | 'OTHER';
export type MessageTone = 'NEUTRAL' | 'SUPPORTIVE' | 'DIRECT';
export type AppMode = 'public' | 'kiosk';
export type TemplateCatalog = {
  version: string;
  templates: Partial<Record<ExposureType, Partial<Record<MessageTone, string>>>>;
};

export type NotificationDraft = {
  consentExposure: boolean;
  consentNoHarassment: boolean;
  exposureType: ExposureType;
  tone: MessageTone;
  phoneNumbers: string[];
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export const exposureOptions: Array<{
  value: ExposureType;
  label: string;
  description: string;
}> = [
  {
    value: 'STI',
    label: 'General STI',
    description: 'Use when a specific infection does not need to be named.'
  },
  {
    value: 'SYPHILIS',
    label: 'Syphilis',
    description: 'Use when the message is about syphilis.'
  },
  {
    value: 'HIV',
    label: 'HIV',
    description: 'Use when the message is about HIV.'
  },
  {
    value: 'OTHER',
    label: 'Other or unsure',
    description: 'Use when you are not sure or do not see the STI listed.'
  }
];

export const toneOptions: Array<{
  value: MessageTone;
  label: string;
}> = [
  { value: 'NEUTRAL', label: 'Neutral' },
  { value: 'SUPPORTIVE', label: 'Supportive' },
  { value: 'DIRECT', label: 'Direct' }
];

const e164PhonePattern = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneNumber(input: string, defaultCountryCode = '1'): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('Enter a phone number.');
  }

  let normalized: string;
  if (trimmed.startsWith('+')) {
    normalized = `+${trimmed.slice(1).replace(/\D/g, '')}`;
  } else {
    const digits = trimmed.replace(/\D/g, '');
    if (defaultCountryCode === '1' && digits.length === 10) {
      normalized = `+1${digits}`;
    } else if (defaultCountryCode === '1' && digits.length === 11 && digits.startsWith('1')) {
      normalized = `+${digits}`;
    } else if (defaultCountryCode === '1') {
      throw new Error('Enter a valid phone number, including area code.');
    } else {
      normalized = `+${defaultCountryCode}${digits}`;
    }
  }

  if (!e164PhonePattern.test(normalized)) {
    throw new Error('Enter a valid phone number, including area code.');
  }

  return normalized;
}

export function formatPhoneNumber(e164: string): string {
  if (e164.startsWith('+1') && e164.length === 12) {
    const digits = e164.slice(2);
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return e164;
}

export function getTemplatePreviewFromCatalog(
  catalog: TemplateCatalog | null,
  exposureType: ExposureType,
  tone: MessageTone
): string {
  return catalog?.templates[exposureType]?.[tone] || '';
}

export function getAppMode(url: URL): AppMode {
  return url.searchParams.get('mode') === 'kiosk' ? 'kiosk' : 'public';
}

export function validateNotificationDraft(draft: NotificationDraft): ValidationResult {
  if (!draft.consentExposure || !draft.consentNoHarassment) {
    return { valid: false, reason: 'Complete the consent checks before sending.' };
  }

  if (draft.phoneNumbers.length === 0) {
    return { valid: false, reason: 'Add at least one recipient phone number.' };
  }

  if (draft.phoneNumbers.length > 3) {
    return { valid: false, reason: 'Send to no more than three recipients at a time.' };
  }

  return { valid: true };
}

export function isSendDisabled(
  draft: NotificationDraft,
  turnstileToken: string,
  isSending: boolean,
  templatesLoaded: boolean
): boolean {
  return isSending || !templatesLoaded || !turnstileToken || !validateNotificationDraft(draft).valid;
}
