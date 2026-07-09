import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { logger } from '@lark-apaas/client-toolkit-lite';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { IProduct, IPage } from '@/data/products';
import { normalizeProduct, denormalizeProduct } from '@/data/products';

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
      logger.info(`Trying to load sql.js WASM from CDN ${baseUrl}`);
      const result = await initSqlJs({
        locateFile: (file: string) => `${baseUrl}${file}`,
      });
      logger.info(`Successfully loaded sql.js WASM from CDN ${baseUrl}`);
      return result;
    } catch (e) {
      lastError = e;
      logger.warn(`Failed to load sql.js WASM from CDN ${baseUrl}: ${String(e)}`);
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
        logger.info(`Trying to load from local WASM: ${wasmUrl}`);
        const result = await initSqlJs({
          locateFile: () => wasmUrl,
        });
        logger.info('Successfully loaded sql.js from local WASM');
        return result;
      } catch (e) {
        logger.warn(`Local WASM load failed, falling back to CDN: ${String(e)}`);
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
    logger.warn('OPFS not available, falling back to IndexedDB');
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
    source TEXT DEFAULT 'user'
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

  async getAllProductsShallow(): Promise<IProduct[]> {
    if (!this.db) return [];
    const prodRows = this.db.exec(
      'SELECT id, name, created_at, updated_at, source FROM products ORDER BY updated_at DESC',
    );
    if (!prodRows[0]) return [];

    const products: IProduct[] = [];
    for (const row of prodRows[0].values) {
      const [pid, name, createdAt, updatedAt, source] = row as [string, string, number, number, string];

      const tagRows = this.db.exec(
        'SELECT t.name FROM tags t JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = ?',
        [pid],
      );
      const tags: string[] = tagRows[0] ? tagRows[0].values.map((r) => r[0] as string) : [];

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

      products.push({
        id: pid,
        name,
        tags,
        pages,
        createdAt: new Date(createdAt as number).toISOString(),
        updatedAt: new Date(updatedAt as number).toISOString(),
        source: source || 'user',
      });
    }
    return products;
  }

  async getAllProducts(): Promise<IProduct[]> {
    if (!this.db) return [];
    const products: IProduct[] = [];
    const prodRows = this.db.exec('SELECT id, name, created_at, updated_at, source FROM products ORDER BY name');
    if (!prodRows[0]) return [];

    for (const row of prodRows[0].values) {
      const [id, name, createdAt, updatedAt, source] = row as [string, string, number, number, string];
      // 获取标签
      const tagRows = this.db.exec(
        'SELECT t.name FROM tags t JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = ?',
        [id],
      );
      const tags: string[] = tagRows[0] ? tagRows[0].values.map((r) => r[0] as string) : [];

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
      products.push({
        id,
        name,
        tags,
        pages,
        createdAt: new Date(createdAt as number).toISOString(),
        updatedAt: new Date(updatedAt as number).toISOString(),
        source: source || 'user',
      });
    }
    return products;
  }

  async getProduct(id: string): Promise<IProduct | null> {
    if (!this.db) return null;
    // Fetch only the product with the given id, not all products
    const prodRows = this.db.exec(
      'SELECT id, name, created_at, updated_at, source FROM products WHERE id = ?',
      [id],
    );
    if (!prodRows[0] || prodRows[0].values.length === 0) return null;

    const [pid, name, createdAt, updatedAt, source] = prodRows[0].values[0] as [string, string, number, number, string];

    const tagRows = this.db.exec(
      'SELECT t.name FROM tags t JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = ?',
      [pid],
    );
    const tags: string[] = tagRows[0] ? tagRows[0].values.map((r) => r[0] as string) : [];

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
      pages,
      createdAt: new Date(createdAt as number).toISOString(),
      updatedAt: new Date(updatedAt as number).toISOString(),
      source: source || 'user',
    };
  }

  async addProduct(product: IProduct): Promise<void> {
    if (!this.db) return;
    const createdAt = new Date(product.createdAt).getTime();
    const updatedAt = new Date(product.updatedAt).getTime();
    this.db.run('INSERT INTO products (id, name, created_at, updated_at, source) VALUES (?, ?, ?, ?, ?)', [
      product.id,
      product.name,
      createdAt,
      updatedAt,
      product.source || 'user',
    ]);
    await this.syncTagsAndPages(product);
    await this.persist();
  }

  async updateProduct(product: IProduct): Promise<void> {
    if (!this.db) return;
    const updatedAt = new Date(product.updatedAt).getTime();
    this.db.run('UPDATE products SET name = ?, updated_at = ?, source = ? WHERE id = ?', [
      product.name,
      updatedAt,
      product.source || 'user',
      product.id,
    ]);
    this.db.run('DELETE FROM product_tags WHERE product_id = ?', [product.id]);
    this.db.run('DELETE FROM images WHERE product_id = ?', [product.id]);
    this.db.run('DELETE FROM pages WHERE product_id = ?', [product.id]);
    await this.syncTagsAndPages(product);
    await this.persist();
  }

  async updatePageContent(productId: string, pageId: string, content: string): Promise<void> {
    if (!this.db) return;
    const images = extractBase64Images(content);
    const cleanContent = replaceBase64WithPlaceholders(content, images);

    this.db.run('DELETE FROM images WHERE page_id = ?', [pageId]);
    this.db.run('UPDATE pages SET content = ? WHERE id = ? AND product_id = ?', [cleanContent, pageId, productId]);
    for (const img of images) {
      this.db.run(
        'INSERT INTO images (id, product_id, page_id, mime_type, data) VALUES (?, ?, ?, ?, ?)',
        [img.id, productId, pageId, img.mime, img.data],
      );
    }
    this.db.run('UPDATE products SET updated_at = ? WHERE id = ?', [Date.now(), productId]);
    await this.persist();
  }

  async deleteProduct(id: string): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM images WHERE product_id = ?', [id]);
    this.db.run('DELETE FROM pages WHERE product_id = ?', [id]);
    this.db.run('DELETE FROM product_tags WHERE product_id = ?', [id]);
    this.db.run('DELETE FROM products WHERE id = ?', [id]);
    await this.persist();
  }

  async importProducts(products: IProduct[]): Promise<{ added: number; updated: number }> {
    if (!this.db) return { added: 0, updated: 0 };
    let added = 0;
    let updated = 0;
    this.db.run('BEGIN TRANSACTION');
    try {
      for (const product of products) {
        // 按 name 查询是否已存在
        const existing = this.db.exec('SELECT id FROM products WHERE name = ?', [product.name]);
        if (existing[0] && existing[0].values.length > 0) {
          // 存在：使用原 ID 更新
          const existingId = existing[0].values[0][0] as string;
          const updatedProduct: IProduct = {
            ...product,
            id: existingId,
            updatedAt: new Date().toISOString(),
          };
          // 删除旧的标签和页面
          this.db.run('DELETE FROM product_tags WHERE product_id = ?', [existingId]);
          this.db.run('DELETE FROM images WHERE product_id = ?', [existingId]);
          this.db.run('DELETE FROM pages WHERE product_id = ?', [existingId]);
          // 更新产品信息
          this.db.run('UPDATE products SET name = ?, updated_at = ?, source = ? WHERE id = ?', [
            product.name,
            new Date().getTime(),
            product.source || 'user',
            existingId,
          ]);
          // 重新同步标签和页面
          await this.syncTagsAndPages(updatedProduct);
          updated++;
        } else {
          // 不存在：新增
          await this.addProduct(product);
          added++;
        }
      }
      this.db.run('COMMIT');
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
    await this.persist();
    return { added, updated };
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
    this._initialized = true;
    await this.persist();
  }

  async searchProducts(query: string): Promise<IProduct[]> {
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
    const all = await this.getAllProducts();
    return all.filter((p) => ids.includes(p.id));
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this._initialized = false;
    }
  }

  private async syncTagsAndPages(product: IProduct): Promise<void> {
    if (!this.db) return;
    // 同步标签
    for (const tag of product.tags) {
      this.db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tag]);
      const tagRow = this.db.exec('SELECT id FROM tags WHERE name = ?', [tag]);
      if (tagRow[0] && tagRow[0].values.length > 0) {
        const tagId = tagRow[0].values[0][0] as number;
        this.db.run('INSERT OR IGNORE INTO product_tags (product_id, tag_id) VALUES (?, ?)', [product.id, tagId]);
      }
    }
    // 同步页面并提取图片
    for (const page of product.pages) {
      const images = extractBase64Images(page.content);
      const cleanContent = replaceBase64WithPlaceholders(page.content, images);
      this.db.run(
        'INSERT INTO pages (id, product_id, title, content, page_order) VALUES (?, ?, ?, ?, ?)',
        [page.id, product.id, page.title, cleanContent, page.order],
      );
      // 存储图片为 BLOB
      for (const img of images) {
        this.db.run(
          'INSERT INTO images (id, product_id, page_id, mime_type, data) VALUES (?, ?, ?, ?, ?)',
          [img.id, product.id, page.id, img.mime, img.data],
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
export async function jsonProductsToSQLite(products: IProduct[]): Promise<Uint8Array> {
  const sql = await getSQL();
  const db = new sql.Database();
  createSchema(db);
  const tempStorage = new SQLiteStorage();
  // 临时绕过单例直接操作
  (tempStorage as unknown as { db: Database | null }).db = db;
  (tempStorage as unknown as { _initialized: boolean })._initialized = true;
  for (const product of products) {
    await tempStorage.addProduct(product);
  }
  const data = db.export();
  db.close();
  return data;
}
