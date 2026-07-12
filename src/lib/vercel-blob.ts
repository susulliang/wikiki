/**
 * Vercel Blob adapter for Wikiki's cloud sync.
 *
 * Uses @vercel/blob's token option (the SDK explicitly supports browser /
 * non-Vercel runtimes by passing `token` to each call). The user supplies
 * their own `BLOB_READ_WRITE_TOKEN` (from the Vercel dashboard → Storage →
 * Blob store settings) in the BlobSyncPanel; no secrets are baked into the
 * bundle.
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
  return { put: mod.put, del: mod.del, head: mod.head, list: mod.list };
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
  cacheControlMaxAge: 60,
};

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

  async getBytes(key) {
    const t = token();
    if (!t) throw new Error('No Vercel Blob credentials configured');
    const { head } = await getBlob();
    const meta = await head(key, { token: t });
    if (!meta) return null;
    // Public access means the blob URL is directly fetchable.
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Vercel Blob GET ${key} failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  },

  async putJSON(key, value) {
    const t = token();
    if (!t) throw new Error('No Vercel Blob credentials configured');
    const { put } = await getBlob();
    const body = JSON.stringify(value);
    await put(key, body, { ...PUT_OPTS, token: t, contentType: 'application/json' });
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const t = token();
    if (!t) return null;
    const { head } = await getBlob();
    const meta = await head(key, { token: t });
    if (!meta) return null;
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Vercel Blob GET ${key} failed: ${res.status}`);
    return (await res.json()) as T;
  },

  async delete(key) {
    const t = token();
    if (!t) throw new Error('No Vercel Blob credentials configured');
    const { del } = await getBlob();
    await del(key, { token: t });
  },
};

export const vercelProvider: CloudProvider = new BaseCloudProvider('vercel', vercelAdapter);
