/**
 * EdgeOne Pages Blob client for Wikiki.
 *
 * Uses the external "API token" access mode of @edgeone/pages-blob so the
 * browser talks directly to EdgeOne Blob storage. The user supplies their own
 * EdgeOne projectId + API token in the BlobSyncPanel (stored in localStorage);
 * no secrets are baked into the bundle.
 *
 * Databases are split by Collection: each collection's bundles are exported to
 * a standalone SQLite .db and stored under the key `collections/<name>.db`.
 * A manifest key `__wikiki_index.json` keeps the list of uploaded collections
 * inside the blob store itself.
 *
 * SDK reference: https://cloud.tencent.com/document/product/1552/131425
 */
import type { Store } from '@edgeone/pages-blob';
import type { IBundle } from '@/data/bundles';

const CREDS_KEY = '__wikiki_edgeone_creds';
/** Blob key holding the manifest of uploaded collections. */
const INDEX_KEY = '__wikiki_index.json';
/** Blob key prefix for per-collection SQLite databases. */
const DB_PREFIX = 'collections/';

export interface BlobCreds {
  projectId: string;
  token: string;
  storeName: string;
}

export interface CollectionEntry {
  name: string;
  bundleCount: number;
  sizeBytes: number;
  uploadedAt: string;
}

export interface CollectionIndex {
  collections: CollectionEntry[];
}

const DEFAULT_STORE_NAME = 'wikiki-db-sync';

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

/** Verify the configured credentials work by issuing a tiny list call. */
export async function testConnection(): Promise<void> {
  const store = await getBlobStore();
  if (!store) throw new Error('No EdgeOne credentials configured');
  await store.list({ limit: 1 });
}

async function readIndex(): Promise<CollectionIndex> {
  const store = await getBlobStore();
  if (!store) return { collections: [] };
  const data = await store.get(INDEX_KEY, { type: 'json', consistency: 'strong' });
  if (!data || typeof data !== 'object' || !Array.isArray((data as CollectionIndex).collections)) {
    return { collections: [] };
  }
  return data as CollectionIndex;
}

async function writeIndex(index: CollectionIndex): Promise<void> {
  const store = await getBlobStore();
  if (!store) throw new Error('No EdgeOne credentials configured');
  await store.setJSON(INDEX_KEY, index);
}

/** List all collections currently stored in the blob (from the manifest). */
export async function listUploadedCollections(): Promise<CollectionEntry[]> {
  const index = await readIndex();
  return index.collections;
}

function dbKey(name: string): string {
  return `${DB_PREFIX}${name}.db`;
}

/**
 * Upload a collection's SQLite database bytes to the blob store and update
 * the manifest. Overwrites an existing entry with the same name.
 */
export async function uploadCollectionDB(
  name: string,
  bytes: Uint8Array,
  bundleCount: number,
): Promise<void> {
  const store = await getBlobStore();
  if (!store) throw new Error('No EdgeOne credentials configured');
  // BlobInput accepts ArrayBuffer; copy to a standalone ArrayBuffer to avoid
  // sharing a larger underlying buffer.
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await store.set(dbKey(name), buffer);

  const index = await readIndex();
  const entry: CollectionEntry = {
    name,
    bundleCount,
    sizeBytes: bytes.byteLength,
    uploadedAt: new Date().toISOString(),
  };
  const others = index.collections.filter((c) => c.name !== name);
  index.collections = [...others, entry].sort((a, b) => a.name.localeCompare(b.name));
  await writeIndex(index);
}

/** Download a collection's SQLite database bytes from the blob store. */
export async function downloadCollectionDB(name: string): Promise<Uint8Array> {
  const store = await getBlobStore();
  if (!store) throw new Error('No EdgeOne credentials configured');
  const buf = await store.get(dbKey(name), { type: 'arrayBuffer' });
  if (!buf) throw new Error(`Collection "${name}" not found in blob storage`);
  return new Uint8Array(buf);
}

/** Delete a collection's database from the blob store and update the manifest. */
export async function deleteCollectionDB(name: string): Promise<void> {
  const store = await getBlobStore();
  if (!store) throw new Error('No EdgeOne credentials configured');
  await store.delete(dbKey(name));
  const index = await readIndex();
  index.collections = index.collections.filter((c) => c.name !== name);
  await writeIndex(index);
}

/**
 * Derive the set of local collections (unique collection names) present in the
 * current database, with their bundle counts. Used to populate the upload UI.
 */
export function localCollections(bundles: IBundle[]): { name: string; bundleCount: number }[] {
  const map = new Map<string, number>();
  for (const b of bundles) {
    const name = (b.collection && b.collection.trim()) || 'Default';
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, bundleCount]) => ({ name, bundleCount }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
