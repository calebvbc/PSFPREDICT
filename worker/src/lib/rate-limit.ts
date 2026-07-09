const SAVE_INTERVAL_MS = 5_000;
const RATE_LIMIT_TTL_SECONDS = 60;

export interface RateLimitStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export async function assertSaveRateLimit(store: RateLimitStore, ip: string, now = Date.now()) {
  const key = await buildRateLimitKey(ip);
  const storedResetAt = Number(await store.get(key));

  if (Number.isFinite(storedResetAt) && storedResetAt > now) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((storedResetAt - now) / 1_000),
    } as const;
  }

  const resetAt = now + SAVE_INTERVAL_MS;
  await store.put(key, String(resetAt), { expirationTtl: RATE_LIMIT_TTL_SECONDS });
  return { limited: false } as const;
}

async function buildRateLimitKey(ip: string) {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `save:${hash}`;
}

const storeMap = new Map<string, { value: string, expiresAt: number }>();

export const memoryRateLimitStore: RateLimitStore = {
  async get(key: string) {
    const entry = storeMap.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      storeMap.delete(key);
      return null;
    }
    return entry.value;
  },
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    const ttl = options?.expirationTtl ?? RATE_LIMIT_TTL_SECONDS;
    storeMap.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }
};
