import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Loader2, BookOpen } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import { scopedStorage, logger } from '@lark-apaas/client-toolkit-lite';
import AppSidebar from '@/components/AppSidebar';
import EmptyState from '@/components/EmptyState';
import ProductDetail from '@/components/ProductDetail';
import SuperSearchOverlay from '@/components/SuperSearchOverlay';
import { useStorageMode } from '@/lib/storage-context';
import { getSQLiteStorage } from '@/lib/sqlite-storage';
import { searchProducts } from '@/lib/search';
const SIDEBAR_KEY = '__wikiki_sidebar_collapsed';
const SELECTED_KEY = '__wikiki_selected_product_id';
const PAGE_INDEX_KEY = '__wikiki_selected_page_index';
export default function HomePage() {
    const { mode: storageMode, sqliteReady, reloadSQLiteProducts } = useStorageMode();
    // JSON 模式 hook
    const { products: jsonProducts, addProduct: jsonAddProduct, updateProduct: jsonUpdateProduct, deleteProduct: jsonDeleteProduct, addPage: jsonAddPage, deletePage: jsonDeletePage, updatePageContent: jsonUpdatePageContent, reorderPages: jsonReorderPages, importProducts: jsonImportProducts, exportProducts: jsonExportProducts, getProduct: jsonGetProduct, } = useProducts();
    useEffect(() => {
        document.title = 'Wikiki';
    }, []);
    const [sidebarHidden, setSidebarHidden] = useState(false);
    // SQLite 模式状态
    const [selectedProductId, setSelectedProductId] = useState(() => {
        try {
            return scopedStorage.getItem(SELECTED_KEY) || null;
        }
        catch {
            return null;
        }
    });
    const [selectedPageIndex, setSelectedPageIndex] = useState(() => {
        try {
            const stored = scopedStorage.getItem(PAGE_INDEX_KEY);
            return stored ? parseInt(stored, 10) : 0;
        }
        catch {
            return 0;
        }
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTags, setFilterTags] = useState([]);
    const [superSearchOpen, setSuperSearchOpen] = useState(false);
    const [superSearchQuery, setSuperSearchQuery] = useState('');
    const { theme, toggleTheme, setTheme } = useTheme();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return scopedStorage.getItem(SIDEBAR_KEY) === 'true';
        }
        catch {
            return false;
        }
    });
    const [sqliteProducts, setSqliteProducts] = useState([]);
    const [loadedProductContent, setLoadedProductContent] = useState(new Map());
    const sqliteLoaded = useRef(false);
    useEffect(() => {
        if (storageMode !== 'sqlite' || !sqliteReady)
            return;
        sqliteLoaded.current = true;
        const storage = getSQLiteStorage();
        storage.getAllProductsShallow().then((prods) => {
            setSqliteProducts(prods);
        }).catch((e) => {
            logger.error('加载 SQLite 产品失败:', String(e));
        });
    }, [storageMode, sqliteReady]);
    useEffect(() => {
        if (storageMode !== 'sqlite' || !selectedProductId)
            return;
        if (loadedProductContent.has(selectedProductId))
            return;
        const storage = getSQLiteStorage();
        storage.getProduct(selectedProductId).then((fullProduct) => {
            if (fullProduct) {
                setLoadedProductContent((prev) => new Map(prev).set(selectedProductId, fullProduct));
            }
        }).catch((e) => {
            logger.error('加载产品内容失败:', String(e));
        });
    }, [storageMode, selectedProductId, loadedProductContent]);
    useEffect(() => {
        if (storageMode === 'json') {
            sqliteLoaded.current = false;
            setLoadedProductContent(new Map());
        }
    }, [storageMode]);
    const handleReloadSQLite = useCallback(async () => {
        if (storageMode !== 'sqlite')
            return;
        const prods = await reloadSQLiteProducts();
        setSqliteProducts(prods);
        setLoadedProductContent(new Map());
    }, [storageMode, reloadSQLiteProducts]);
    const products = useMemo(() => {
        if (storageMode === 'json')
            return jsonProducts;
        return sqliteProducts.map((p) => {
            if (p.id === selectedProductId && loadedProductContent.has(p.id)) {
                return loadedProductContent.get(p.id);
            }
            return p;
        });
    }, [storageMode, jsonProducts, sqliteProducts, selectedProductId, loadedProductContent]);
    const selectedProduct = useMemo(() => products.find((p) => p.id === selectedProductId) ?? null, [products, selectedProductId]);
    const searchResults = useMemo(() => (superSearchQuery.trim() ? searchProducts(products, superSearchQuery.trim()) : []), [products, superSearchQuery]);
    const handleSelectProduct = useCallback((id) => {
        setSelectedProductId(id);
        setSuperSearchOpen(false);
        setSuperSearchQuery('');
        setSelectedPageIndex(0);
        try {
            scopedStorage.setItem(SELECTED_KEY, id);
        }
        catch {
            // 忽略
        }
    }, []);
    const handleDeleteProduct = useCallback(async (id) => {
        if (storageMode === 'sqlite') {
            const storage = getSQLiteStorage();
            await storage.deleteProduct(id);
            await handleReloadSQLite();
        }
        else {
            jsonDeleteProduct(id);
        }
        if (selectedProductId === id) {
            setSelectedProductId(null);
            try {
                scopedStorage.setItem(SELECTED_KEY, '');
            }
            catch {
                // 忽略
            }
        }
    }, [storageMode, jsonDeleteProduct, selectedProductId, handleReloadSQLite]);
    const handlePageChange = useCallback((index) => {
        setSelectedPageIndex(index);
        try {
            scopedStorage.setItem(PAGE_INDEX_KEY, String(index));
        }
        catch {
            // 忽略
        }
    }, []);
    const handleToggleCollapse = useCallback(() => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            try {
                scopedStorage.setItem(SIDEBAR_KEY, String(next));
            }
            catch {
                // 忽略
            }
            return next;
        });
    }, []);
    const handleTagToggle = useCallback((tag) => {
        setFilterTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    }, []);
    const handleSearchChange = useCallback((query) => {
        setSearchQuery(query);
    }, []);
    const handleSearchResultSelect = useCallback((result) => {
        setSelectedProductId(result.productId);
        setSelectedPageIndex(result.pageIndex ?? 0);
        setSuperSearchOpen(false);
        setSuperSearchQuery('');
        try {
            scopedStorage.setItem(SELECTED_KEY, result.productId);
            scopedStorage.setItem(PAGE_INDEX_KEY, String(result.pageIndex ?? 0));
        }
        catch {
            // 忽略
        }
    }, []);
    const handleOpenSuperSearch = useCallback(() => {
        setSuperSearchOpen(true);
    }, []);
    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setSuperSearchOpen(true);
                return;
            }
            if (event.key === 'Escape') {
                setSuperSearchOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    useEffect(() => {
        if (!superSearchOpen) {
            document.body.style.removeProperty('overflow');
            return;
        }
        document.body.style.setProperty('overflow', 'hidden');
        return () => document.body.style.removeProperty('overflow');
    }, [superSearchOpen]);
    const handleCreateProduct = useCallback(() => {
        setTriggerAddDialog(true);
    }, []);
    const handleImportJSON = useCallback(() => {
        setTriggerImportJSON(true);
    }, []);
    const handleImportDB = useCallback(() => {
        setTriggerImportDB(true);
    }, []);
    const [triggerAddDialog, setTriggerAddDialog] = useState(false);
    const [triggerImportJSON, setTriggerImportJSON] = useState(false);
    const [triggerImportDB, setTriggerImportDB] = useState(false);
    // 添加产品（同步返回 IProduct）
    const handleAddProductFromSidebar = useCallback((name, tags) => {
        const now = new Date().toISOString();
        const newProduct = {
            id: `user-${Date.now()}`,
            name,
            tags,
            pages: [
                {
                    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    title: '主页',
                    name: '主页',
                    content: '',
                    order: 0,
                    createdAt: now,
                    updatedAt: now,
                },
            ],
            createdAt: now,
            updatedAt: now,
            source: 'user',
        };
        if (storageMode === 'sqlite') {
            // 异步执行但不等待（保持同步返回签名）
            (async () => {
                try {
                    const storage = getSQLiteStorage();
                    if (!storage.initialized)
                        await storage.init();
                    await storage.addProduct(newProduct);
                    const prods = await reloadSQLiteProducts();
                    setSqliteProducts(prods);
                }
                catch (e) {
                    logger.error('SQLite 添加产品失败:', String(e));
                }
            })();
        }
        else {
            jsonAddProduct(name, tags);
        }
        setSelectedProductId(newProduct.id);
        try {
            scopedStorage.setItem(SELECTED_KEY, newProduct.id);
        }
        catch {
            // 忽略
        }
        setTriggerAddDialog(false);
        return newProduct;
    }, [storageMode, jsonAddProduct, reloadSQLiteProducts]);
    const handleUpdateProduct = useCallback(async (id, name, tags) => {
        if (storageMode === 'sqlite') {
            const storage = getSQLiteStorage();
            const product = await storage.getProduct(id);
            if (product) {
                product.name = name;
                product.tags = tags;
                product.updatedAt = new Date().toISOString();
                await storage.updateProduct(product);
                await handleReloadSQLite();
            }
        }
        else {
            jsonUpdateProduct(id, name, tags);
        }
    }, [storageMode, jsonUpdateProduct, handleReloadSQLite]);
    const handleAddPage = useCallback(async (productId, pageName) => {
        const now = new Date().toISOString();
        const newPage = {
            id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: pageName,
            name: pageName,
            content: '',
            order: 0,
            createdAt: now,
            updatedAt: now,
        };
        if (storageMode === 'sqlite') {
            const storage = getSQLiteStorage();
            const product = await storage.getProduct(productId);
            if (product) {
                const maxOrder = product.pages.reduce((max, pg) => Math.max(max, pg.order), -1);
                newPage.order = maxOrder + 1;
                product.pages.push(newPage);
                product.updatedAt = now;
                await storage.updateProduct(product);
                await handleReloadSQLite();
                return newPage;
            }
            return null;
        }
        const result = jsonAddPage(productId, pageName);
        return result;
    }, [storageMode, jsonAddPage, handleReloadSQLite]);
    const handleDeletePage = useCallback(async (productId, pageId) => {
        if (storageMode === 'sqlite') {
            const storage = getSQLiteStorage();
            const product = await storage.getProduct(productId);
            if (product && product.pages.length > 1) {
                product.pages = product.pages.filter((pg) => pg.id !== pageId);
                product.updatedAt = new Date().toISOString();
                await storage.updateProduct(product);
                await handleReloadSQLite();
            }
        }
        else {
            jsonDeletePage(productId, pageId);
        }
    }, [storageMode, jsonDeletePage, handleReloadSQLite]);
    const handleUpdatePageContent = useCallback(async (productId, pageId, content) => {
        if (storageMode === 'sqlite') {
            const storage = getSQLiteStorage();
            // Use optimized updatePageContent method
            await storage.updatePageContent(productId, pageId, content);
            // Update the in-memory cache so we don't lose the edits
            setLoadedProductContent((prev) => {
                const cached = prev.get(productId);
                if (!cached)
                    return prev;
                const updatedPages = cached.pages.map((pg) => pg.id === pageId ? { ...pg, content, updatedAt: new Date().toISOString() } : pg);
                const updated = { ...cached, pages: updatedPages, updatedAt: new Date().toISOString() };
                return new Map(prev).set(productId, updated);
            });
        }
        else {
            jsonUpdatePageContent(productId, pageId, content);
        }
    }, [storageMode, jsonUpdatePageContent]);
    const handleReorderPages = useCallback(async (productId, reordered) => {
        if (storageMode === 'sqlite') {
            const storage = getSQLiteStorage();
            const product = await storage.getProduct(productId);
            if (product) {
                product.pages = reordered.map((pg, idx) => ({ ...pg, order: idx }));
                product.updatedAt = new Date().toISOString();
                await storage.updateProduct(product);
                await handleReloadSQLite();
            }
        }
        else {
            jsonReorderPages(productId, reordered);
        }
    }, [storageMode, jsonReorderPages, handleReloadSQLite]);
    const handleImportProductsJSON = useCallback((incoming) => {
        return jsonImportProducts(incoming);
    }, [jsonImportProducts]);
    const handleExportProductsJSON = useCallback(() => {
        jsonExportProducts();
    }, [jsonExportProducts]);
    const isLoadingContent = storageMode === 'sqlite' && selectedProductId !== null && !loadedProductContent.has(selectedProductId);
    const renderMainContent = () => {
        if (!selectedProduct) {
            return (<EmptyState onCreateProduct={handleCreateProduct} onImportJSON={handleImportJSON} onImportDB={handleImportDB}/>);
        }
        if (isLoadingContent) {
            return (<div className="flex h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <Loader2 className="size-8 animate-spin text-primary"/>
          <p className="text-sm text-muted-foreground italic">Loading content...</p>
        </div>);
        }
        return (<ProductDetail product={selectedProduct} pageIndex={selectedPageIndex} onPageChange={handlePageChange} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onAddPage={handleAddPage} onDeletePage={handleDeletePage} onUpdatePageContent={handleUpdatePageContent} onReorderPages={handleReorderPages}/>);
    };
    return (<div className="flex h-screen bg-background overflow-hidden">
      {!sidebarHidden ? (<AppSidebar products={products} selectedProductId={selectedProductId} collapsed={sidebarCollapsed} theme={theme} searchQuery={searchQuery} filterTags={filterTags} triggerAdd={triggerAddDialog} triggerImportJSON={triggerImportJSON} triggerImportDB={triggerImportDB} onSelectProduct={handleSelectProduct} onAddProduct={handleAddProductFromSidebar} onImportProductsJSON={handleImportProductsJSON} onExportProductsJSON={handleExportProductsJSON} onToggleCollapse={handleToggleCollapse} onToggleTheme={toggleTheme} onSetTheme={setTheme} onSearchChange={handleSearchChange} onOpenSuperSearch={handleOpenSuperSearch} onTagToggle={handleTagToggle} onTriggerAddHandled={() => setTriggerAddDialog(false)} onTriggerImportJSONHandled={() => setTriggerImportJSON(false)} onTriggerImportDBHandled={() => setTriggerImportDB(false)} onProductsChanged={handleReloadSQLite} onHideSidebar={() => setSidebarHidden(true)}/>) : (<button onClick={() => setSidebarHidden(false)} className="fixed bottom-6 left-6 z-[60] flex size-12 items-center justify-center rounded-full bg-primary shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95" title="显示侧边栏">
          <BookOpen className="size-6 text-primary-foreground"/>
        </button>)}
      <main className="flex-1 min-w-0 bg-background flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          {renderMainContent()}
        </div>
        <div className="py-1 px-4 text-center pointer-events-none select-none">
          <span className="text-[9px] text-foreground/5 font-mono">Wikiki Pro 0.1.2</span>
        </div>
      </main>
      <SuperSearchOverlay open={superSearchOpen} query={superSearchQuery} results={searchResults} onQueryChange={setSuperSearchQuery} onClose={() => setSuperSearchOpen(false)} onSelect={handleSearchResultSelect}/>
    </div>);
}
