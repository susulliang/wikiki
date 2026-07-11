import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { getSQLiteStorage, resetSQLiteStorage, jsonProductsToSQLite, type StorageInfo } from '@/lib/sqlite-storage';
import type { IProduct } from '@/data/products';
import { denormalizeProduct } from '@/data/products';

export type StorageMode = 'json' | 'sqlite';

interface StorageModeContextValue {
  mode: StorageMode;
  sqliteInfo: StorageInfo | null;
  sqliteReady: boolean;
  sqliteLoading: boolean;
  sqliteError: string | null;
  switchMode: (newMode: StorageMode, migrate?: boolean) => Promise<void>;
  /** 导入产品到当前存储模式 */
  importProducts: (products: IProduct[]) => Promise<{ added: number; updated: number }>;
  /** 从当前存储模式导出 JSON */
  exportProductsJSON: () => Promise<void>;
  /** 导出 SQLite 数据库 .db 文件（跨格式支持） */
  exportSQLiteDB: () => Promise<void>;
  /** 导入 SQLite .db 文件 */
  importSQLiteDB: (data: Uint8Array) => Promise<void>;
  /** 重新加载 SQLite 产品数据 */
  reloadSQLiteProducts: () => Promise<IProduct[]>;
}

const StorageModeContext = createContext<StorageModeContextValue | null>(null);

const MODE_KEY = '__wikiki_storage_mode';

function loadMode(): StorageMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === 'json') return 'json';
    if (saved === 'sqlite') return 'sqlite';
  } catch {
    // 忽略
  }
  return 'sqlite';
}

function saveMode(mode: StorageMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // 忽略
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StorageModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<StorageMode>(loadMode);
  const [sqliteInfo, setSqliteInfo] = useState<StorageInfo | null>(null);
  const [sqliteReady, setSqliteReady] = useState(false);
  const [sqliteLoading, setSqliteLoading] = useState(false);
  const [sqliteError, setSqliteError] = useState<string | null>(null);

  // 如果模式是 sqlite，初始化 SQLite
  useEffect(() => {
    if (mode !== 'sqlite') {
      setSqliteReady(false);
      setSqliteInfo(null);
      setSqliteError(null);
      return;
    }
    let cancelled = false;
    async function init() {
      setSqliteLoading(true);
      setSqliteError(null);
      try {
        const storage = getSQLiteStorage();
        await storage.init();
        if (!cancelled) {
          const info = await storage.getInfo();
          setSqliteInfo(info);
          setSqliteReady(true);
        }
      } catch (e) {
        console.error('SQLite initialization failed:', String(e));
        if (!cancelled) {
          setSqliteError(String(e));
          // Don't automatically downgrade, let the user see the error
          toast.error(`SQLite initialization failed: ${String(e).slice(0, 80)}`);
        }
      } finally {
        if (!cancelled) setSqliteLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [mode]);

  const reloadSQLiteProducts = useCallback(async (): Promise<IProduct[]> => {
    if (mode !== 'sqlite') return [];
    const storage = getSQLiteStorage();
    if (!storage.initialized) await storage.init();
    const prods = await storage.getAllProducts();
    const info = await storage.getInfo();
    setSqliteInfo(info);
    return prods;
  }, [mode]);

  const switchMode = useCallback(async (newMode: StorageMode, migrate = false) => {
    if (newMode === mode) return;

    if (migrate) {
      if (newMode === 'sqlite') {
        // JSON → SQLite
        try {
          const raw = localStorage.getItem('__wikiki_products');
          const storage = getSQLiteStorage();
          await storage.init();
          if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data) && data.length > 0) {
              const { normalizeProduct } = await import('@/data/products');
              const products = data.map((item: Record<string, unknown>) => normalizeProduct(item));
              await storage.importProducts(products);
            }
          }
        } catch (e) {
          console.error('Migration to SQLite failed:', String(e));
          toast.error(`Migration failed: ${String(e).slice(0, 80)}`);
          throw e;
        }
      } else {
        // SQLite → JSON
        try {
          const storage = getSQLiteStorage();
          if (storage.initialized) {
            const products = await storage.getAllProducts();
            const exportData = products.map(denormalizeProduct);
            localStorage.setItem('__wikiki_products', JSON.stringify(exportData));
            localStorage.setItem('__wikiki_data_version', '2');
          }
        } catch (e) {
          console.error('Migration to JSON failed:', String(e));
          toast.error(`Migration failed: ${String(e).slice(0, 80)}`);
          throw e;
        }
      }
    }

    if (mode === 'sqlite') {
      resetSQLiteStorage();
    }

    setMode(newMode);
    saveMode(newMode);
  }, [mode]);

  const importProducts = useCallback(async (products: IProduct[]): Promise<{ added: number; updated: number }> => {
    if (mode === 'sqlite') {
      const storage = getSQLiteStorage();
      if (!storage.initialized) await storage.init();
      const result = await storage.importProducts(products);
      const info = await storage.getInfo();
      setSqliteInfo(info);
      return result;
    }
    return { added: 0, updated: 0 };
  }, [mode]);

  const exportProductsJSON = useCallback(async (): Promise<void> => {
    let products: IProduct[];
    if (mode === 'sqlite') {
      const storage = getSQLiteStorage();
      if (!storage.initialized) await storage.init();
      products = await storage.getAllProducts();
    } else {
      // JSON 模式下由调用方传入数据，这里只做兜底
      const raw = localStorage.getItem('__wikiki_products');
      if (!raw) {
        toast.error('No data to export');
        return;
      }
      const { normalizeProduct } = await import('@/data/products');
      const data = JSON.parse(raw);
      products = data.map((item: Record<string, unknown>) => normalizeProduct(item));
    }
    const exportData = products.map(denormalizeProduct);
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    triggerDownload(blob, `wikiki-export-${getDateStamp()}.json`);
  }, [mode]);

  const exportSQLiteDB = useCallback(async (): Promise<void> => {
    if (mode === 'sqlite') {
      const storage = getSQLiteStorage();
      if (!storage.initialized) await storage.init();
      const data = await storage.exportDatabase();
      const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
      triggerDownload(blob, `wikiki-db-${getDateStamp()}.db`);
    } else {
      // JSON 模式：将 JSON 数据转换为 SQLite 格式导出
      toast.info('Converting to SQLite format...');
      const raw = localStorage.getItem('__wikiki_products');
      let products: IProduct[] = [];
      if (raw) {
        const { normalizeProduct } = await import('@/data/products');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          products = data.map((item: Record<string, unknown>) => normalizeProduct(item));
        }
      }
      const data = await jsonProductsToSQLite(products);
      const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
      triggerDownload(blob, `wikiki-db-${getDateStamp()}.db`);
      toast.success('SQLite database file exported');
    }
  }, [mode]);

  const importSQLiteDB = useCallback(async (data: Uint8Array): Promise<void> => {
    const storage = getSQLiteStorage();
    await storage.importDatabase(data);
    const info = await storage.getInfo();
    setSqliteInfo(info);
    // 如果当前不是 sqlite 模式，自动切换
    if (mode !== 'sqlite') {
      setMode('sqlite');
      saveMode('sqlite');
    }
  }, [mode]);

  return (
    <StorageModeContext.Provider
      value={{
        mode,
        sqliteInfo,
        sqliteReady,
        sqliteLoading,
        sqliteError,
        switchMode,
        importProducts,
        exportProductsJSON,
        exportSQLiteDB,
        importSQLiteDB,
        reloadSQLiteProducts,
      }}
    >
      {children}
    </StorageModeContext.Provider>
  );
}

export function useStorageMode(): StorageModeContextValue {
  const ctx = useContext(StorageModeContext);
  if (!ctx) throw new Error('useStorageMode 必须在 StorageModeProvider 内使用');
  return ctx;
}
