/**
 * Vercel Blob adapter for Wikiki's cloud sync.
 *
 * Uses client-side uploads via @vercel/blob/client `upload()` — the browser
 * gets a short-lived client token from /api/blob-upload, then uploads
 * directly to Vercel Blob (CORS is supported for client tokens).
 *
 * Downloads use direct public blob URLs (no CORS issue for GET on public
 * blobs). The store ID is fetched from /api/blob-config.
 *
 * List and delete go through dedicated serverless functions
 * (/api/blob-list, /api/blob-delete) that use env-var auth.
 *
 * Requires the app to be deployed on Vercel with a linked Blob store.
 */
import { upload } from '@vercel/blob/client';
import { BaseCloudProvider, type BlobAdapter, type CloudProvider } from '@/lib/cloud-provider';

const CREDS_KEY = '__wikiki_vercel_creds';
const STORE_ID_CACHE_KEY = '__wikiki_vercel_store_id';

/** Endpoint URLs (same-origin Vercel serverless functions). */
const UPLOAD_URL = '/api/blob-upload';
const DELETE_URL = '/api/blob-delete';
const LIST_URL = '/api/blob-list';
const CONFIG_URL = '/api/blob-config';

export interface VercelCreds {
  /**
   * Vercel Blob read-write token. Stored locally as a gate for showing sync
   * controls. NOT used for actual auth — server functions use env vars.
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
    localStorage.setItem(CREDS_KEY, JSON.stringify({ token: creds.token.trim() }));
  } catch {
    // ignore
  }
}

export function clearVercelCreds(): void {
  try {
    localStorage.removeItem(CREDS_KEY);
    localStorage.removeItem(STORE_ID_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function hasVercelCreds(): boolean {
  return getVercelCreds() !== null;
}

/** Wrap errors with context. */
function wrapError(op: string, e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return new Error(
      `${op} failed: ${msg}. Ensure the app is deployed on Vercel with a linked Blob store.`,
    );
  }
  return new Error(`${op} failed: ${msg}`);
}

/**
 * Fetch the blob store ID from /api/blob-config (cached in localStorage).
 * Used to construct direct public download URLs.
 */
async function getStoreId(): Promise<string> {
  // Check cache first
  try {
    const cached = localStorage.getItem(STORE_ID_CACHE_KEY);
    if (cached) return cached;
  } catch {
    // ignore
  }

  const res = await fetch(CONFIG_URL, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to fetch blob config: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { storeId: string; configured: boolean };
  if (!data.storeId) {
    throw new Error('Blob store not configured. Link a Blob store to your Vercel project.');
  }

  // Cache for future use
  try {
    localStorage.setItem(STORE_ID_CACHE_KEY, data.storeId);
  } catch {
    // ignore
  }
  return data.storeId;
}

/** Construct the public blob URL for a given key. */
async function blobUrl(key: string): Promise<string> {
  const storeId = await getStoreId();
  return `https://${storeId}.public.blob.vercel-storage.com/${key}`;
}

const vercelAdapter: BlobAdapter = {
  hasCredentials: () => hasVercelCreds(),
  clearCredentials: () => clearVercelCreds(),

  async testConnection() {
    try {
      const res = await fetch(`${LIST_URL}?limit=1`, { method: 'GET' });
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
      // Copy into a fresh ArrayBuffer (Uint8Array<ArrayBufferLike> isn't
      // assignable to BodyInit under TS 5.9+).
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);

      // Client-side upload: gets a token from /api/blob-upload, then
      // uploads directly to Vercel Blob (CORS supported for client tokens).
      await upload(key, ab, {
        access: 'public',
        handleUploadUrl: UPLOAD_URL,
        contentType: contentType ?? 'application/octet-stream',
      });
    } catch (e) {
      throw wrapError(`Vercel putBytes(${key})`, e);
    }
  },

  async getBytes(key) {
    try {
      // Download directly from the public blob URL (no CORS for GET).
      const url = await blobUrl(key);
      const res = await fetch(url, { method: 'GET' });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
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
      const res = await fetch(DELETE_URL, {
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
