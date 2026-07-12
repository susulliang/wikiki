/**
 * EdgeOne Pages Blob adapter for Wikiki's cloud sync.
 *
 * Uses the external "API token" access mode of @edgeone/pages-blob so the
 * browser talks directly to EdgeOne Blob storage. The user supplies their own
 * EdgeOne projectId + API token in the BlobSyncPanel (stored in localStorage);
 * no secrets are baked into the bundle.
 *
 * The collection-level split-by-Collection logic (manifest + per-collection
 * SQLite DBs) lives in cloud-provider.ts. This module only implements the
 * primitive `BlobAdapter` and credential management.
 *
 * SDK reference: https://cloud.tencent.com/document/product/1552/131425
 */
import type { Store } from '@edgeone/pages-blob';
import { BaseCloudProvider, type BlobAdapter, type CloudProvider } from '@/lib/cloud-provider';

const CREDS_KEY = '__wikiki_edgeone_creds';
const DEFAULT_STORE_NAME = 'wikiki-db-sync';

export interface BlobCreds {
  projectId: string;
  token: string;
  storeName: string;
}

export function getBlobCreds(): BlobCreds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BlobCreds>;
    if (!parsed.projectId || !parsed.token) return null;
    return {
      projectId: parsed.projectId,
      token: parsed.token,
      storeName: parsed.storeName || DEFAULT_STORE_NAME,
    };
  } catch {
    return null;
  }
}

export function saveBlobCreds(creds: BlobCreds): void {
  try {
    localStorage.setItem(
      CREDS_KEY,
      JSON.stringify({
        projectId: creds.projectId.trim(),
        token: creds.token.trim(),
        storeName: creds.storeName.trim() || DEFAULT_STORE_NAME,
      }),
    );
  } catch {
    // ignore
  }
}

export function clearBlobCreds(): void {
  try {
    localStorage.removeItem(CREDS_KEY);
  } catch {
    // ignore
  }
}

export function hasBlobCreds(): boolean {
  return getBlobCreds() !== null;
}

async function getBlobStore(): Promise<Store | null> {
  const creds = getBlobCreds();
  if (!creds) return null;
  const { getStore } = await import('@edgeone/pages-blob');
  return getStore({
    name: creds.storeName,
    projectId: creds.projectId,
    token: creds.token,
    consistency: 'strong',
  });
}

/**
 * Wrap SDK errors with context about the operation and likely cause.
 * Network errors ("Failed to fetch") almost always indicate CORS is not
 * configured on the EdgeOne blob store — the SDK was designed for Pages
 * Functions (server-side), so browser CORS must be enabled separately.
 */
function wrapError(op: string, e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
    return new Error(
      `${op} failed: ${msg}. This is likely a CORS issue — enable CORS on your EdgeOne blob store / COS bucket for your domain.`,
    );
  }
  return new Error(`${op} failed: ${msg}`);
}

const edgeoneAdapter: BlobAdapter = {
  hasCredentials: () => hasBlobCreds(),
  clearCredentials: () => clearBlobCreds(),

  async testConnection() {
    const store = await getBlobStore();
    if (!store) throw new Error('No EdgeOne credentials configured');
    try {
      await store.list({ limit: 1 });
    } catch (e) {
      throw wrapError('EdgeOne testConnection', e);
    }
  },

  async putBytes(key, bytes) {
    const store = await getBlobStore();
    if (!store) throw new Error('No EdgeOne credentials configured');
    // BlobInput accepts ArrayBuffer; copy to a standalone ArrayBuffer to avoid
    // sharing a larger underlying buffer.
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    try {
      await store.set(key, buffer, { cacheControl: null });
    } catch (e) {
      throw wrapError(`EdgeOne putBytes(${key})`, e);
    }
  },

  async getBytes(key) {
    const store = await getBlobStore();
    if (!store) throw new Error('No EdgeOne credentials configured');
    try {
      const buf = await store.get(key, { type: 'arrayBuffer', consistency: 'strong' });
      if (!buf) return null;
      return new Uint8Array(buf);
    } catch (e) {
      throw wrapError(`EdgeOne getBytes(${key})`, e);
    }
  },

  async putJSON(key, value) {
    const store = await getBlobStore();
    if (!store) throw new Error('No EdgeOne credentials configured');
    try {
      await store.setJSON(key, value);
    } catch (e) {
      throw wrapError(`EdgeOne putJSON(${key})`, e);
    }
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const store = await getBlobStore();
    if (!store) return null;
    try {
      const data = await store.get(key, { type: 'json', consistency: 'strong' });
      if (data === null) return null;
      return data as T;
    } catch (e) {
      throw wrapError(`EdgeOne getJSON(${key})`, e);
    }
  },

  async delete(key) {
    const store = await getBlobStore();
    if (!store) throw new Error('No EdgeOne credentials configured');
    try {
      await store.delete(key);
    } catch (e) {
      throw wrapError(`EdgeOne delete(${key})`, e);
    }
  },
};

export const edgeoneProvider: CloudProvider = new BaseCloudProvider('edgeone', edgeoneAdapter);
