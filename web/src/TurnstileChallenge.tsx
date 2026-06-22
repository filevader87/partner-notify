import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'auto';
          callback: (token: string) => void;
          'expired-callback': () => void;
          'error-callback': () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const turnstileScriptId = 'cloudflare-turnstile-script';

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }

  const existing = document.getElementById(turnstileScriptId) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load.')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = turnstileScriptId;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile failed to load.'));
    document.head.appendChild(script);
  });
}

export function TurnstileChallenge({
  siteKey,
  resetSignal,
  onToken,
  onError
}: {
  siteKey: string;
  resetSignal: number;
  onToken: (token: string) => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current) {
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'auto',
          callback: onToken,
          'expired-callback': () => {
            onToken('');
            onError('Human verification expired. Complete it again before sending.');
          },
          'error-callback': () => {
            onToken('');
            onError('Human verification failed to load. Try again.');
          }
        });
      })
      .catch((error) => onError(error instanceof Error ? error.message : 'Human verification failed to load.'));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onError, onToken, siteKey]);

  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onToken('');
    }
  }, [onToken, resetSignal]);

  return <div ref={containerRef} className="turnstile-box" aria-label="Human verification" />;
}
