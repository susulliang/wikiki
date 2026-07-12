/**
 * Cloudflare D1 adapter for Wikiki's cloud sync.
 *
 * Stores key-value pairs (base64-encoded binary data + JSON text) in a
 * D1 SQLite table called `wikiki_kv`. All SQL is executed through the
 * /api/d1-query proxy function, which forwards to Cloudflare's D1 REST API.
 *
 * Additionally maintains a `wikiki_search_index` table that stores
 * flattened bundle/page metadata so remote search can run SQL LIKE
 * queries WITHOUT downloading the full DB blob.
 *
 * Credentials (Cloudflare account ID + D1 API token) are stored in
 * localStorage and sent as headers to the proxy.
 */
import { BaseCloudProvider, type BlobAdapter, type CloudProvider, type RemoteSearchResult } from '@/lib/cloud-provider';
import { bundlesFromDbBytes } from '@/lib/sqlite-storage';

const CREDS_KEY = '__wikiki_d1_creds';
const QUERY_URL = '/api/d1-query';

/** Table schema for key-value storage. */
const CREATE_KV_TABLE_SQL = `CREATE TABLE IF NOT EXISTS wikiki_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  content_type TEXT,
  updated_at TEXT NOT NULL
)`;

/** Search index table — one row per page, with flattened bundle metadata. */
const CREATE_SEARCH_INDEX_SQL = `CREATE TABLE IF NOT EXISTS wikiki_search_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_id TEXT NOT NULL,
  bundle_name TEXT NOT NULL,
  collection TEXT NOT NULL,
  tags TEXT DEFAULT '',
  page_id TEXT,
  page_title TEXT DEFAULT '',
  content_text TEXT DEFAULT '',
  page_order INTEGER DEFAULT 0
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

/** Ensure both tables exist. Called once per session. */
async function ensureTable(): Promise<void> {
  if (tableInitialized) return;
  await d1Query(CREATE_KV_TABLE_SQL);
  await d1Query(CREATE_SEARCH_INDEX_SQL);
  tableInitialized = true;
}

/** Strip HTML tags to get plain text for search indexing. */
function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

const d1Adapter: BlobAdapter = {
  hasCredentials: () => hasD1Creds(),
  clearCredentials: () => clearD1Creds(),

  async testConnection() {
    try {
      await d1Query(CREATE_KV_TABLE_SQL);
      await d1Query(CREATE_SEARCH_INDEX_SQL);
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

/**
 * D1-specific cloud provider that extends BaseCloudProvider with:
 * - Search index population on upload (flattened bundle/page data)
 * - Search index cleanup on delete
 * - Remote SQL search via `searchRemote()` — queries D1 directly,
 *   no full DB download needed
 */
class D1CloudProvider extends BaseCloudProvider implements CloudProvider {
  constructor() {
    super('d1', d1Adapter);
  }

  /**
   * After uploading a collection DB, parse it and populate the
   * `wikiki_search_index` table so remote search works without
   * downloading the full DB.
   */
  override async uploadCollectionDB(name: string, bytes: Uint8Array, bundleCount: number): Promise<void> {
    // 1. Upload the DB blob (base class behavior)
    await super.uploadCollectionDB(name, bytes, bundleCount);

    // 2. Parse the DB and populate the search index
    try {
      await ensureTable();
      const bundles = await bundlesFromDbBytes(bytes);

      // Delete old search index entries for this collection
      await d1Query('DELETE FROM wikiki_search_index WHERE collection = ?', [name]);

      // Insert one row per page
      for (const bundle of bundles) {
        const tags = bundle.tags.join(', ');
        for (let i = 0; i < bundle.pages.length; i++) {
          const page = bundle.pages[i];
          const contentText = stripHtml(page.content).slice(0, 5000); // cap to keep payload reasonable
          await d1Query(
            `INSERT INTO wikiki_search_index (bundle_id, bundle_name, collection, tags, page_id, page_title, content_text, page_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [bundle.id, bundle.name, name, tags, page.id, page.name || page.title, contentText, i],
          );
        }
      }
    } catch (e) {
      // Search index population is best-effort — the upload itself succeeded
      console.error('D1 search index population failed:', e);
    }
  }

  /** Also clean up the search index when deleting a collection. */
  override async deleteCollectionDB(name: string): Promise<void> {
    await super.deleteCollectionDB(name);
    try {
      await ensureTable();
      await d1Query('DELETE FROM wikiki_search_index WHERE collection = ?', [name]);
    } catch (e) {
      console.error('D1 search index cleanup failed:', e);
    }
  }

  /**
   * Search the remote D1 search index with SQL LIKE — NO full DB download.
   * Returns lightweight results with excerpts for the UI to display.
   */
  async searchRemote(query: string): Promise<RemoteSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      await ensureTable();

      // Build WHERE clause: each token matched against all text columns via OR.
      // We use LIKE for case-insensitive substring matching.
      const tokens = trimmed.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return [];

      const conditions: string[] = [];
      const params: (string | number | null)[] = [];

      for (const token of tokens) {
        const pattern = `%${token}%`;
        conditions.push('bundle_name LIKE ?');
        params.push(pattern);
        conditions.push('tags LIKE ?');
        params.push(pattern);
        conditions.push('page_title LIKE ?');
        params.push(pattern);
        conditions.push('content_text LIKE ?');
        params.push(pattern);
      }

      const whereClause = conditions.join(' OR ');
      const sql = `
        SELECT bundle_id, bundle_name, collection, tags, page_id, page_title, content_text
        FROM wikiki_search_index
        WHERE ${whereClause}
        LIMIT 30
      `;

      const result = await d1Query(sql, params);
      if (!result.results || result.results.length === 0) return [];

      // Deduplicate by bundle_id + page_id (multiple tokens may match same row)
      const seen = new Set<string>();
      const results: RemoteSearchResult[] = [];

      for (const row of result.results) {
        const bundleId = row.bundle_id as string;
        const pageId = (row.page_id as string) || null;
        const dedupKey = `${bundleId}:${pageId ?? 'null'}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const bundleName = row.bundle_name as string;
        const collection = row.collection as string;
        const tagsStr = (row.tags as string) || '';
        const pageTitle = (row.page_title as string) || '';
        const contentText = (row.content_text as string) || '';

        // Determine match type and build excerpt
        let matchType: 'name' | 'tag' | 'content' = 'content';
        const lowerQuery = trimmed.toLowerCase();

        if (bundleName.toLowerCase().includes(lowerQuery) ||
            tokens.every((t) => bundleName.toLowerCase().includes(t.toLowerCase()))) {
          matchType = 'name';
        } else if (tagsStr.toLowerCase().includes(lowerQuery) ||
                   tokens.some((t) => tagsStr.toLowerCase().includes(t.toLowerCase()))) {
          matchType = 'tag';
        }

        // Build excerpt: find first match position and extract context
        let excerpt = '';
        if (matchType === 'name') {
          excerpt = bundleName;
        } else if (matchType === 'tag') {
          excerpt = `Tags: ${tagsStr}`;
        } else {
          // Find first token match in content
          const lowerContent = contentText.toLowerCase();
          let matchPos = -1;
          for (const token of tokens) {
            const pos = lowerContent.indexOf(token.toLowerCase());
            if (pos >= 0 && (matchPos < 0 || pos < matchPos)) {
              matchPos = pos;
            }
          }
          if (matchPos >= 0) {
            const start = Math.max(0, matchPos - 60);
            const end = Math.min(contentText.length, matchPos + 140);
            excerpt = `${start > 0 ? '...' : ''}${contentText.slice(start, end)}${end < contentText.length ? '...' : ''}`;
          } else {
            excerpt = contentText.slice(0, 200);
          }
        }

        results.push({
          bundleId,
          bundleName,
          collection,
          tags: tagsStr ? tagsStr.split(', ').filter(Boolean) : [],
          pageId,
          pageName: pageId ? pageTitle : null,
          excerpt,
          matchType,
        });
      }

      return results;
    } catch (e) {
      throw wrapError('D1 searchRemote', e);
    }
  }
}

export const d1Provider: CloudProvider = new D1CloudProvider();
