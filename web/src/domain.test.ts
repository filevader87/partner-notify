import { describe, expect, it } from 'vitest';
import {
  getAppMode,
  getTemplatePreviewFromCatalog,
  normalizePhoneNumber,
  validateNotificationDraft
} from './domain';

describe('normalizePhoneNumber', () => {
  it('normalizes a 10 digit US phone number', () => {
    expect(normalizePhoneNumber('(203) 555-1234')).toBe('+12035551234');
  });

  it('normalizes an existing international E.164-like number', () => {
    expect(normalizePhoneNumber('+44 20 7183 8750')).toBe('+442071838750');
  });

  it('rejects short phone numbers', () => {
    expect(() => normalizePhoneNumber('555-1234')).toThrow('valid phone number');
  });
});

describe('getTemplatePreviewFromCatalog', () => {
  it('returns a server-owned preview for HIV direct tone', () => {
    const catalog = {
      version: '2026-05-12',
      templates: {
        HIV: {
          DIRECT: 'Backend-owned HIV preview'
        }
      }
    };

    expect(getTemplatePreviewFromCatalog(catalog, 'HIV', 'DIRECT')).toBe('Backend-owned HIV preview');
  });
});

describe('getAppMode', () => {
  it('uses public mode by default', () => {
    expect(getAppMode(new URL('https://example.test/'))).toBe('public');
  });

  it('uses kiosk mode from query string', () => {
    expect(getAppMode(new URL('https://example.test/?mode=kiosk'))).toBe('kiosk');
  });
});

describe('validateNotificationDraft', () => {
  it('rejects sends without consent', () => {
    const result = validateNotificationDraft({
      consentExposure: false,
      consentNoHarassment: true,
      exposureType: 'STI',
      tone: 'NEUTRAL',
      phoneNumbers: ['+12035551234']
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('consent');
    }
  });

  it('accepts a complete draft', () => {
    const result = validateNotificationDraft({
      consentExposure: true,
      consentNoHarassment: true,
      exposureType: 'SYPHILIS',
      tone: 'SUPPORTIVE',
      phoneNumbers: ['+12035551234']
    });

    expect(result.valid).toBe(true);
  });
});
