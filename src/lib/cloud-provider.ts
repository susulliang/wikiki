/**
 * Unified cloud storage provider abstraction for Wikiki's hidden sync panel.
 *
 * Two backends are supported, both operating in "user-supplied token" mode so
 * the browser talks directly to the storage API without a server:
 *   - EdgeOne Pages Blob  (@edgeone/pages-blob, external API-token mode)
 *   - Cloudflare D1       (SQLite edge DB, accessed via REST API proxy)
 *
 * Both backends are simple key/value blob stores, so the collection-level
 * logic (a manifest at `__wikiki_index.json` + one SQLite DB per collection
 * under `collections/<name>.db`) is identical and lives here. Each backend
 * only needs to supply a `BlobAdapter` implementing the primitive get/set/
 * delete operations against its own SDK.
 *
 * Databases remain unencrypted for now; encryption will follow.
 */
import type { IBundle } from '@/data/bundles';

export type ProviderId = 'edgeone' | 'd1';

/** Metadata for one uploaded collection, stored in the manifest. */
export interface CollectionEntry {
  name: string;
  bundleCount: number;
  sizeBytes: number;
  uploadedAt: string;
}

interface CollectionIndex {
  collections: CollectionEntry[];
}

/** Blob key holding the manifest of uploaded collections. */
const INDEX_KEY = '__wikiki_index.json';
/** Blob key prefix for per-collection SQLite databases. */
const DB_PREFIX = 'collections/';

/**
 * Minimal primitive operations each backend must implement. The shared
 * collection logic in `BaseCloudProvider` is built on top of this.
 */
export interface BlobAdapter {
  hasCredentials(): boolean;
  clearCredentials(): void;
  /** Verify credentials work (e.g. issue a tiny list call). */
  testConnection(): Promise<void>;
  /** Write raw bytes. Overwrites if the key already exists. */
  putBytes(key: string, bytes: Uint8Array, contentType?: string): Promise<void>;
  /** Read raw bytes. Returns null if the key does not exist. */
  getBytes(key: string): Promise<Uint8Array | null>;
  /** Write a JSON value. */
  putJSON<T>(key: string, value: T): Promise<void>;
  /** Read a JSON value. Returns null if the key does not exist. */
  getJSON<T>(key: string): Promise<T | null>;
  /** Delete a key. No-op if the key does not exist. */
  delete(key: string): Promise<void>;
}

/** Public capability surface offered by every cloud provider. */
export interface CloudProvider {
  readonly id: ProviderId;
  hasCredentials(): boolean;
  clearCredentials(): void;
  testConnection(): Promise<void>;
  listUploadedCollections(): Promise<CollectionEntry[]>;
  uploadCollectionDB(name: string, bytes: Uint8Array, bundleCount: number): Promise<void>;
  downloadCollectionDB(name: string): Promise<Uint8Array>;
  deleteCollectionDB(name: string): Promise<void>;
}

/**
 * Shared collection logic built on top of a `BlobAdapter`. Each concrete
 * provider creates an adapter and instantiates this class with its id.
 */
export class BaseCloudProvider implements CloudProvider {
  constructor(readonly id: ProviderId, private adapter: BlobAdapter) {}

  hasCredentials(): boolean {
    return this.adapter.hasCredentials();
  }

  clearCredentials(): void {
    this.adapter.clearCredentials();
  }

  testConnection(): Promise<void> {
    return this.adapter.testConnection();
  }

  async listUploadedCollections(): Promise<CollectionEntry[]> {
    const idx = await this.adapter.getJSON<CollectionIndex>(INDEX_KEY);
    return idx?.collections ?? [];
  }

  async uploadCollectionDB(name: string, bytes: Uint8Array, bundleCount: number): Promise<void> {
    await this.adapter.putBytes(`${DB_PREFIX}${name}.db`, bytes, 'application/octet-stream');
    const idx = (await this.adapter.getJSON<CollectionIndex>(INDEX_KEY)) ?? { collections: [] };
    const entry: CollectionEntry = {
      name,
      bundleCount,
      sizeBytes: bytes.byteLength,
      uploadedAt: new Date().toISOString(),
    };
    idx.collections = [...idx.collections.filter((c) => c.name !== name), entry].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    await this.adapter.putJSON(INDEX_KEY, idx);
  }

  async downloadCollectionDB(name: string): Promise<Uint8Array> {
    const bytes = await this.adapter.getBytes(`${DB_PREFIX}${name}.db`);
    if (!bytes) throw new Error(`Collection "${name}" not found in cloud storage`);
    return bytes;
  }

  async deleteCollectionDB(name: string): Promise<void> {
    await this.adapter.delete(`${DB_PREFIX}${name}.db`);
    const idx = await this.adapter.getJSON<CollectionIndex>(INDEX_KEY);
    if (idx) {
      idx.collections = idx.collections.filter((c) => c.name !== name);
      await this.adapter.putJSON(INDEX_KEY, idx);
    }
  }
}

/**
 * Derive the set of local collections (unique collection names) present in the
 * current database, with their bundle counts. Used to populate the upload UI.
 */
export function localCollections(
  bundles: IBundle[],
): { name: string; bundleCount: number }[] {
  const map = new Map<string, number>();
  for (const b of bundles) {
    const name = (b.collection && b.collection.trim()) || 'Default';
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, bundleCount]) => ({ name, bundleCount }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
