import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { getSQLiteStorage, type StorageInfo } from '@/lib/sqlite-storage';
import type { IBundle } from '@/data/bundles';
import { denormalizeBundle } from '@/data/bundles';

interface StorageContextValue {
  sqliteInfo: StorageInfo | null;
  sqliteReady: boolean;
  sqliteLoading: boolean;
  sqliteError: string | null;
  /** Import bundles into the SQLite database (merge by name, keep richer copy) */
  importBundles: (bundles: IBundle[]) => Promise<{ added: number; updated: number; skipped: number }>;
  /** Export all bundles as a JSON file download */
  exportBundlesJSON: () => Promise<void>;
  /** Export the SQLite database as a .db file download */
  exportSQLiteDB: () => Promise<void>;
  /** Import a SQLite .db file (replaces the current database) */
  importSQLiteDB: (data: Uint8Array) => Promise<void>;
  /** Reload all bundles from SQLite and refresh storage info */
  reloadSQLiteBundles: () => Promise<IBundle[]>;
}

const StorageContext = createContext<StorageContextValue | null>(null);

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
  const [sqliteInfo, setSqliteInfo] = useState<StorageInfo | null>(null);
  const [sqliteReady, setSqliteReady] = useState(false);
  const [sqliteLoading, setSqliteLoading] = useState(false);
  const [sqliteError, setSqliteError] = useState<string | null>(null);

  // SQLite is now the only storage mode — initialize on mount.
  useEffect(() => {
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
          toast.error(`SQLite initialization failed: ${String(e).slice(0, 80)}`);
        }
      } finally {
        if (!cancelled) setSqliteLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const reloadSQLiteBundles = useCallback(async (): Promise<IBundle[]> => {
    const storage = getSQLiteStorage();
    if (!storage.initialized) await storage.init();
    const prods = await storage.getAllBundles();
    const info = await storage.getInfo();
    setSqliteInfo(info);
    return prods;
  }, []);

  const importBundles = useCallback(async (bundles: IBundle[]): Promise<{ added: number; updated: number; skipped: number }> => {
    const storage = getSQLiteStorage();
    if (!storage.initialized) await storage.init();
    const result = await storage.importBundles(bundles);
    const info = await storage.getInfo();
    setSqliteInfo(info);
    return result;
  }, []);

  const exportBundlesJSON = useCallback(async (): Promise<void> => {
    const storage = getSQLiteStorage();
    if (!storage.initialized) await storage.init();
    const bundles = await storage.getAllBundles();
    const exportData = bundles.map(denormalizeBundle);
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    triggerDownload(blob, `wikiki-export-${getDateStamp()}.json`);
  }, []);

  const exportSQLiteDB = useCallback(async (): Promise<void> => {
    const storage = getSQLiteStorage();
    if (!storage.initialized) await storage.init();
    const data = await storage.exportDatabase();
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
    triggerDownload(blob, `wikiki-db-${getDateStamp()}.db`);
  }, []);

  const importSQLiteDB = useCallback(async (data: Uint8Array): Promise<void> => {
    const storage = getSQLiteStorage();
    await storage.importDatabase(data);
    const info = await storage.getInfo();
    setSqliteInfo(info);
  }, []);

  return (
    <StorageContext.Provider
      value={{
        sqliteInfo,
        sqliteReady,
        sqliteLoading,
        sqliteError,
        importBundles,
        exportBundlesJSON,
        exportSQLiteDB,
        importSQLiteDB,
        reloadSQLiteBundles,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export function useStorageMode(): StorageContextValue {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorageMode must be used within StorageModeProvider');
  return ctx;
}
