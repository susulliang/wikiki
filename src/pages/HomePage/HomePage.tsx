import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import { scopedStorage, logger } from '@lark-apaas/client-toolkit-lite';
import AppSidebar from '@/components/AppSidebar';
import EmptyState from '@/components/EmptyState';
import SearchResults from '@/components/SearchResults';
import ProductDetail from '@/components/ProductDetail';
import { useStorageMode } from '@/lib/storage-context';
import { getSQLiteStorage } from '@/lib/sqlite-storage';
import type { IProduct, IPage, SearchResult } from '@/data/products';

const SIDEBAR_KEY = '__wikiki_sidebar_collapsed';
const SELECTED_KEY = '__wikiki_selected_product_id';
const PAGE_INDEX_KEY = '__wikiki_selected_page_index';

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

function searchProducts(products: IProduct[], query: string): SearchResult[] {
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const product of products) {
    if (product.name.toLowerCase().includes(q)) {
      results.push({
        productId: product.id,
        productName: product.name,
        pageId: null,
        pageName: null,
        snippet: product.name,
        matchType: 'name',
      });
    }

    for (const tag of product.tags) {
      if (tag.toLowerCase().includes(q)) {
        results.push({
          productId: product.id,
          productName: product.name,
          pageId: null,
          pageName: null,
          snippet: `标签: ${tag}`,
          matchType: 'tag',
        });
      }
    }

    for (const page of product.pages) {
      const text = stripHtml(page.content);
      const lower = text.toLowerCase();
      if (lower.includes(q)) {
        const idx = lower.indexOf(q);
        const start = Math.max(0, idx - 30);
        const end = Math.min(text.length, idx + q.length + 30);
        const snippet =
          (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');

        results.push({
          productId: product.id,
          productName: product.name,
          pageId: page.id,
          pageName: page.name,
          snippet,
          matchType: 'content',
        });
      }
    }
  }

  return results;
}

export default function HomePage() {
  const { mode: storageMode, sqliteReady, reloadSQLiteProducts } = useStorageMode();

  // JSON 模式 hook
  const {
    products: jsonProducts,
    addProduct: jsonAddProduct,
    updateProduct: jsonUpdateProduct,
    deleteProduct: jsonDeleteProduct,
    addPage: jsonAddPage,
    deletePage: jsonDeletePage,
    updatePageContent: jsonUpdatePageContent,
    reorderPages: jsonReorderPages,
    importProducts: jsonImportProducts,
    exportProducts: jsonExportProducts,
    getProduct: jsonGetProduct,
  } = useProducts();

  useEffect(() => {
    document.title = 'Wikiki';
  }, []);

  const [sidebarHidden, setSidebarHidden] = useState(false);

  // SQLite 模式状态
  const [selectedProductId, setSelectedProductId] = useState<string | null>(() => {
    try {
      return scopedStorage.getItem(SELECTED_KEY) || null;
    } catch {
      return null;
    }
  });

  const [selectedPageIndex, setSelectedPageIndex] = useState(() => {
    try {
      const stored = scopedStorage.getItem(PAGE_INDEX_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const { theme, toggleTheme, setTheme } = useTheme();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return scopedStorage.getItem(SIDEBAR_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [sqliteProducts, setSqliteProducts] = useState<IProduct[]>([]);
  const [loadedProductContent, setLoadedProductContent] = useState<Map<string, IProduct>>(new Map());
  const sqliteLoaded = useRef(false);

  useEffect(() => {
    if (storageMode !== 'sqlite' || !sqliteReady) return;
    sqliteLoaded.current = true;
    const storage = getSQLiteStorage();
    storage.getAllProductsShallow().then((prods) => {
      setSqliteProducts(prods);
    }).catch((e) => {
      logger.error('加载 SQLite 产品失败:', String(e));
    });
  }, [storageMode, sqliteReady]);

  useEffect(() => {
    if (storageMode !== 'sqlite' || !selectedProductId) return;
    if (loadedProductContent.has(selectedProductId)) return;

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
    if (storageMode !== 'sqlite') return;
    const prods = await reloadSQLiteProducts();
    setSqliteProducts(prods);
    setLoadedProductContent(new Map());
  }, [storageMode, reloadSQLiteProducts]);

  const products = useMemo(() => {
    if (storageMode === 'json') return jsonProducts;
    return sqliteProducts.map((p) => {
      if (p.id === selectedProductId && loadedProductContent.has(p.id)) {
        return loadedProductContent.get(p.id)!;
      }
      return p;
    });
  }, [storageMode, jsonProducts, sqliteProducts, selectedProductId, loadedProductContent]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const searchResults = useMemo(
    () => (globalSearchQuery.trim() ? searchProducts(products, globalSearchQuery.trim()) : []),
    [products, globalSearchQuery],
  );

  const isSearching = globalSearchQuery.trim().length > 0;

  const handleSelectProduct = useCallback(
    (id: string) => {
      setSelectedProductId(id);
      setGlobalSearchQuery('');
      setSelectedPageIndex(0);
      try {
        scopedStorage.setItem(SELECTED_KEY, id);
      } catch {
        // 忽略
      }
    },
    [],
  );

  const handleDeleteProduct = useCallback(
    async (id: string) => {
      if (storageMode === 'sqlite') {
        const storage = getSQLiteStorage();
        await storage.deleteProduct(id);
        await handleReloadSQLite();
      } else {
        jsonDeleteProduct(id);
      }
      if (selectedProductId === id) {
        setSelectedProductId(null);
        try {
          scopedStorage.setItem(SELECTED_KEY, '');
        } catch {
          // 忽略
        }
      }
    },
    [storageMode, jsonDeleteProduct, selectedProductId, handleReloadSQLite],
  );

  const handlePageChange = useCallback((index: number) => {
    setSelectedPageIndex(index);
    try {
      scopedStorage.setItem(PAGE_INDEX_KEY, String(index));
    } catch {
      // 忽略
    }
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        scopedStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {
        // 忽略
      }
      return next;
    });
  }, []);

  const handleTagToggle = useCallback((tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setGlobalSearchQuery(query.trim());
    } else {
      setGlobalSearchQuery('');
    }
  }, []);

  const handleSearchResultSelect = useCallback(
    (productId: string, pageIndex?: number) => {
      setSelectedProductId(productId);
      setSelectedPageIndex(pageIndex ?? 0);
      setGlobalSearchQuery('');
      try {
        scopedStorage.setItem(SELECTED_KEY, productId);
      } catch {
        // 忽略
      }
    },
    [],
  );

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
  const handleAddProductFromSidebar = useCallback(
    (name: string, tags: string[]): IProduct => {
      const now = new Date().toISOString();
      const newProduct: IProduct = {
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
            if (!storage.initialized) await storage.init();
            await storage.addProduct(newProduct);
            const prods = await reloadSQLiteProducts();
            setSqliteProducts(prods);
          } catch (e) {
            logger.error('SQLite 添加产品失败:', String(e));
          }
        })();
      } else {
        jsonAddProduct(name, tags);
      }

      setSelectedProductId(newProduct.id);
      try {
        scopedStorage.setItem(SELECTED_KEY, newProduct.id);
      } catch {
        // 忽略
      }
      setTriggerAddDialog(false);
      return newProduct;
    },
    [storageMode, jsonAddProduct, reloadSQLiteProducts],
  );

  const handleUpdateProduct = useCallback(
    async (id: string, name: string, tags: string[]) => {
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
      } else {
        jsonUpdateProduct(id, name, tags);
      }
    },
    [storageMode, jsonUpdateProduct, handleReloadSQLite],
  );

  const handleAddPage = useCallback(
    async (productId: string, pageName: string): Promise<IPage | null> => {
      const now = new Date().toISOString();
      const newPage: IPage = {
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
    },
    [storageMode, jsonAddPage, handleReloadSQLite],
  );

  const handleDeletePage = useCallback(
    async (productId: string, pageId: string) => {
      if (storageMode === 'sqlite') {
        const storage = getSQLiteStorage();
        const product = await storage.getProduct(productId);
        if (product && product.pages.length > 1) {
          product.pages = product.pages.filter((pg) => pg.id !== pageId);
          product.updatedAt = new Date().toISOString();
          await storage.updateProduct(product);
          await handleReloadSQLite();
        }
      } else {
        jsonDeletePage(productId, pageId);
      }
    },
    [storageMode, jsonDeletePage, handleReloadSQLite],
  );

  const handleUpdatePageContent = useCallback(
    async (productId: string, pageId: string, content: string) => {
      if (storageMode === 'sqlite') {
        const storage = getSQLiteStorage();
        // Use optimized updatePageContent method
        await storage.updatePageContent(productId, pageId, content);
        // Update the in-memory cache so we don't lose the edits
        setLoadedProductContent((prev) => {
          const cached = prev.get(productId);
          if (!cached) return prev;
          const updatedPages = cached.pages.map((pg) =>
            pg.id === pageId ? { ...pg, content, updatedAt: new Date().toISOString() } : pg,
          );
          const updated = { ...cached, pages: updatedPages, updatedAt: new Date().toISOString() };
          return new Map(prev).set(productId, updated);
        });
      } else {
        jsonUpdatePageContent(productId, pageId, content);
      }
    },
    [storageMode, jsonUpdatePageContent],
  );

  const handleReorderPages = useCallback(
    async (productId: string, reordered: IProduct['pages']) => {
      if (storageMode === 'sqlite') {
        const storage = getSQLiteStorage();
        const product = await storage.getProduct(productId);
        if (product) {
          product.pages = reordered.map((pg, idx) => ({ ...pg, order: idx }));
          product.updatedAt = new Date().toISOString();
          await storage.updateProduct(product);
          await handleReloadSQLite();
        }
      } else {
        jsonReorderPages(productId, reordered);
      }
    },
    [storageMode, jsonReorderPages, handleReloadSQLite],
  );

  const handleImportProductsJSON = useCallback(
    (incoming: IProduct[]) => {
      return jsonImportProducts(incoming);
    },
    [jsonImportProducts],
  );

  const handleExportProductsJSON = useCallback(() => {
    jsonExportProducts();
  }, [jsonExportProducts]);

  const isLoadingContent = storageMode === 'sqlite' && selectedProductId !== null && !loadedProductContent.has(selectedProductId);

  const renderMainContent = () => {
    if (isSearching) {
      return (
        <SearchResults
          results={searchResults}
          query={globalSearchQuery}
          onSelect={handleSearchResultSelect}
        />
      );
    }

    if (!selectedProduct) {
      return (
        <EmptyState
          onCreateProduct={handleCreateProduct}
          onImportJSON={handleImportJSON}
          onImportDB={handleImportDB}
        />
      );
    }

    if (isLoadingContent) {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground italic">正在加载内容...</p>
        </div>
      );
    }

    return (
      <ProductDetail
        product={selectedProduct}
        pageIndex={selectedPageIndex}
        onPageChange={handlePageChange}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onAddPage={handleAddPage}
        onDeletePage={handleDeletePage}
        onUpdatePageContent={handleUpdatePageContent}
        onReorderPages={handleReorderPages}
      />
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      {!sidebarHidden ? (
        <AppSidebar
          products={products}
          selectedProductId={selectedProductId}
          collapsed={sidebarCollapsed}
          theme={theme}
          searchQuery={searchQuery}
          filterTags={filterTags}
          triggerAdd={triggerAddDialog}
          triggerImportJSON={triggerImportJSON}
          triggerImportDB={triggerImportDB}
          onSelectProduct={handleSelectProduct}
          onAddProduct={handleAddProductFromSidebar}
          onImportProductsJSON={handleImportProductsJSON}
          onExportProductsJSON={handleExportProductsJSON}
          onToggleCollapse={handleToggleCollapse}
          onToggleTheme={toggleTheme}
          onSetTheme={setTheme}
          onSearchChange={handleSearchChange}
          onTagToggle={handleTagToggle}
          onTriggerAddHandled={() => setTriggerAddDialog(false)}
          onTriggerImportJSONHandled={() => setTriggerImportJSON(false)}
          onTriggerImportDBHandled={() => setTriggerImportDB(false)}
          onProductsChanged={handleReloadSQLite}
          onHideSidebar={() => setSidebarHidden(true)}
        />
      ) : (
        <button
          onClick={() => setSidebarHidden(false)}
          className="fixed bottom-6 left-6 z-[60] flex size-12 items-center justify-center rounded-full bg-primary shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95"
          title="显示侧边栏"
        >
          <BookOpen className="size-6 text-primary-foreground" />
        </button>
      )}
      <main className="flex-1 min-w-0 bg-background">
        {renderMainContent()}
      </main>
    </div>
  );
}
