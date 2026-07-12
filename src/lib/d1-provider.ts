/**
 * Cloudflare D1 adapter for Wikiki's cloud sync.
 *
 * Stores key-value pairs (base64-encoded binary data + JSON text) in a
 * D1 SQLite table called `wikiki_kv`. All SQL is executed through the
 * /api/d1-query proxy function, which forwards to Cloudflare's D1 REST API.
 *
 * Credentials (Cloudflare account ID + D1 API token) are stored in
 * localStorage and sent as headers to the proxy.
 */
import { BaseCloudProvider, type BlobAdapter, type CloudProvider } from '@/lib/cloud-provider';

const CREDS_KEY = '__wikiki_d1_creds';
const QUERY_URL = '/api/d1-query';

/** Table schema for key-value storage. */
const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS wikiki_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  content_type TEXT,
  updated_at TEXT NOT NULL
)`;

export interface D1Creds {
  /** Cloudflare account ID (32-char hex string, NOT your email). */
  accountId: string;
  /** D1 API token with D1 edit permissions. */
  token: string;
}

/**
 * Validate that the account ID looks like a Cloudflare account ID
 * (32-char hex string). Rejects emails and other formats early with a
 * clear error message instead of a confusing 404 from the API.
 */
export function validateAccountId(accountId: string): Error | null {
  const trimmed = accountId.trim();
  if (!trimmed) return new Error('Account ID is empty');
  if (trimmed.includes('@')) {
    return new Error(
      'Account ID should be a 32-character hex string (e.g. "a1b2c3d4..."), not an email. Find it in Cloudflare Dashboard → any domain → right sidebar "Account ID".',
    );
  }
  if (!/^[a-f0-9]{32}$/i.test(trimmed)) {
    return new Error(
      `Account ID must be 32 hex characters (got ${trimmed.length} chars). Find it in Cloudflare Dashboard → any domain → right sidebar "Account ID".`,
    );
  }
  return null;
}

export function getD1Creds(): D1Creds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<D1Creds>;
    if (!parsed.accountId || !parsed.token) return null;
    return { accountId: parsed.accountId, token: parsed.token };
  } catch {
    return null;
  }
}

export function saveD1Creds(creds: D1Creds): void {
  // Don't persist invalid account IDs (emails, etc.)
  const validationError = validateAccountId(creds.accountId);
  if (validationError) throw validationError;
  try {
    localStorage.setItem(
      CREDS_KEY,
      JSON.stringify({ accountId: creds.accountId.trim(), token: creds.token.trim() }),
    );
  } catch {
    // ignore
  }
}

export function clearD1Creds(): void {
  try {
    localStorage.removeItem(CREDS_KEY);
  } catch {
    // ignore
  }
}

export function hasD1Creds(): boolean {
  return getD1Creds() !== null;
}

// ── Base64 helpers (chunked to avoid stack overflow on large arrays) ──

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── D1 query helper ──

interface D1QueryResult {
  results: Record<string, unknown>[];
  meta: Record<string, unknown>;
  success: boolean;
}

async function d1Query(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<D1QueryResult> {
  const creds = getD1Creds();
  if (!creds) throw new Error('No D1 credentials configured');

  // Validate account ID format early to give a clear error
  const validationError = validateAccountId(creds.accountId);
  if (validationError) throw validationError;

  const res = await fetch(QUERY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cf-account-id': creds.accountId,
      'x-cf-d1-token': creds.token,
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`D1 query failed: HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as D1QueryResult | { error: string };
  if ('error' in data) {
    throw new Error(`D1 query failed: ${data.error}`);
  }
  return data;
}

/** Wrap errors with context. */
function wrapError(op: string, e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return new Error(
      `${op} failed: ${msg}. Ensure the app is deployed with the /api/d1-query function.`,
    );
  }
  return new Error(`${op} failed: ${msg}`);
}

let tableInitialized = false;

/** Ensure the wikiki_kv table exists. Called once per session. */
async function ensureTable(): Promise<void> {
  if (tableInitialized) return;
  await d1Query(CREATE_TABLE_SQL);
  tableInitialized = true;
}

const d1Adapter: BlobAdapter = {
  hasCredentials: () => hasD1Creds(),
  clearCredentials: () => clearD1Creds(),

  async testConnection() {
    try {
      await d1Query(CREATE_TABLE_SQL);
      tableInitialized = true;
      await d1Query('SELECT 1 as ok');
    } catch (e) {
      throw wrapError('D1 testConnection', e);
    }
  },

  async putBytes(key, bytes, contentType) {
    try {
      await ensureTable();
      const base64 = bytesToBase64(bytes);
      const now = new Date().toISOString();
      await d1Query(
        'INSERT OR REPLACE INTO wikiki_kv (key, value, content_type, updated_at) VALUES (?, ?, ?, ?)',
        [key, base64, contentType ?? 'application/octet-stream', now],
      );
    } catch (e) {
      throw wrapError(`D1 putBytes(${key})`, e);
    }
  },

  async getBytes(key) {
    try {
      await ensureTable();
      const result = await d1Query('SELECT value FROM wikiki_kv WHERE key = ?', [key]);
      if (!result.results || result.results.length === 0) return null;
      const base64 = result.results[0].value as string;
      return base64ToBytes(base64);
    } catch (e) {
      throw wrapError(`D1 getBytes(${key})`, e);
    }
  },

  async putJSON(key, value) {
    const body = JSON.stringify(value);
    await d1Adapter.putBytes(key, new TextEncoder().encode(body), 'application/json');
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const bytes = await d1Adapter.getBytes(key);
    if (!bytes) return null;
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  },

  async delete(key) {
    try {
      await ensureTable();
      await d1Query('DELETE FROM wikiki_kv WHERE key = ?', [key]);
    } catch (e) {
      throw wrapError(`D1 delete(${key})`, e);
    }
  },
};

export const d1Provider: CloudProvider = new BaseCloudProvider('d1', d1Adapter);
