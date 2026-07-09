import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { scopedStorage, logger } from '@lark-apaas/client-toolkit-lite';
import { toast } from 'sonner';
import { getSQLiteStorage, resetSQLiteStorage, jsonProductsToSQLite } from '@/lib/sqlite-storage';
import { denormalizeProduct } from '@/data/products';
const StorageModeContext = createContext(null);
const MODE_KEY = '__wikiki_storage_mode';
function loadMode() {
    try {
        const saved = scopedStorage.getItem(MODE_KEY);
        if (saved === 'sqlite')
            return 'sqlite';
    }
    catch {
        // 忽略
    }
    return 'json';
}
function saveMode(mode) {
    try {
        scopedStorage.setItem(MODE_KEY, mode);
    }
    catch {
        // 忽略
    }
}
function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
function getDateStamp() {
    return new Date().toISOString().slice(0, 10);
}
export function StorageModeProvider({ children }) {
    const [mode, setMode] = useState(loadMode);
    const [sqliteInfo, setSqliteInfo] = useState(null);
    const [sqliteReady, setSqliteReady] = useState(false);
    const [sqliteLoading, setSqliteLoading] = useState(false);
    const [sqliteError, setSqliteError] = useState(null);
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
            }
            catch (e) {
                logger.error('SQLite initialization failed:', String(e));
                if (!cancelled) {
                    setSqliteError(String(e));
                    // Don't automatically downgrade, let the user see the error
                    toast.error(`SQLite initialization failed: ${String(e).slice(0, 80)}`);
                }
            }
            finally {
                if (!cancelled)
                    setSqliteLoading(false);
            }
        }
        init();
        return () => { cancelled = true; };
    }, [mode]);
    const reloadSQLiteProducts = useCallback(async () => {
        if (mode !== 'sqlite')
            return [];
        const storage = getSQLiteStorage();
        if (!storage.initialized)
            await storage.init();
        const prods = await storage.getAllProducts();
        const info = await storage.getInfo();
        setSqliteInfo(info);
        return prods;
    }, [mode]);
    const switchMode = useCallback(async (newMode, migrate = false) => {
        if (newMode === mode)
            return;
        if (migrate) {
            if (newMode === 'sqlite') {
                // JSON → SQLite
                try {
                    const raw = scopedStorage.getItem('__wikiki_products');
                    const storage = getSQLiteStorage();
                    await storage.init();
                    if (raw) {
                        const data = JSON.parse(raw);
                        if (Array.isArray(data) && data.length > 0) {
                            const { normalizeProduct } = await import('@/data/products');
                            const products = data.map((item) => normalizeProduct(item));
                            await storage.importProducts(products);
                        }
                    }
                }
                catch (e) {
                    logger.error('Migration to SQLite failed:', String(e));
                    toast.error(`Migration failed: ${String(e).slice(0, 80)}`);
                    throw e;
                }
            }
            else {
                // SQLite → JSON
                try {
                    const storage = getSQLiteStorage();
                    if (storage.initialized) {
                        const products = await storage.getAllProducts();
                        const exportData = products.map(denormalizeProduct);
                        scopedStorage.setItem('__wikiki_products', JSON.stringify(exportData));
                        scopedStorage.setItem('__wikiki_data_version', '2');
                    }
                }
                catch (e) {
                    logger.error('Migration to JSON failed:', String(e));
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
    const importProducts = useCallback(async (products) => {
        if (mode === 'sqlite') {
            const storage = getSQLiteStorage();
            if (!storage.initialized)
                await storage.init();
            const result = await storage.importProducts(products);
            const info = await storage.getInfo();
            setSqliteInfo(info);
            return result;
        }
        return { added: 0, updated: 0 };
    }, [mode]);
    const exportProductsJSON = useCallback(async () => {
        let products;
        if (mode === 'sqlite') {
            const storage = getSQLiteStorage();
            if (!storage.initialized)
                await storage.init();
            products = await storage.getAllProducts();
        }
        else {
            // JSON 模式下由调用方传入数据，这里只做兜底
            const raw = scopedStorage.getItem('__wikiki_products');
            if (!raw) {
                toast.error('No data to export');
                return;
            }
            const { normalizeProduct } = await import('@/data/products');
            const data = JSON.parse(raw);
            products = data.map((item) => normalizeProduct(item));
        }
        const exportData = products.map(denormalizeProduct);
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        triggerDownload(blob, `wikiki-export-${getDateStamp()}.json`);
    }, [mode]);
    const exportSQLiteDB = useCallback(async () => {
        if (mode === 'sqlite') {
            const storage = getSQLiteStorage();
            if (!storage.initialized)
                await storage.init();
            const data = await storage.exportDatabase();
            const blob = new Blob([data.buffer], { type: 'application/x-sqlite3' });
            triggerDownload(blob, `wikiki-db-${getDateStamp()}.db`);
        }
        else {
            // JSON 模式：将 JSON 数据转换为 SQLite 格式导出
            toast.info('Converting to SQLite format...');
            const raw = scopedStorage.getItem('__wikiki_products');
            let products = [];
            if (raw) {
                const { normalizeProduct } = await import('@/data/products');
                const data = JSON.parse(raw);
                if (Array.isArray(data)) {
                    products = data.map((item) => normalizeProduct(item));
                }
            }
            const data = await jsonProductsToSQLite(products);
            const blob = new Blob([data.buffer], { type: 'application/x-sqlite3' });
            triggerDownload(blob, `wikiki-db-${getDateStamp()}.db`);
            toast.success('SQLite database file exported');
        }
    }, [mode]);
    const importSQLiteDB = useCallback(async (data) => {
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
    return (<StorageModeContext.Provider value={{
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
        }}>
      {children}
    </StorageModeContext.Provider>);
}
export function useStorageMode() {
    const ctx = useContext(StorageModeContext);
    if (!ctx)
        throw new Error('useStorageMode 必须在 StorageModeProvider 内使用');
    return ctx;
}
