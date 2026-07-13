import { useState, useCallback, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { useRemoteSearch } from '@/hooks/useRemoteSearch';
import FloatingTabBar, { type TabId } from '@/components/FloatingTabBar';
import BundleDialog from '@/components/BundleDialog';
import BundlesPage from '@/pages/BundlesPage';
import WikisPage from '@/pages/WikisPage';
import ThemesPage from '@/pages/ThemesPage';
import MindmapsPage from '@/pages/MindmapsPage';
import SuperSearchPage from '@/pages/SuperSearchPage';
import BlobSyncPanel from '@/components/BlobSyncPanel';
import { useStorageMode } from '@/lib/storage-context';
import { getSQLiteStorage, bundlesFromDbBytes } from '@/lib/sqlite-storage';
import { getActiveProvider } from '@/lib/provider-registry';
import type { IBundle, IPage } from '@/data/bundles';
import { searchBundles, type ExtendedSearchResult } from '@/lib/search';

const SELECTED_KEY = '__wikiki_selected_product_id';
const PAGE_INDEX_KEY = '__wikiki_selected_page_index';
const ACTIVE_TAB_KEY = '__wikiki_active_tab';
const TABBAR_MINIMIZED_KEY = '__wikiki_tabbar_minimized';

export default function HomePage() {
  const { sqliteReady, reloadSQLiteBundles, exportSQLiteDB, importSQLiteDB, sqliteInfo, importBundles } = useStorageMode();

  useEffect(() => {
    document.title = 'Wikiki';
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_TAB_KEY) as string;
      if (stored === 'database') return 'mindmaps';
      if (stored && ['bundles', 'supersearch', 'wikis', 'themes', 'mindmaps'].includes(stored)) {
        return stored as TabId;
      }
    } catch {
      // ignore
    }
    return 'mindmaps';
  });

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(ACTIVE_TAB_KEY, tab);
    } catch {
      // ignore
    }
  }, []);

  const [tabBarMinimized, setTabBarMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TABBAR_MINIMIZED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleMinimizedChange = useCallback((minimized: boolean) => {
    setTabBarMinimized(minimized);
    try {
      localStorage.setItem(TABBAR_MINIMIZED_KEY, String(minimized));
    } catch {
      // ignore
    }
  }, []);

  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SELECTED_KEY) || null;
    } catch {
      return null;
    }
  });

  const [selectedPageIndex, setSelectedPageIndex] = useState(() => {
    try {
      const stored = localStorage.getItem(PAGE_INDEX_KEY);
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

  const [sqliteBundles, setSqliteBundles] = useState<IBundle[]>([]);
  const [sqliteSearchBundles, setSqliteSearchBundles] = useState<IBundle[]>([]);
  const [dbPrepping, setDbPrepping] = useState(false);
  const [loadedBundleContent, setLoadedBundleContent] = useState<Map<string, IBundle>>(new Map());
  const [blobPanelOpen, setBlobPanelOpen] = useState(false);

  useEffect(() => {
    if (!sqliteReady) return;
    const storage = getSQLiteStorage();
    storage.getAllBundlesShallow().then((prods) => {
      setSqliteBundles(prods);
    }).catch((e) => {
      console.error('Failed to load SQLite bundles:', String(e));
    });
  }, [sqliteReady]);

  useEffect(() => {
    if (!selectedBundleId) return;
    if (loadedBundleContent.has(selectedBundleId)) return;

    const storage = getSQLiteStorage();
    storage.getBundle(selectedBundleId).then((fullBundle) => {
      if (fullBundle) {
        setLoadedBundleContent((prev) => new Map(prev).set(selectedBundleId, fullBundle));
      }
    }).catch((e) => {
      console.error('Failed to load bundle content:', String(e));
    });
  }, [selectedBundleId, loadedBundleContent]);

  const handleReloadSQLite = useCallback(async () => {
    const prods = await reloadSQLiteBundles();
    setSqliteBundles(prods);
    setLoadedBundleContent(new Map());
  }, [reloadSQLiteBundles]);

  const bundles = useMemo(() => {
    return sqliteBundles.map((p) => {
      if (p.id === selectedBundleId && loadedBundleContent.has(p.id)) {
        return loadedBundleContent.get(p.id)!;
      }
      return p;
    });
  }, [sqliteBundles, selectedBundleId, loadedBundleContent]);

  const selectedBundle = useMemo(
    () => bundles.find((p) => p.id === selectedBundleId) ?? null,
    [bundles, selectedBundleId],
  );

  useEffect(() => {
    if (!sqliteReady || activeTab !== 'supersearch') {
      setSqliteSearchBundles([]);
      setDbPrepping(false);
      return;
    }

    let cancelled = false;
    setDbPrepping(true);

    // Defer the heavy getAllBundles() call so the search page can render
    // and the input can be focused first — the user sees the page immediately.
    const timer = setTimeout(() => {
      const storage = getSQLiteStorage();
      storage
        .getAllBundles()
        .then((allBundles) => {
          if (!cancelled) {
            setSqliteSearchBundles(allBundles);
            setDbPrepping(false);
          }
        })
        .catch((error) => {
          console.error('Failed to load SQLite search index:', String(error));
          if (!cancelled) {
            setSqliteSearchBundles([]);
            setDbPrepping(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sqliteReady, activeTab]);

  const searchableBundles = useMemo(() => {
    return sqliteSearchBundles.length > 0 ? sqliteSearchBundles : bundles;
  }, [sqliteSearchBundles, bundles]);

  // Search remote cloud storage via SQL (no full DB download) when on super search tab
  const { results: remoteSearchResults, loading: remoteLoading } = useRemoteSearch(
    sqliteReady && activeTab === 'supersearch',
    debouncedSuperSearchQuery,
  );

  const searchResults = useMemo<ExtendedSearchResult[]>(() => {
    const q = debouncedSuperSearchQuery.trim();
    if (!q) return [];

    // Search local bundles
    const localResults = searchBundles(searchableBundles, q).map((r) => ({
      ...r,
      source: 'local' as const,
    }));

    // Build a set of local bundle names for deduplication
    const localNames = new Set(searchableBundles.map((b) => b.name));

    // Convert remote search results to ExtendedSearchResult format,
    // excluding duplicates (same bundle name as local)
    const remoteResults: ExtendedSearchResult[] = remoteSearchResults
      .filter((r) => !localNames.has(r.bundleName))
      .map((r) => ({
        bundleId: r.bundleId,
        bundleName: r.bundleName,
        bundleTags: r.tags,
        pageId: r.pageId,
        pageIndex: 0,
        pageName: r.pageName,
        snippet: r.excerpt,
        matchType: r.matchType,
        score: r.matchType === 'name' ? 100 : r.matchType === 'tag' ? 50 : 25,
        matchingParagraphs: [{
          excerpt: r.excerpt,
          matchStart: 0,
          matchedTokens: q.split(/\s+/).filter(Boolean),
          score: r.matchType === 'name' ? 100 : 50,
        }],
        source: 'remote' as const,
        collection: r.collection,
      }));

    // Local results first, then remote
    return [...localResults, ...remoteResults];
  }, [searchableBundles, debouncedSuperSearchQuery, remoteSearchResults]);

  // Download a remote collection and merge into local DB
  const handleDownloadCollection = useCallback(
    async (collection: string) => {
      try {
        const provider = getActiveProvider();
        const bytes = await provider.downloadCollectionDB(collection);
        const downloaded = await bundlesFromDbBytes(bytes);
        const storage = getSQLiteStorage();
        await storage.importBundles(downloaded);
        await handleReloadSQLite();
        toast.success(`Downloaded collection "${collection}" (${downloaded.length} bundles)`);
      } catch (e) {
        console.error('Collection download failed:', e);
        toast.error(`Download failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120));
      }
    },
    [handleReloadSQLite],
  );

  const handleSelectBundle = useCallback(
    (id: string) => {
      setSelectedBundleId(id);
      setSelectedPageIndex(0);
      try {
        localStorage.setItem(SELECTED_KEY, id);
      } catch {
        // ignore
      }
    },
    [],
  );

  const handleSelectBundleFromMindmap = useCallback(
    (id: string) => {
      handleSelectBundle(id);
      handleTabChange('wikis');
    },
    [handleSelectBundle, handleTabChange],
  );

  const handleDeleteBundle = useCallback(
    async (id: string) => {
      const storage = getSQLiteStorage();
      await storage.deleteBundle(id);
      await handleReloadSQLite();
      if (selectedBundleId === id) {
        setSelectedBundleId(null);
        try {
          localStorage.setItem(SELECTED_KEY, '');
        } catch {
          // ignore
        }
      }
    },
    [selectedBundleId, handleReloadSQLite],
  );

  const handlePageChange = useCallback((index: number) => {
    setSelectedPageIndex(index);
    try {
      localStorage.setItem(PAGE_INDEX_KEY, String(index));
    } catch {
      // ignore
    }
  }, []);

  const handleSearchResultSelect = useCallback(
    (result: ExtendedSearchResult, paragraphIndex?: number) => {
      setSelectedBundleId(result.bundleId);
      setSelectedPageIndex(result.pageIndex ?? 0);
      setActiveTab('wikis');

      setActiveHighlightQuery(superSearchQuery);
      setOpenMindmapMode(result.isMindmap ? Date.now() : 0);

      try {
        localStorage.setItem(SELECTED_KEY, result.bundleId);
        localStorage.setItem(PAGE_INDEX_KEY, String(result.pageIndex ?? 0));
        localStorage.setItem(ACTIVE_TAB_KEY, 'wikis');
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
      // Ctrl/Cmd+K → super search
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setActiveTab('supersearch');
        try {
          localStorage.setItem(ACTIVE_TAB_KEY, 'supersearch');
        } catch {
          // ignore
        }
      }
      // Shift+B → toggle EdgeOne blob sync panel (only on mindmaps tab)
      if (event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'b') {
        const current = localStorage.getItem(ACTIVE_TAB_KEY);
        if (current === 'mindmaps') {
          event.preventDefault();
          setBlobPanelOpen((v) => !v);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [triggerAddDialog, setTriggerAddDialog] = useState(false);

  const handleCreateBundle = useCallback(() => {
    setTriggerAddDialog(true);
  }, []);

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

  const handleAddBundleFromSidebar = useCallback(
    (name: string, tags: string[], authors: string[], collection: string): IBundle => {
      const now = new Date().toISOString();
      const finalAuthors = authors && authors.length > 0 ? authors : ['susul'];
      const finalCollection = collection && collection.trim() ? collection.trim() : 'Default';
      const newBundle: IBundle = {
        id: `user-${Date.now()}`,
        name,
        tags,
        authors: finalAuthors,
        collection: finalCollection,
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

      (async () => {
        try {
          const storage = getSQLiteStorage();
          if (!storage.initialized) await storage.init();
          await storage.addBundle(newBundle);
          const prods = await reloadSQLiteBundles();
          setSqliteBundles(prods);
        } catch (e) {
          console.error('SQLite add bundle failed:', String(e));
        }
      })();

      setSelectedBundleId(newBundle.id);
      try {
        localStorage.setItem(SELECTED_KEY, newBundle.id);
      } catch {
        // ignore
      }
      setTriggerAddDialog(false);
      return newBundle;
    },
    [reloadSQLiteBundles],
  );

  const handleUpdateBundle = useCallback(
    async (id: string, name: string, tags: string[], authors: string[], collection: string) => {
      const storage = getSQLiteStorage();
      const bundle = await storage.getBundle(id);
      if (bundle) {
        bundle.name = name;
        bundle.tags = tags;
        bundle.authors = authors && authors.length > 0 ? authors : ['susul'];
        bundle.collection = collection && collection.trim() ? collection.trim() : 'Default';
        bundle.updatedAt = new Date().toISOString();
        await storage.updateBundle(bundle);
        await handleReloadSQLite();
      }
    },
    [handleReloadSQLite],
  );

  const handleAddPage = useCallback(
    async (bundleId: string, pageName: string): Promise<IPage | null> => {
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

      const storage = getSQLiteStorage();
      const bundle = await storage.getBundle(bundleId);
      if (bundle) {
        const maxOrder = bundle.pages.reduce((max, pg) => Math.max(max, pg.order), -1);
        newPage.order = maxOrder + 1;
        bundle.pages.push(newPage);
        bundle.updatedAt = now;
        await storage.updateBundle(bundle);
        await handleReloadSQLite();
        return newPage;
      }
      return null;
    },
    [handleReloadSQLite],
  );

  const handleDeletePage = useCallback(
    async (bundleId: string, pageId: string) => {
      const storage = getSQLiteStorage();
      const bundle = await storage.getBundle(bundleId);
      if (bundle && bundle.pages.length > 1) {
        bundle.pages = bundle.pages.filter((pg) => pg.id !== pageId);
        bundle.updatedAt = new Date().toISOString();
        await storage.updateBundle(bundle);
        await handleReloadSQLite();
      }
    },
    [handleReloadSQLite],
  );

  const handleUpdatePageContent = useCallback(
    async (bundleId: string, pageId: string, content: string) => {
      const storage = getSQLiteStorage();
      await storage.updatePageContent(bundleId, pageId, content);
      setLoadedBundleContent((prev) => {
        const cached = prev.get(bundleId);
        if (!cached) return prev;
        const updatedPages = cached.pages.map((pg) =>
          pg.id === pageId ? { ...pg, content, updatedAt: new Date().toISOString() } : pg,
        );
        const updated = { ...cached, pages: updatedPages, updatedAt: new Date().toISOString() };
        return new Map(prev).set(bundleId, updated);
      });
    },
    [],
  );

  const handleReorderPages = useCallback(
    async (bundleId: string, reordered: IBundle['pages']) => {
      const storage = getSQLiteStorage();
      const bundle = await storage.getBundle(bundleId);
      if (bundle) {
        bundle.pages = reordered.map((pg, idx) => ({ ...pg, order: idx }));
        bundle.updatedAt = new Date().toISOString();
        await storage.updateBundle(bundle);
        await handleReloadSQLite();
      }
    },
    [handleReloadSQLite],
  );

  const handleExportDB = useCallback(() => {
    exportSQLiteDB();
  }, [exportSQLiteDB]);

  const isLoadingContent = selectedBundleId !== null && !loadedBundleContent.has(selectedBundleId);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'bundles':
        return (
          <BundlesPage
            bundles={bundles}
            selectedBundleId={selectedBundleId}
            onSelectBundle={(id, pageIndex) => {
              handleSelectBundle(id);
              if (pageIndex !== undefined) {
                setSelectedPageIndex(pageIndex);
                try {
                  localStorage.setItem(PAGE_INDEX_KEY, String(pageIndex));
                } catch {
                  // ignore
                }
              }
              handleTabChange('wikis');
            }}
            onCreateBundle={handleCreateBundle}
            onDeleteBundle={handleDeleteBundle}
            onOpenMindmap={(id) => {
              handleSelectBundle(id);
              setOpenMindmapMode(Date.now());
              handleTabChange('wikis');
            }}
          />
        );

      case 'supersearch':
        return (
          <SuperSearchPage
            query={superSearchQuery}
            results={searchResults}
            loading={
              superSearchQuery.trim().length > 0 &&
              sqliteBundles.length > 0 &&
              sqliteSearchBundles.length === 0
            }
            dbPrepping={dbPrepping}
            remoteLoading={remoteLoading}
            onQueryChange={setSuperSearchQuery}
            onSelect={handleSearchResultSelect}
            onDownloadCollection={handleDownloadCollection}
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
            bundle={selectedBundle}
            pageIndex={selectedPageIndex}
            onPageChange={handlePageChange}
            onUpdateBundle={handleUpdateBundle}
            onDeleteBundle={handleDeleteBundle}
            onAddPage={handleAddPage}
            onDeletePage={handleDeletePage}
            onUpdatePageContent={handleUpdatePageContent}
            onReorderPages={handleReorderPages}
            highlightQuery={activeHighlightQuery}
            openMindmap={openMindmapMode}
            onNoBundle={() => handleTabChange('bundles')}
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
            bundles={bundles}
            onSelectBundle={handleSelectBundleFromMindmap}
            sqliteInfo={sqliteInfo}
            sqliteReady={sqliteReady}
            onExportDB={handleExportDB}
            onImportDB={handleImportDB}
            onCreateBundle={handleCreateBundle}
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

      {/* Hidden EdgeOne blob sync panel (Shift+B on mindmaps tab) */}
      {activeTab === 'mindmaps' && (
        <BlobSyncPanel
          open={blobPanelOpen}
          onOpenChange={setBlobPanelOpen}
          bundles={bundles}
          onReloadBundles={handleReloadSQLite}
        />
      )}

      {/* Version footer */}
      <div className="pointer-events-none absolute bottom-2 right-4 z-40 select-none">
        <span className="text-[9px] uppercase tracking-wider text-foreground/20">Wikiki Pro {__APP_VERSION__}</span>
      </div>

      {/* Bundle creation dialog */}
      <BundleDialog
        open={triggerAddDialog}
        onOpenChange={setTriggerAddDialog}
        title="Create Bundle"
        onSave={(name, tags, authors, collection) => {
          handleAddBundleFromSidebar(name, tags, authors, collection);
          handleTabChange('wikis');
        }}
      />
    </div>
  );
}
