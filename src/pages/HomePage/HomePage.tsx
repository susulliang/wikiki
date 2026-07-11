import { useState, useCallback, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import { scopedStorage, logger } from '@lark-apaas/client-toolkit-lite';
import FloatingTabBar, { type TabId } from '@/components/FloatingTabBar';
import ProductDialog from '@/components/ProductDialog';
import DatabasePage from '@/pages/DatabasePage';
import ProductsPage from '@/pages/ProductsPage';
import WikisPage from '@/pages/WikisPage';
import ThemesPage from '@/pages/ThemesPage';
import MindmapsPage from '@/pages/MindmapsPage';
import SuperSearchPage from '@/pages/SuperSearchPage';
import { useStorageMode } from '@/lib/storage-context';
import { getSQLiteStorage } from '@/lib/sqlite-storage';
import type { IProduct, IPage } from '@/data/products';
import { searchProducts, type ExtendedSearchResult } from '@/lib/search';

const SELECTED_KEY = '__wikiki_selected_product_id';
const PAGE_INDEX_KEY = '__wikiki_selected_page_index';
const ACTIVE_TAB_KEY = '__wikiki_active_tab';
const TABBAR_MINIMIZED_KEY = '__wikiki_tabbar_minimized';

export default function HomePage() {
  const { mode: storageMode, sqliteReady, reloadSQLiteProducts, switchMode, exportProductsJSON, exportSQLiteDB, importSQLiteDB, sqliteInfo } = useStorageMode();

  const {
    products: jsonProducts,
    addProduct: jsonAddProduct,
    updateProduct: jsonUpdateProduct,
    deleteProduct: jsonDeleteProduct,
    addPage: jsonAddPage,
    deletePage: jsonDeletePage,
    updatePageContent: jsonUpdatePageContent,
    reorderPages: jsonReorderPages,
  } = useProducts();

  useEffect(() => {
    document.title = 'Wikiki';
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try {
      const stored = scopedStorage.getItem(ACTIVE_TAB_KEY) as TabId;
      if (stored && ['database', 'products', 'supersearch', 'wikis', 'themes', 'mindmaps'].includes(stored)) {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'products';
  });

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    try {
      scopedStorage.setItem(ACTIVE_TAB_KEY, tab);
    } catch {
      // ignore
    }
  }, []);

  const [tabBarMinimized, setTabBarMinimized] = useState<boolean>(() => {
    try {
      return scopedStorage.getItem(TABBAR_MINIMIZED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleMinimizedChange = useCallback((minimized: boolean) => {
    setTabBarMinimized(minimized);
    try {
      scopedStorage.setItem(TABBAR_MINIMIZED_KEY, String(minimized));
    } catch {
      // ignore
    }
  }, []);

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

  const [superSearchQuery, setSuperSearchQuery] = useState('');
  const [debouncedSuperSearchQuery, setDebouncedSuperSearchQuery] = useState('');
  const [activeHighlightQuery, setActiveHighlightQuery] = useState('');
  const [openMindmapMode, setOpenMindmapMode] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSuperSearchQuery(superSearchQuery);
    }, 800);

    return () => clearTimeout(timer);
  }, [superSearchQuery]);

  const { theme, setTheme } = useTheme();

  const [sqliteProducts, setSqliteProducts] = useState<IProduct[]>([]);
  const [sqliteSearchProducts, setSqliteSearchProducts] = useState<IProduct[]>([]);
  const [loadedProductContent, setLoadedProductContent] = useState<Map<string, IProduct>>(new Map());

  useEffect(() => {
    if (storageMode !== 'sqlite' || !sqliteReady) return;
    const storage = getSQLiteStorage();
    storage.getAllProductsShallow().then((prods) => {
      setSqliteProducts(prods);
    }).catch((e) => {
      logger.error('Failed to load SQLite products:', String(e));
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
      logger.error('Failed to load product content:', String(e));
    });
  }, [storageMode, selectedProductId, loadedProductContent]);

  useEffect(() => {
    if (storageMode === 'json') {
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

  useEffect(() => {
    if (storageMode !== 'sqlite' || !sqliteReady || activeTab !== 'supersearch') {
      setSqliteSearchProducts([]);
      return;
    }

    let cancelled = false;
    const storage = getSQLiteStorage();

    storage
      .getAllProducts()
      .then((allProducts) => {
        if (!cancelled) {
          setSqliteSearchProducts(allProducts);
        }
      })
      .catch((error) => {
        logger.error('Failed to load SQLite search index:', String(error));
        if (!cancelled) {
          setSqliteSearchProducts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storageMode, sqliteReady, activeTab, products]);

  const searchableProducts = useMemo(() => {
    if (storageMode !== 'sqlite') {
      return products;
    }

    return sqliteSearchProducts.length > 0 ? sqliteSearchProducts : products;
  }, [storageMode, sqliteSearchProducts, products]);

  const searchResults = useMemo<ExtendedSearchResult[]>(
    () => (debouncedSuperSearchQuery.trim() ? searchProducts(searchableProducts, debouncedSuperSearchQuery.trim()) : []),
    [searchableProducts, debouncedSuperSearchQuery],
  );

  const handleSelectProduct = useCallback(
    (id: string) => {
      setSelectedProductId(id);
      setSelectedPageIndex(0);
      try {
        scopedStorage.setItem(SELECTED_KEY, id);
      } catch {
        // ignore
      }
    },
    [],
  );

  const handleSelectProductFromMindmap = useCallback(
    (id: string) => {
      handleSelectProduct(id);
      handleTabChange('wikis');
    },
    [handleSelectProduct, handleTabChange],
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
          // ignore
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
      // ignore
    }
  }, []);

  const handleSearchResultSelect = useCallback(
    (result: ExtendedSearchResult, paragraphIndex?: number) => {
      setSelectedProductId(result.productId);
      setSelectedPageIndex(result.pageIndex ?? 0);
      setActiveTab('wikis');

      setActiveHighlightQuery(superSearchQuery);
      setOpenMindmapMode(result.isMindmap ? Date.now() : 0);

      try {
        scopedStorage.setItem(SELECTED_KEY, result.productId);
        scopedStorage.setItem(PAGE_INDEX_KEY, String(result.pageIndex ?? 0));
        scopedStorage.setItem(ACTIVE_TAB_KEY, 'wikis');
      } catch {
        // ignore
      }

      setSuperSearchQuery('');

      setTimeout(() => {
        setActiveHighlightQuery('');
        setOpenMindmapMode(0);
      }, 5000);
    },
    [superSearchQuery],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setActiveTab('supersearch');
        try {
          scopedStorage.setItem(ACTIVE_TAB_KEY, 'supersearch');
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [triggerAddDialog, setTriggerAddDialog] = useState(false);

  const handleCreateProduct = useCallback(() => {
    setTriggerAddDialog(true);
  }, []);

  const handleImportJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        const { normalizeProduct } = await import('@/data/products');
        const products = data.map((item: Record<string, unknown>) => normalizeProduct(item));
        if (storageMode === 'sqlite') {
          const storage = getSQLiteStorage();
          if (!storage.initialized) await storage.init();
          await storage.importProducts(products);
          await handleReloadSQLite();
        } else {
          products.forEach((p: IProduct) => {
            jsonAddProduct(p.name, p.tags);
          });
        }
        handleTabChange('mindmaps');
      }
    };
    input.click();
  }, [storageMode, jsonAddProduct, handleReloadSQLite, handleTabChange]);

  const handleImportDB = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      await importSQLiteDB(new Uint8Array(buffer));
      await handleReloadSQLite();
      handleTabChange('mindmaps');
    };
    input.click();
  }, [importSQLiteDB, handleReloadSQLite, handleTabChange]);

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
            title: 'Main',
            name: 'Main',
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
        (async () => {
          try {
            const storage = getSQLiteStorage();
            if (!storage.initialized) await storage.init();
            await storage.addProduct(newProduct);
            const prods = await reloadSQLiteProducts();
            setSqliteProducts(prods);
          } catch (e) {
            logger.error('SQLite add product failed:', String(e));
          }
        })();
      } else {
        jsonAddProduct(name, tags);
      }

      setSelectedProductId(newProduct.id);
      try {
        scopedStorage.setItem(SELECTED_KEY, newProduct.id);
      } catch {
        // ignore
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
        await storage.updatePageContent(productId, pageId, content);
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

  const handleExportJSON = useCallback(() => {
    exportProductsJSON();
  }, [exportProductsJSON]);

  const handleExportDB = useCallback(() => {
    exportSQLiteDB();
  }, [exportSQLiteDB]);

  const handleSwitchMode = useCallback(async (mode: 'json' | 'sqlite', migrate?: boolean) => {
    await switchMode(mode, migrate);
  }, [switchMode]);

  const isLoadingContent = storageMode === 'sqlite' && selectedProductId !== null && !loadedProductContent.has(selectedProductId);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'database':
        return (
          <DatabasePage
            storageMode={storageMode}
            sqliteInfo={sqliteInfo}
            sqliteReady={sqliteReady}
            onSwitchMode={handleSwitchMode}
            onExportJSON={handleExportJSON}
            onExportDB={handleExportDB}
            onImportJSON={handleImportJSON}
            onImportDB={handleImportDB}
            products={products}
          />
        );

      case 'products':
        return (
          <ProductsPage
            products={products}
            selectedProductId={selectedProductId}
            onSelectProduct={(id) => {
              handleSelectProduct(id);
              handleTabChange('wikis');
            }}
            onCreateProduct={handleCreateProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        );

      case 'supersearch':
        return (
          <SuperSearchPage
            query={superSearchQuery}
            results={searchResults}
            loading={
              storageMode === 'sqlite' &&
              superSearchQuery.trim().length > 0 &&
              sqliteProducts.length > 0 &&
              sqliteSearchProducts.length === 0
            }
            onQueryChange={setSuperSearchQuery}
            onSelect={handleSearchResultSelect}
          />
        );

      case 'wikis':
        if (isLoadingContent) {
          return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground italic">Loading content...</p>
            </div>
          );
        }
        return (
          <WikisPage
            product={selectedProduct}
            pageIndex={selectedPageIndex}
            onPageChange={handlePageChange}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onAddPage={handleAddPage}
            onDeletePage={handleDeletePage}
            onUpdatePageContent={handleUpdatePageContent}
            onReorderPages={handleReorderPages}
            highlightQuery={activeHighlightQuery}
            openMindmap={openMindmapMode}
            onNoProduct={() => handleTabChange('products')}
          />
        );

      case 'themes':
        return (
          <ThemesPage
            currentTheme={theme}
            onSetTheme={setTheme}
          />
        );

      case 'mindmaps':
        return (
          <MindmapsPage
            products={products}
            onSelectProduct={handleSelectProductFromMindmap}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <FloatingTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isMinimized={tabBarMinimized}
        onMinimizedChange={handleMinimizedChange}
      />

      <main className="flex-1 min-h-0 overflow-hidden">
        <div
          className="h-full overflow-y-auto transition-[padding] duration-300 ease-in-out"
          style={{ paddingTop: tabBarMinimized ? 0 : '4.5rem' }}
        >
          {renderTabContent()}
        </div>
      </main>

      {/* Version footer */}
      <div className="pointer-events-none absolute bottom-2 right-4 z-40 select-none">
        <span className="text-[9px] uppercase tracking-wider text-foreground/20">Wikiki Pro {__APP_VERSION__}</span>
      </div>

      {/* Product creation dialog */}
      <ProductDialog
        open={triggerAddDialog}
        onOpenChange={setTriggerAddDialog}
        title="Create Product"
        onSave={(name, tags) => {
          handleAddProductFromSidebar(name, tags);
          handleTabChange('wikis');
        }}
      />
    </div>
  );
}
