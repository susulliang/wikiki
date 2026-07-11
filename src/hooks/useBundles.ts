import { useState, useCallback, useEffect, useRef } from 'react';
import type { IBundle, IPage } from '@/data/bundles';
import { normalizeBundle, denormalizeBundle } from '@/data/bundles';

const STORAGE_KEY = '__wikiki_bundles';
const VERSION_KEY = '__wikiki_data_version';
const CURRENT_VERSION = 2;

function stripBase64Images(bundles: IBundle[]): IBundle[] {
  return bundles.map((p) => ({
    ...p,
    pages: p.pages.map((pg) => ({
      ...pg,
      content: pg.content.replace(
        /<img[^>]+src="data:image[^"]+"[^>]*>/gi,
        '<span class="text-muted-foreground italic">[图片已移除]</span>',
      ),
    })),
  }));
}

function persistBundles(bundles: IBundle[]): boolean {
  try {
    const exportData = bundles.map(denormalizeBundle);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exportData));
    localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
    return true;
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || (e as DOMException).code === 22)) {
      const stripped = stripBase64Images(bundles);
      try {
        const exportData = stripped.map(denormalizeBundle);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(exportData));
        localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
        console.warn('Storage quota exceeded, base64 images stripped');
        return true;
      } catch (e2) {
        console.error('Failed to save even after stripping images:', String(e2));
        return false;
      }
    }
    console.error('Failed to save bundles:', String(e));
    return false;
  }
}

function loadBundles(): IBundle[] {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    // Clear old data if version mismatch (v1 had mock data, v2 starts fresh)
    if (storedVersion !== String(CURRENT_VERSION)) {
      localStorage.setItem(STORAGE_KEY, '');
      localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
      return [];
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw === '[]' || raw === 'null' || raw === '""') return [];

    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    return data.map((item: Record<string, unknown>) => normalizeBundle(item));
  } catch (e) {
    console.error('Failed to load bundles:', String(e));
    return [];
  }
}

export function useBundles() {
  const [bundles, setBundles] = useState<IBundle[]>(() => loadBundles());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistBundles(bundles);
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [bundles]);

  const addBundle = useCallback((name: string, tags: string[]): IBundle => {
    const now = new Date().toISOString();
    const newBundle: IBundle = {
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
    setBundles((prev) => [...prev, newBundle]);
    return newBundle;
  }, []);

  const updateBundle = useCallback((id: string, name: string, tags: string[]) => {
    setBundles((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, name, tags, updatedAt: new Date().toISOString() } : p,
      ),
    );
  }, []);

  const deleteBundle = useCallback((id: string) => {
    setBundles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addPage = useCallback((bundleId: string, pageName: string): IPage | null => {
    let newPage: IPage | null = null;
    setBundles((prev) =>
      prev.map((p) => {
        if (p.id !== bundleId) return p;
        const now = new Date().toISOString();
        const maxOrder = p.pages.reduce((max, pg) => Math.max(max, pg.order), -1);
        newPage = {
          id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: pageName,
          name: pageName,
          content: '',
          order: maxOrder + 1,
          createdAt: now,
          updatedAt: now,
        };
        return {
          ...p,
          pages: [...p.pages, newPage],
          updatedAt: now,
        };
      }),
    );
    return newPage;
  }, []);

  const deletePage = useCallback((bundleId: string, pageId: string) => {
    setBundles((prev) =>
      prev.map((p) => {
        if (p.id !== bundleId) return p;
        if (p.pages.length <= 1) return p;
        return {
          ...p,
          pages: p.pages.filter((pg) => pg.id !== pageId),
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const updatePageContent = useCallback((bundleId: string, pageId: string, content: string) => {
    setBundles((prev) =>
      prev.map((p) => {
        if (p.id !== bundleId) return p;
        return {
          ...p,
          pages: p.pages.map((pg) =>
            pg.id === pageId ? { ...pg, content, updatedAt: new Date().toISOString() } : pg,
          ),
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const reorderPages = useCallback((bundleId: string, reordered: IPage[]) => {
    setBundles((prev) =>
      prev.map((p) => {
        if (p.id !== bundleId) return p;
        const updated = reordered.map((pg, idx) => ({ ...pg, order: idx }));
        return { ...p, pages: updated, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const importBundles = useCallback((incoming: IBundle[]): { added: number; updated: number } => {
    let added = 0;
    let updated = 0;
    setBundles((prev) => {
      const map = new Map(prev.map((p) => [p.name, p]));
      for (const item of incoming) {
        if (map.has(item.name)) {
          map.set(item.name, { ...item, updatedAt: new Date().toISOString() });
          updated++;
        } else {
          map.set(item.name, item);
          added++;
        }
      }
      return Array.from(map.values());
    });
    return { added, updated };
  }, []);

  const exportBundles = useCallback(() => {
    const exportData = bundles.map(denormalizeBundle);
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wikiki-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [bundles]);

  const getBundle = useCallback(
    (id: string | null): IBundle | undefined => {
      if (!id) return undefined;
      return bundles.find((p) => p.id === id);
    },
    [bundles],
  );

  return {
    bundles,
    addBundle,
    updateBundle,
    deleteBundle,
    addPage,
    deletePage,
    updatePageContent,
    reorderPages,
    importBundles,
    exportBundles,
    getBundle,
  };
}
