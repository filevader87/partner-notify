type ViteLikeEnv = {
  DEV?: boolean;
  PROD?: boolean;
  VITE_API_BASE_URL?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
};

export type RuntimeConfig = {
  apiBaseUrl: string;
  turnstileSiteKey: string;
};

const developmentTurnstileSiteKey = '1x00000000000000000000AA';

export function getRuntimeConfig(env: ViteLikeEnv): RuntimeConfig {
  const isProduction = env.PROD === true && env.DEV !== true;
  const apiBaseUrl = env.VITE_API_BASE_URL?.trim() || (isProduction ? '' : 'http://127.0.0.1:3000');
  const turnstileSiteKey = env.VITE_TURNSTILE_SITE_KEY?.trim() || (isProduction ? '' : developmentTurnstileSiteKey);

  if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is required for production builds.');
  }

  if (!turnstileSiteKey) {
    throw new Error('VITE_TURNSTILE_SITE_KEY is required for production builds.');
  }

  return {
    apiBaseUrl,
    turnstileSiteKey
  };
}
