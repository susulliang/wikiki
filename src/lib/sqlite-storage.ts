import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { IBundle, IPage } from '@/data/bundles';
import { normalizeBundle, denormalizeBundle } from '@/data/bundles';

const DB_FILENAME = 'wikiki.db';
const IMG_PLACEHOLDER_RE = /<img[^>]+src="data:image\/[^"]+"[^>]*>/gi;

// CDN 回退列表，本地 WASM 失败时使用
const CDN_FALLBACK_URLS = [
  'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/',
  'https://unpkg.com/sql.js@1.10.3/dist/',
  'https://sql.js.org/dist/',
];

let SQL: SqlJsStatic | null = null;
let initPromise: Promise<SqlJsStatic> | null = null;

async function tryLoadFromCDN(urls: string[]): Promise<SqlJsStatic> {
  let lastError: unknown = null;
  for (const baseUrl of urls) {
    try {
      console.info(`Trying to load sql.js WASM from CDN ${baseUrl}`);
      const result = await initSqlJs({
        locateFile: (file: string) => `${baseUrl}${file}`,
      });
      console.info(`Successfully loaded sql.js WASM from CDN ${baseUrl}`);
      return result;
    } catch (e) {
      lastError = e;
      console.warn(`Failed to load sql.js WASM from CDN ${baseUrl}: ${String(e)}`);
    }
  }
  throw lastError ?? new Error('Failed to load sql.js WASM from all CDNs');
}

async function getSQL(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  if (!initPromise) {
    initPromise = (async () => {
      // 优先使用本地打包的 WASM
      try {
        console.info(`Trying to load from local WASM: ${wasmUrl}`);
        const result = await initSqlJs({
          locateFile: () => wasmUrl,
        });
        console.info('Successfully loaded sql.js from local WASM');
        return result;
      } catch (e) {
        console.warn(`Local WASM load failed, falling back to CDN: ${String(e)}`);
        // 本地失败，回退到 CDN
        return await tryLoadFromCDN(CDN_FALLBACK_URLS);
      }
    })();
  }
  SQL = await initPromise;
  return SQL;
}

async function getOPFSHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getFileHandle(DB_FILENAME, { create: true });
  } catch {
    console.warn('OPFS not available, falling back to IndexedDB');
    return null;
  }
}

// IndexedDB 回退
function idbSave(data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wikiki-db', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('files');
    };
    req.onsuccess = () => {
      const tx = req.result.transaction('files', 'readwrite');
      tx.objectStore('files').put(data, DB_FILENAME);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbLoad(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wikiki-db', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('files');
    };
    req.onsuccess = () => {
      const tx = req.result.transaction('files', 'readonly');
      const getReq = tx.objectStore('files').get(DB_FILENAME);
      getReq.onsuccess = () => resolve(getReq.result ?? null);
      getReq.onerror = () => reject(getReq.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function extractBase64Images(content: string): Array<{ id: string; mime: string; data: Uint8Array }> {
  const images: Array<{ id: string; mime: string; data: Uint8Array }> = [];
  const matches = content.matchAll(/<img[^>]+src="data:(image\/[^;]+);base64,([^"]+)"[^>]*>/gi);
  let counter = 0;
  for (const m of matches) {
    const mime = m[1];
    const b64 = m[2];
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      images.push({ id: `img-${Date.now()}-${counter++}-${Math.random().toString(36).slice(2, 7)}`, mime, data: bytes });
    } catch {
      // 跳过无效 base64
    }
  }
  return images;
}

function replaceBase64WithPlaceholders(content: string, images: Array<{ id: string }>): string {
  let idx = 0;
  return content.replace(IMG_PLACEHOLDER_RE, (match) => {
    if (idx >= images.length) return match;
    const img = images[idx++];
    return match.replace(/src="data:image\/[^"]+"/, `data-wiki-img="${img.id}"`);
  });
}

function restoreBase64Images(content: string, imageMap: Map<string, { mime: string; data: Uint8Array }>): string {
  return content.replace(/<img([^>]*)data-wiki-img="([^"]+)"([^>]*)>/gi, (_full, before, imgId, after) => {
    const img = imageMap.get(imgId);
    if (!img) return _full;
    let binary = '';
    const len = img.data.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(img.data[i]);
    }
    const b64 = btoa(binary);
    const cleanBefore = before.replace(/src=""/g, '');
    const cleanAfter = after.replace(/src=""/g, '');
    return `<img${cleanBefore}src="data:${img.mime};base64,${b64}"${cleanAfter}>`;
  });
}

function createSchema(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    source TEXT DEFAULT 'user',
    collection TEXT DEFAULT 'Default'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    page_order INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS product_tags (
    product_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (product_id, tag_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS product_authors (
    product_id TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    PRIMARY KEY (product_id, author_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    page_id TEXT,
    mime_type TEXT,
    data BLOB
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  db.run('PRAGMA foreign_keys = ON');
}

/**
 * Idempotent migration: add the `collection` column to the `products` table
 * for existing databases created before this column existed.
 * SQLite has no ADD COLUMN IF NOT EXISTS, so we guard with PRAGMA table_info.
 */
function migrateSchema(db: Database): void {
  const cols = db.exec('PRAGMA table_info(products)');
  if (cols[0]) {
    const colNames = cols[0].values.map((r) => r[1] as string);
    if (!colNames.includes('collection')) {
      db.run("ALTER TABLE products ADD COLUMN collection TEXT DEFAULT 'Default'");
    }
  }
}

export interface StorageInfo {
  mode: 'sqlite';
  dbSizeBytes: number;
  dbSizeFormatted: string;
  productCount: number;
  pageCount: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class SQLiteStorage {
  private db: Database | null = null;
  private _initialized = false;

  get initialized(): boolean {
    return this._initialized;
  }

  async init(existingData?: Uint8Array): Promise<void> {
    const sql = await getSQL();
    if (existingData) {
      this.db = new sql.Database(existingData);
    } else {
      let data: Uint8Array | null = null;
      const handle = await getOPFSHandle();
      if (handle) {
        try {
          const file = await handle.getFile();
          if (file.size > 0) {
            data = new Uint8Array(await file.arrayBuffer());
          }
        } catch {
          // 文件不存在
        }
      } else {
        data = await idbLoad();
      }
      if (data && data.length > 0) {
        this.db = new sql.Database(data);
      } else {
        this.db = new sql.Database();
        createSchema(this.db);
      }
    }
    // 确保 schema 存在
    createSchema(this.db);
    migrateSchema(this.db);
    this._initialized = true;
  }

  async persist(): Promise<void> {
    if (!this.db) return;
    const data = this.db.export();
    const handle = await getOPFSHandle();
    if (handle) {
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
    } else {
      await idbSave(data);
    }
  }

  async getInfo(): Promise<StorageInfo> {
    if (!this.db) throw new Error('数据库未初始化');
    const data = this.db.export();
    const productCount = (this.db.exec('SELECT COUNT(*) as c FROM products')[0]?.values[0]?.[0] ?? 0) as number;
    const pageCount = (this.db.exec('SELECT COUNT(*) as c FROM pages')[0]?.values[0]?.[0] ?? 0) as number;
    const bytes = data.length;
    return { mode: 'sqlite', dbSizeBytes: bytes, dbSizeFormatted: formatBytes(bytes), productCount, pageCount };
  }

  async getAllBundlesShallow(): Promise<IBundle[]> {
    if (!this.db) return [];
    const prodRows = this.db.exec(
      'SELECT id, name, created_at, updated_at, source, collection FROM products ORDER BY updated_at DESC',
    );
    if (!prodRows[0]) return [];

    const bundles: IBundle[] = [];
    for (const row of prodRows[0].values) {
      const [pid, name, createdAt, updatedAt, source, collection] = row as [string, string, number, number, string, string];

      const tagRows = this.db.exec(
        'SELECT t.name FROM tags t JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = ?',
        [pid],
      );
      const tags: string[] = tagRows[0] ? tagRows[0].values.map((r) => r[0] as string) : [];

      const authorRows = this.db.exec(
        'SELECT a.name FROM authors a JOIN product_authors pa ON a.id = pa.author_id WHERE pa.product_id = ?',
        [pid],
      );
      const authors: string[] = authorRows[0] ? authorRows[0].values.map((r) => r[0] as string) : [];

      // Load page metadata only — no content, no images
      const pageRows = this.db.exec(
        'SELECT id, title, page_order FROM pages WHERE product_id = ? ORDER BY page_order',
        [pid],
      );
      const pages: IPage[] = pageRows[0]
        ? pageRows[0].values.map((prow) => {
            const [ppid, title, order] = prow as [string, string, number];
            return {
              id: ppid,
              title,
              name: title,
              content: '',
              order,
              createdAt: new Date(createdAt as number).toISOString(),
              updatedAt: new Date(updatedAt as number).toISOString(),
            };
          })
        : [];

      bundles.push({
        id: pid,
        name,
        tags,
        authors: authors.length > 0 ? authors : ['susul'],
        collection: collection || 'Default',
        pages,
        createdAt: new Date(createdAt as number).toISOString(),
        updatedAt: new Date(updatedAt as number).toISOString(),
        source: source || 'user',
      });
    }
    return bundles;
  }

  async getAllBundles(): Promise<IBundle[]> {
    if (!this.db) return [];
    const bundles: IBundle[] = [];
    const prodRows = this.db.exec('SELECT id, name, created_at, updated_at, source, collection FROM products ORDER BY name');
    if (!prodRows[0]) return [];

    for (const row of prodRows[0].values) {
      const [id, name, createdAt, updatedAt, source, collection] = row as [string, string, number, number, string, string];
      // 获取标签
      const tagRows = this.db.exec(
        'SELECT t.name FROM tags t JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = ?',
        [id],
      );
      const tags: string[] = tagRows[0] ? tagRows[0].values.map((r) => r[0] as string) : [];

      // 获取作者
      const authorRows = this.db.exec(
        'SELECT a.name FROM authors a JOIN product_authors pa ON a.id = pa.author_id WHERE pa.product_id = ?',
        [id],
      );
      const authors: string[] = authorRows[0] ? authorRows[0].values.map((r) => r[0] as string) : [];

      // 获取页面
      const pageRows = this.db.exec(
        'SELECT id, title, content, page_order FROM pages WHERE product_id = ? ORDER BY page_order',
        [id],
      );
      const pages: IPage[] = [];
      if (pageRows[0]) {
        for (const prow of pageRows[0].values) {
          const [pid, title, content, order] = prow as [string, string, string, number];
          // 还原图片
          const imgRows = this.db.exec('SELECT id, mime_type, data FROM images WHERE page_id = ?', [pid]);
          const imgMap = new Map<string, { mime: string; data: Uint8Array }>();
          if (imgRows[0]) {
            for (const irow of imgRows[0].values) {
              imgMap.set(irow[0] as string, { mime: irow[1] as string, data: irow[2] as Uint8Array });
            }
          }
          const restoredContent = restoreBase64Images(content, imgMap);
          pages.push({
            id: pid,
            title,
            name: title,
            content: restoredContent,
            order,
            createdAt: new Date(createdAt as number).toISOString(),
            updatedAt: new Date(updatedAt as number).toISOString(),
          });
        }
      }
      bundles.push({
        id,
        name,
        tags,
        authors: authors.length > 0 ? authors : ['susul'],
        collection: collection || 'Default',
        pages,
        createdAt: new Date(createdAt as number).toISOString(),
        updatedAt: new Date(updatedAt as number).toISOString(),
        source: source || 'user',
      });
    }
    return bundles;
  }

  async getBundle(id: string): Promise<IBundle | null> {
    if (!this.db) return null;
    // Fetch only the bundle with the given id, not all bundles
    const prodRows = this.db.exec(
      'SELECT id, name, created_at, updated_at, source, collection FROM products WHERE id = ?',
      [id],
    );
    if (!prodRows[0] || prodRows[0].values.length === 0) return null;

    const [pid, name, createdAt, updatedAt, source, collection] = prodRows[0].values[0] as [string, string, number, number, string, string];

    const tagRows = this.db.exec(
      'SELECT t.name FROM tags t JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = ?',
      [pid],
    );
    const tags: string[] = tagRows[0] ? tagRows[0].values.map((r) => r[0] as string) : [];

    const authorRows = this.db.exec(
      'SELECT a.name FROM authors a JOIN product_authors pa ON a.id = pa.author_id WHERE pa.product_id = ?',
      [pid],
    );
    const authors: string[] = authorRows[0] ? authorRows[0].values.map((r) => r[0] as string) : [];

    const pageRows = this.db.exec(
      'SELECT id, title, content, page_order FROM pages WHERE product_id = ? ORDER BY page_order',
      [pid],
    );
    const pages: IPage[] = [];
    if (pageRows[0]) {
      for (const prow of pageRows[0].values) {
        const [ppid, title, content, order] = prow as [string, string, string, number];
        const imgRows = this.db.exec('SELECT id, mime_type, data FROM images WHERE page_id = ?', [ppid]);
        const imgMap = new Map<string, { mime: string; data: Uint8Array }>();
        if (imgRows[0]) {
          for (const irow of imgRows[0].values) {
            imgMap.set(irow[0] as string, { mime: irow[1] as string, data: irow[2] as Uint8Array });
          }
        }
        const restoredContent = restoreBase64Images(content, imgMap);
        pages.push({
          id: ppid,
          title,
          name: title,
          content: restoredContent,
          order,
          createdAt: new Date(createdAt as number).toISOString(),
          updatedAt: new Date(updatedAt as number).toISOString(),
        });
      }
    }

    return {
      id: pid,
      name,
      tags,
      authors: authors.length > 0 ? authors : ['susul'],
      collection: collection || 'Default',
      pages,
      createdAt: new Date(createdAt as number).toISOString(),
      updatedAt: new Date(updatedAt as number).toISOString(),
      source: source || 'user',
    };
  }

  async addBundle(bundle: IBundle): Promise<void> {
    if (!this.db) return;
    const createdAt = new Date(bundle.createdAt).getTime();
    const updatedAt = new Date(bundle.updatedAt).getTime();
    this.db.run('INSERT INTO products (id, name, created_at, updated_at, source, collection) VALUES (?, ?, ?, ?, ?, ?)', [
      bundle.id,
      bundle.name,
      createdAt,
      updatedAt,
      bundle.source || 'user',
      bundle.collection || 'Default',
    ]);
    await this.syncTagsAndPages(bundle);
    await this.persist();
  }

  async updateBundle(bundle: IBundle): Promise<void> {
    if (!this.db) return;
    const updatedAt = new Date(bundle.updatedAt).getTime();
    this.db.run('UPDATE products SET name = ?, updated_at = ?, source = ?, collection = ? WHERE id = ?', [
      bundle.name,
      updatedAt,
      bundle.source || 'user',
      bundle.collection || 'Default',
      bundle.id,
    ]);
    this.db.run('DELETE FROM product_tags WHERE product_id = ?', [bundle.id]);
    this.db.run('DELETE FROM product_authors WHERE product_id = ?', [bundle.id]);
    this.db.run('DELETE FROM images WHERE product_id = ?', [bundle.id]);
    this.db.run('DELETE FROM pages WHERE product_id = ?', [bundle.id]);
    await this.syncTagsAndPages(bundle);
    await this.persist();
  }

  async updatePageContent(bundleId: string, pageId: string, content: string): Promise<void> {
    if (!this.db) return;
    const images = extractBase64Images(content);
    const cleanContent = replaceBase64WithPlaceholders(content, images);

    this.db.run('DELETE FROM images WHERE page_id = ?', [pageId]);
    this.db.run('UPDATE pages SET content = ? WHERE id = ? AND product_id = ?', [cleanContent, pageId, bundleId]);
    for (const img of images) {
      this.db.run(
        'INSERT INTO images (id, product_id, page_id, mime_type, data) VALUES (?, ?, ?, ?, ?)',
        [img.id, bundleId, pageId, img.mime, img.data],
      );
    }
    this.db.run('UPDATE products SET updated_at = ? WHERE id = ?', [Date.now(), bundleId]);
    await this.persist();
  }

  async deleteBundle(id: string): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM images WHERE product_id = ?', [id]);
    this.db.run('DELETE FROM pages WHERE product_id = ?', [id]);
    this.db.run('DELETE FROM product_tags WHERE product_id = ?', [id]);
    this.db.run('DELETE FROM product_authors WHERE product_id = ?', [id]);
    this.db.run('DELETE FROM products WHERE id = ?', [id]);
    await this.persist();
  }

  /** Estimate the "richness" of a bundle — more pages + more content = higher score. */
  private bundleRichnessScore(bundle: IBundle): number {
    let score = bundle.pages.length * 100;
    for (const page of bundle.pages) {
      score += page.content.length;
    }
    score += bundle.tags.length * 10;
    return score;
  }

  async importBundles(bundles: IBundle[]): Promise<{ added: number; updated: number; skipped: number }> {
    if (!this.db) return { added: 0, updated: 0, skipped: 0 };
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let txActive = false;
    this.db.run('BEGIN TRANSACTION');
    txActive = true;
    try {
      for (const bundle of bundles) {
        const existing = this.db.exec(
          'SELECT id, (SELECT COUNT(*) FROM pages WHERE product_id = products.id) as page_count FROM products WHERE name = ?',
          [bundle.name],
        );
        if (existing[0] && existing[0].values.length > 0) {
          const existingId = existing[0].values[0][0] as string;
          const existingPageCount = existing[0].values[0][1] as number;

          // Estimate existing richness (page count + rough content size)
          const contentRes = this.db.exec(
            "SELECT SUM(LENGTH(content)) FROM pages WHERE product_id = ?",
            [existingId],
          );
          const existingContentLen =
            contentRes[0]?.values?.[0]?.[0] != null
              ? (contentRes[0].values[0][0] as number)
              : 0;
          const existingScore = existingPageCount * 100 + existingContentLen;
          const incomingScore = this.bundleRichnessScore(bundle);

          // Only update if the incoming bundle is richer (more data)
          if (incomingScore <= existingScore) {
            skipped++;
            continue;
          }

          const updatedBundle: IBundle = {
            ...bundle,
            id: existingId,
            updatedAt: new Date().toISOString(),
          };
          this.db.run('DELETE FROM product_tags WHERE product_id = ?', [existingId]);
          this.db.run('DELETE FROM product_authors WHERE product_id = ?', [existingId]);
          this.db.run('DELETE FROM images WHERE product_id = ?', [existingId]);
          this.db.run('DELETE FROM pages WHERE product_id = ?', [existingId]);
          this.db.run('UPDATE products SET name = ?, updated_at = ?, source = ?, collection = ? WHERE id = ?', [
            bundle.name,
            new Date().getTime(),
            bundle.source || 'user',
            bundle.collection || 'Default',
            existingId,
          ]);
          await this.syncTagsAndPages(updatedBundle);
          updated++;
        } else {
          const createdAt = new Date(bundle.createdAt).getTime();
          const updatedAt = new Date(bundle.updatedAt).getTime();
          this.db.run(
            'INSERT INTO products (id, name, created_at, updated_at, source, collection) VALUES (?, ?, ?, ?, ?, ?)',
            [bundle.id, bundle.name, createdAt, updatedAt, bundle.source || 'user', bundle.collection || 'Default'],
          );
          await this.syncTagsAndPages(bundle);
          added++;
        }
      }
      this.db.run('COMMIT');
      txActive = false;
    } catch (e) {
      if (txActive) {
        try {
          this.db.run('ROLLBACK');
        } catch {
          // 事务已不在活动状态，忽略
        }
        txActive = false;
      }
      throw e;
    }
    await this.persist();
    return { added, updated, skipped };
  }

  async exportDatabase(): Promise<Uint8Array> {
    if (!this.db) throw new Error('数据库未初始化');
    return this.db.export();
  }

  async importDatabase(data: Uint8Array): Promise<void> {
    const sql = await getSQL();
    if (this.db) {
      this.db.close();
    }
    this.db = new sql.Database(data);
    createSchema(this.db);
    migrateSchema(this.db);
    this._initialized = true;
    await this.persist();
  }

  async searchBundles(query: string): Promise<IBundle[]> {
    if (!this.db) return [];
    const like = `%${query}%`;
    const rows = this.db.exec(
      `SELECT DISTINCT p.id, p.name, p.created_at, p.updated_at, p.source
       FROM products p
       LEFT JOIN pages pg ON p.id = pg.product_id
       LEFT JOIN product_tags pt ON p.id = pt.product_id
       LEFT JOIN tags t ON pt.tag_id = t.id
       WHERE p.name LIKE ? OR pg.content LIKE ? OR t.name LIKE ?
       ORDER BY p.name`,
      [like, like, like],
    );
    if (!rows[0]) return [];
    const ids = rows[0].values.map((r) => r[0] as string);
    const all = await this.getAllBundles();
    return all.filter((p) => ids.includes(p.id));
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this._initialized = false;
    }
  }

  private async syncTagsAndPages(bundle: IBundle): Promise<void> {
    if (!this.db) return;
    // 同步标签
    for (const tag of bundle.tags) {
      this.db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tag]);
      const tagRow = this.db.exec('SELECT id FROM tags WHERE name = ?', [tag]);
      if (tagRow[0] && tagRow[0].values.length > 0) {
        const tagId = tagRow[0].values[0][0] as number;
        this.db.run('INSERT OR IGNORE INTO product_tags (product_id, tag_id) VALUES (?, ?)', [bundle.id, tagId]);
      }
    }
    // 同步作者
    const authors = bundle.authors && bundle.authors.length > 0 ? bundle.authors : ['susul'];
    for (const author of authors) {
      this.db.run('INSERT OR IGNORE INTO authors (name) VALUES (?)', [author]);
      const authorRow = this.db.exec('SELECT id FROM authors WHERE name = ?', [author]);
      if (authorRow[0] && authorRow[0].values.length > 0) {
        const authorId = authorRow[0].values[0][0] as number;
        this.db.run('INSERT OR IGNORE INTO product_authors (product_id, author_id) VALUES (?, ?)', [bundle.id, authorId]);
      }
    }
    // 同步页面并提取图片
    for (const page of bundle.pages) {
      const images = extractBase64Images(page.content);
      const cleanContent = replaceBase64WithPlaceholders(page.content, images);
      this.db.run(
        'INSERT INTO pages (id, product_id, title, content, page_order) VALUES (?, ?, ?, ?, ?)',
        [page.id, bundle.id, page.title, cleanContent, page.order],
      );
      // 存储图片为 BLOB
      for (const img of images) {
        this.db.run(
          'INSERT INTO images (id, product_id, page_id, mime_type, data) VALUES (?, ?, ?, ?, ?)',
          [img.id, bundle.id, page.id, img.mime, img.data],
        );
      }
    }
  }
}

// 单例
let storageInstance: SQLiteStorage | null = null;

export function getSQLiteStorage(): SQLiteStorage {
  if (!storageInstance) {
    storageInstance = new SQLiteStorage();
  }
  return storageInstance;
}

export function resetSQLiteStorage(): void {
  if (storageInstance) {
    storageInstance.close();
    storageInstance = null;
  }
}

// 用于跨格式导出：JSON 数据 → SQLite DB 二进制
export async function jsonBundlesToSQLite(bundles: IBundle[]): Promise<Uint8Array> {
  const sql = await getSQL();
  const db = new sql.Database();
  createSchema(db);
  const tempStorage = new SQLiteStorage();
  // 临时绕过单例直接操作
  (tempStorage as unknown as { db: Database | null }).db = db;
  (tempStorage as unknown as { _initialized: boolean })._initialized = true;
  for (const bundle of bundles) {
    await tempStorage.addBundle(bundle);
  }
  const data = db.export();
  db.close();
  return data;
}

// 从 SQLite DB 二进制读取所有 bundles（用于下载合并，不影响当前数据库）
export async function bundlesFromDbBytes(data: Uint8Array): Promise<IBundle[]> {
  const sql = await getSQL();
  const db = new sql.Database(data);
  createSchema(db);
  migrateSchema(db);
  const tempStorage = new SQLiteStorage();
  (tempStorage as unknown as { db: Database | null }).db = db;
  (tempStorage as unknown as { _initialized: boolean })._initialized = true;
  const bundles = await tempStorage.getAllBundles();
  db.close();
  return bundles;
}

