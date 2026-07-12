/**
 * Vercel Blob adapter for Wikiki's cloud sync.
 *
 * The @vercel/blob SDK's API endpoint (vercel.com/api/blob) does NOT support
 * CORS — it's designed for server-side use only. Browser requests are blocked
 * by CORS policy. To work around this, we make requests to a same-origin proxy
 * at /api/blob (deployed as a Vercel serverless function in api/blob.ts).
 *
 * The proxy uses the @vercel/blob SDK server-side with env vars
 * (VERCEL_OIDC_TOKEN + BLOB_STORE_ID, or BLOB_READ_WRITE_TOKEN) which are set
 * automatically when you link a Vercel Blob store to your Vercel project.
 *
 * We intentionally do NOT pass the browser-provided token to the proxy, because
 * the SDK's store ID parser (split("_")[3]) breaks on store IDs containing
 * underscores (e.g. store_N5ZvP5mdd6dJBs7i). The env-var/OIDC path correctly
 * normalizes the store ID.
 *
 * This means the Vercel provider only works when the app is deployed on Vercel
 * with a linked Blob store. For local dev, use `vercel dev`.
 *
 * The token stored in the UI is used only as a gate to show sync controls —
 * it is NOT used for actual authentication (the server uses env vars).
 */
import { BaseCloudProvider, type BlobAdapter, type CloudProvider } from '@/lib/cloud-provider';

const CREDS_KEY = '__wikiki_vercel_creds';

/** Same-origin proxy URL (Vercel serverless function). */
const PROXY_URL = '/api/blob';

export interface VercelCreds {
  /**
   * Vercel Blob read-write token. Stored locally as a gate for showing sync
   * controls, but NOT sent to the server (the server uses env vars).
   */
  token: string;
}

export function getVercelCreds(): VercelCreds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VercelCreds>;
    if (!parsed.token) return null;
    return { token: parsed.token };
  } catch {
    return null;
  }
}

export function saveVercelCreds(creds: VercelCreds): void {
  try {
    localStorage.setItem(
      CREDS_KEY,
      JSON.stringify({ token: creds.token.trim() }),
    );
  } catch {
    // ignore
  }
}

export function clearVercelCreds(): void {
  try {
    localStorage.removeItem(CREDS_KEY);
  } catch {
    // ignore
  }
}

export function hasVercelCreds(): boolean {
  return getVercelCreds() !== null;
}

/**
 * Headers for proxy requests. We don't send the Vercel token — the server
 * uses env vars (VERCEL_OIDC_TOKEN + BLOB_STORE_ID) via the SDK.
 */
function proxyHeaders(): Record<string, string> {
  return {};
}

/** Wrap errors with context. */
function wrapError(op: string, e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return new Error(
      `${op} failed: ${msg}. The /api/blob proxy may not exist — ensure the app is deployed on Vercel with a linked Blob store.`,
    );
  }
  return new Error(`${op} failed: ${msg}`);
}

const vercelAdapter: BlobAdapter = {
  hasCredentials: () => hasVercelCreds(),
  clearCredentials: () => clearVercelCreds(),

  async testConnection() {
    try {
      const res = await fetch(`${PROXY_URL}?limit=1`, {
        method: 'GET',
        headers: proxyHeaders(),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      throw wrapError('Vercel testConnection', e);
    }
  },

  async putBytes(key, bytes, contentType) {
    try {
      const headers: Record<string, string> = {
        'content-type': contentType ?? 'application/octet-stream',
      };
      // Copy into a fresh ArrayBuffer so the BodyInit type is satisfied
      // (Uint8Array<ArrayBufferLike> isn't assignable to BodyInit under TS 5.9+).
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      const res = await fetch(`${PROXY_URL}?pathname=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers,
        body: ab,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      throw wrapError(`Vercel putBytes(${key})`, e);
    }
  },

  async getBytes(key) {
    try {
      const res = await fetch(`${PROXY_URL}?download=${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: proxyHeaders(),
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } catch (e) {
      throw wrapError(`Vercel getBytes(${key})`, e);
    }
  },

  async putJSON(key, value) {
    const body = JSON.stringify(value);
    await vercelAdapter.putBytes(key, new TextEncoder().encode(body), 'application/json');
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const bytes = await vercelAdapter.getBytes(key);
    if (!bytes) return null;
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  },

  async delete(key) {
    try {
      // Send the key (pathname) — the SDK's del() accepts pathname directly.
      const res = await fetch(`${PROXY_URL}/delete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keys: [key] }),
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      throw wrapError(`Vercel delete(${key})`, e);
    }
  },
};

export const vercelProvider: CloudProvider = new BaseCloudProvider('vercel', vercelAdapter);
