/**
 * Vercel Blob adapter for Wikiki's cloud sync.
 *
 * The @vercel/blob SDK's API endpoint (vercel.com/api/blob) does NOT support
 * CORS — it's designed for server-side use only. Browser requests are blocked
 * by CORS policy. To work around this, we make direct REST calls to a
 * same-origin proxy at /api/blob (deployed as a Vercel serverless function
 * in api/blob.ts). The proxy forwards requests to the Vercel Blob API
 * server-to-server, bypassing CORS entirely.
 *
 * This means the Vercel provider only works when the app is deployed on Vercel
 * (where the /api/blob function exists). For local dev, use `vercel dev`.
 *
 * Store ID: extracted from the token itself
 * (token format: vercel_blob_rw_<storeId>_<random>), so no separate store ID
 * field is needed.
 *
 * SDK reference: https://vercel.com/docs/storage/vercel-blob/using-blob-sdk
 */
import { BaseCloudProvider, type BlobAdapter, type CloudProvider } from '@/lib/cloud-provider';

const CREDS_KEY = '__wikiki_vercel_creds';

/** Same-origin proxy URL (Vercel serverless function). */
const PROXY_URL = '/api/blob';

export interface VercelCreds {
  /** Vercel Blob read-write token, starts with `vercel_blob_rw_`. */
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

function getToken(): string | null {
  return getVercelCreds()?.token ?? null;
}

/**
 * Extract the store ID from a Vercel Blob read-write token.
 * Token format: vercel_blob_rw_<storeId>_<random>
 */
function parseStoreId(token: string): string {
  const parts = token.split('_');
  return parts[3] || '';
}

/** Construct the public blob URL for a given key. */
function blobUrl(key: string): string {
  const storeId = parseStoreId(getToken() || '');
  return `https://${storeId}.public.blob.vercel-storage.com/${key}`;
}

/** Auth headers sent with every proxy request. */
function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) throw new Error('No Vercel Blob credentials configured');
  return {
    authorization: `Bearer ${token}`,
    'x-vercel-blob-store-id': parseStoreId(token),
  };
}

/** Wrap errors with context. */
function wrapError(op: string, e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return new Error(
      `${op} failed: ${msg}. The /api/blob proxy may not exist — ensure the app is deployed on Vercel.`,
    );
  }
  return new Error(`${op} failed: ${msg}`);
}

const vercelAdapter: BlobAdapter = {
  hasCredentials: () => hasVercelCreds(),
  clearCredentials: () => clearVercelCreds(),

  async testConnection() {
    const t = getToken();
    if (!t) throw new Error('No Vercel Blob credentials configured');
    try {
      const res = await fetch(`${PROXY_URL}?limit=1`, {
        method: 'GET',
        headers: authHeaders(),
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
        ...authHeaders(),
        'x-vercel-blob-access': 'public',
        'x-add-random-suffix': '0',
        'x-allow-overwrite': '1',
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
      // Route through the proxy's download endpoint to avoid CORS issues
      // with the blob storage URL.
      const res = await fetch(`${PROXY_URL}?download=${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: authHeaders(),
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
      // Vercel Blob delete API expects an array of blob URLs
      const url = blobUrl(key);
      const res = await fetch(`${PROXY_URL}/delete`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ urls: [url] }),
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
