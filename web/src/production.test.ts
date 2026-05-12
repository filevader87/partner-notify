import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestingPage } from './App';
import { getRuntimeConfig } from './runtimeConfig';
import { getTemplatePreviewFromCatalog, isSendDisabled } from './domain';

describe('getRuntimeConfig', () => {
  it('uses local defaults only for development', () => {
    const config = getRuntimeConfig({ DEV: true, PROD: false });

    expect(config.apiBaseUrl).toBe('http://127.0.0.1:3000');
    expect(config.turnstileSiteKey).toBe('1x00000000000000000000AA');
  });

  it('rejects production builds without API and Turnstile configuration', () => {
    expect(() => getRuntimeConfig({ DEV: false, PROD: true })).toThrow('VITE_API_BASE_URL');
    expect(() => getRuntimeConfig({
      DEV: false,
      PROD: true,
      VITE_API_BASE_URL: 'https://api.partnernotify.app'
    })).toThrow('VITE_TURNSTILE_SITE_KEY');
  });
});

describe('template previews', () => {
  it('uses the backend template catalog as the preview source', () => {
    const catalog = {
      version: '2026-05-12',
      templates: {
        STI: {
          NEUTRAL: 'Backend-owned neutral text'
        }
      }
    };

    expect(getTemplatePreviewFromCatalog(catalog, 'STI', 'NEUTRAL')).toBe('Backend-owned neutral text');
  });
});

describe('isSendDisabled', () => {
  it('blocks send until Turnstile token and valid draft are present', () => {
    const validDraft = {
      consentExposure: true,
      consentNoHarassment: true,
      exposureType: 'STI' as const,
      tone: 'NEUTRAL' as const,
      phoneNumbers: ['+12035551234']
    };

    expect(isSendDisabled(validDraft, '', false, true)).toBe(true);
    expect(isSendDisabled(validDraft, 'token', false, true)).toBe(false);
    expect(isSendDisabled(validDraft, 'token', true, true)).toBe(true);
    expect(isSendDisabled(validDraft, 'token', false, false)).toBe(true);
  });
});

describe('testing route', () => {
  it('renders the CDC testing locator link', () => {
    const html = renderToStaticMarkup(React.createElement(TestingPage));
    expect(html).toContain('Find STI testing');
    expect(html).toContain('https://gettested.cdc.gov/');
  });
});
