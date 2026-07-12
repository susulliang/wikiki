/**
 * Vercel Blob adapter for Wikiki's cloud sync.
 *
 * Uses @vercel/blob's token option (the SDK explicitly supports browser /
 * non-Vercel runtimes by passing `token` to each call). The user supplies
 * their own `BLOB_READ_WRITE_TOKEN` (from the Vercel dashboard → Storage →
 * Blob store settings) in the BlobSyncPanel; no secrets are baked into the
 * bundle.
 *
 * Store ID: the SDK extracts the storeId from the token itself
 * (token format: `vercel_blob_rw_<storeId>_<random>`), so we do NOT need a
 * separate storeId field.
 *
 * The collection-level split-by-Collection logic (manifest + per-collection
 * SQLite DBs) lives in cloud-provider.ts. This module only implements the
 * primitive `BlobAdapter` and credential management.
 *
 * SDK reference: https://vercel.com/docs/storage/vercel-blob/using-blob-sdk
 */
import { BaseCloudProvider, type BlobAdapter, type CloudProvider } from '@/lib/cloud-provider';

const CREDS_KEY = '__wikiki_vercel_creds';

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

/**
 * Lazy-load the @vercel/blob SDK. We dynamically import it so the SDK stays
 * out of the main bundle (this whole feature is hidden behind Shift+B).
 *
 * The SDK uses native fetch / Blob / ReadableStream and ships browser shims
 * for Node-only deps (undici, crypto, stream), so it works in the browser
 * when a `token` is passed explicitly to each call.
 */
async function getBlob() {
  const mod = await import('@vercel/blob');
  return { put: mod.put, del: mod.del, get: mod.get, list: mod.list };
}

function token(): string | null {
  const creds = getVercelCreds();
  return creds?.token ?? null;
}

/** Options shared by every put, overriding the SDK's suffix/overwrite defaults. */
const PUT_OPTS = {
  access: 'public' as const,
  addRandomSuffix: false,
  allowOverwrite: true,
  // Bypass CDN cache so reads immediately reflect the latest write.
  cacheControlMaxAge: 0,
};

/** Read a ReadableStream to completion and return the accumulated bytes. */
async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.byteLength;
  }
  return result;
}

const vercelAdapter: BlobAdapter = {
  hasCredentials: () => hasVercelCreds(),
  clearCredentials: () => clearVercelCreds(),

  async testConnection() {
    const t = token();
    if (!t) throw new Error('No Vercel Blob credentials configured');
    const { list } = await getBlob();
    await list({ limit: 1, token: t });
  },

  async putBytes(key, bytes, contentType) {
    const t = token();
    if (!t) throw new Error('No Vercel Blob credentials configured');
    const { put } = await getBlob();
    // Copy bytes into a fresh ArrayBuffer so the BlobPart type is satisfied
    // (Uint8Array<ArrayBufferLike> isn't assignable to BlobPart under TS 5.7+).
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const blob = new Blob([ab], { type: contentType ?? 'application/octet-stream' });
    await put(key, blob, { ...PUT_OPTS, token: t, contentType: contentType ?? 'application/octet-stream' });
  },

  /**
   * Use `get()` (not `head()`) because `get()` returns null for 404, whereas
   * `head()` throws BlobNotFoundError.  The storeId is parsed from the token
   * so `get()` can construct the blob URL directly without an API round-trip.
   */
  async getBytes(key) {
    const t = token();
    if (!t) throw new Error('No Vercel Blob credentials configured');
    const { get } = await getBlob();
    const result = await get(key, { access: 'public', token: t, useCache: false });
    if (!result) return null;
    return streamToBytes(result.stream);
  },

  async putJSON(key, value) {
    const t = token();
    if (!t) throw new Error('No Vercel Blob credentials configured');
    const { put } = await getBlob();
    const body = JSON.stringify(value);
    await put(key, body, { ...PUT_OPTS, token: t, contentType: 'application/json' });
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const bytes = await vercelAdapter.getBytes(key);
    if (!bytes) return null;
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  },

  async delete(key) {
    const t = token();
    if (!t) throw new Error('No Vercel Blob credentials configured');
    const { del } = await getBlob();
    await del(key, { token: t });
  },
};

export const vercelProvider: CloudProvider = new BaseCloudProvider('vercel', vercelAdapter);
