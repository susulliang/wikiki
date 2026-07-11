import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { getSQLiteStorage, resetSQLiteStorage, jsonBundlesToSQLite, type StorageInfo } from '@/lib/sqlite-storage';
import type { IBundle } from '@/data/bundles';
import { denormalizeBundle } from '@/data/bundles';

export type StorageMode = 'json' | 'sqlite';

interface StorageModeContextValue {
  mode: StorageMode;
  sqliteInfo: StorageInfo | null;
  sqliteReady: boolean;
  sqliteLoading: boolean;
  sqliteError: string | null;
  switchMode: (newMode: StorageMode, migrate?: boolean) => Promise<void>;
  /** 导入产品到当前存储模式 */
  importBundles: (bundles: IBundle[]) => Promise<{ added: number; updated: number }>;
  /** 从当前存储模式导出 JSON */
  exportBundlesJSON: () => Promise<void>;
  /** 导出 SQLite 数据库 .db 文件（跨格式支持） */
  exportSQLiteDB: () => Promise<void>;
  /** 导入 SQLite .db 文件 */
  importSQLiteDB: (data: Uint8Array) => Promise<void>;
  /** 重新加载 SQLite 产品数据 */
  reloadSQLiteBundles: () => Promise<IBundle[]>;
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

  const reloadSQLiteBundles = useCallback(async (): Promise<IBundle[]> => {
    if (mode !== 'sqlite') return [];
    const storage = getSQLiteStorage();
    if (!storage.initialized) await storage.init();
    const prods = await storage.getAllBundles();
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
          const raw = localStorage.getItem('__wikiki_bundles');
          const storage = getSQLiteStorage();
          await storage.init();
          if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data) && data.length > 0) {
              const { normalizeBundle } = await import('@/data/bundles');
              const bundles = data.map((item: Record<string, unknown>) => normalizeBundle(item));
              await storage.importBundles(bundles);
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
            const bundles = await storage.getAllBundles();
            const exportData = bundles.map(denormalizeBundle);
            localStorage.setItem('__wikiki_bundles', JSON.stringify(exportData));
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

  const importBundles = useCallback(async (bundles: IBundle[]): Promise<{ added: number; updated: number }> => {
    if (mode === 'sqlite') {
      const storage = getSQLiteStorage();
      if (!storage.initialized) await storage.init();
      const result = await storage.importBundles(bundles);
      const info = await storage.getInfo();
      setSqliteInfo(info);
      return result;
    }
    return { added: 0, updated: 0 };
  }, [mode]);

  const exportBundlesJSON = useCallback(async (): Promise<void> => {
    let bundles: IBundle[];
    if (mode === 'sqlite') {
      const storage = getSQLiteStorage();
      if (!storage.initialized) await storage.init();
      bundles = await storage.getAllBundles();
    } else {
      // JSON 模式下由调用方传入数据，这里只做兜底
      const raw = localStorage.getItem('__wikiki_bundles');
      if (!raw) {
        toast.error('No data to export');
        return;
      }
      const { normalizeBundle } = await import('@/data/bundles');
      const data = JSON.parse(raw);
      bundles = data.map((item: Record<string, unknown>) => normalizeBundle(item));
    }
    const exportData = bundles.map(denormalizeBundle);
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
      const raw = localStorage.getItem('__wikiki_bundles');
      let bundles: IBundle[] = [];
      if (raw) {
        const { normalizeBundle } = await import('@/data/bundles');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          bundles = data.map((item: Record<string, unknown>) => normalizeBundle(item));
        }
      }
      const data = await jsonBundlesToSQLite(bundles);
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
        importBundles,
        exportBundlesJSON,
        exportSQLiteDB,
        importSQLiteDB,
        reloadSQLiteBundles,
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
