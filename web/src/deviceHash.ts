const storageKey = 'partnerNotify.installationSecret';

export async function getDeviceHash(): Promise<string> {
  const secret = getOrCreateSecret();
  const data = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getOrCreateSecret(): string {
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const secret = `${crypto.randomUUID()}.${crypto.randomUUID()}`;
  window.localStorage.setItem(storageKey, secret);
  return secret;
}
