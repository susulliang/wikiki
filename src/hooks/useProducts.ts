import { useState, useCallback, useEffect, useRef } from 'react';
import type { IProduct, IPage } from '@/data/products';
import { normalizeProduct, denormalizeProduct } from '@/data/products';

const STORAGE_KEY = '__wikiki_products';
const VERSION_KEY = '__wikiki_data_version';
const CURRENT_VERSION = 2;

function stripBase64Images(products: IProduct[]): IProduct[] {
  return products.map((p) => ({
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

function persistProducts(products: IProduct[]): boolean {
  try {
    const exportData = products.map(denormalizeProduct);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exportData));
    localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
    return true;
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || (e as DOMException).code === 22)) {
      const stripped = stripBase64Images(products);
      try {
        const exportData = stripped.map(denormalizeProduct);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(exportData));
        localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
        console.warn('Storage quota exceeded, base64 images stripped');
        return true;
      } catch (e2) {
        console.error('Failed to save even after stripping images:', String(e2));
        return false;
      }
    }
    console.error('Failed to save products:', String(e));
    return false;
  }
}

function loadProducts(): IProduct[] {
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

    return data.map((item: Record<string, unknown>) => normalizeProduct(item));
  } catch (e) {
    console.error('Failed to load products:', String(e));
    return [];
  }
}

export function useProducts() {
  const [products, setProducts] = useState<IProduct[]>(() => loadProducts());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistProducts(products);
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [products]);

  const addProduct = useCallback((name: string, tags: string[]): IProduct => {
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
    setProducts((prev) => [...prev, newProduct]);
    return newProduct;
  }, []);

  const updateProduct = useCallback((id: string, name: string, tags: string[]) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, name, tags, updatedAt: new Date().toISOString() } : p,
      ),
    );
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addPage = useCallback((productId: string, pageName: string): IPage | null => {
    let newPage: IPage | null = null;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
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

  const deletePage = useCallback((productId: string, pageId: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        if (p.pages.length <= 1) return p;
        return {
          ...p,
          pages: p.pages.filter((pg) => pg.id !== pageId),
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const updatePageContent = useCallback((productId: string, pageId: string, content: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
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

  const reorderPages = useCallback((productId: string, reordered: IPage[]) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const updated = reordered.map((pg, idx) => ({ ...pg, order: idx }));
        return { ...p, pages: updated, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const importProducts = useCallback((incoming: IProduct[]): { added: number; updated: number } => {
    let added = 0;
    let updated = 0;
    setProducts((prev) => {
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

  const exportProducts = useCallback(() => {
    const exportData = products.map(denormalizeProduct);
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
  }, [products]);

  const getProduct = useCallback(
    (id: string | null): IProduct | undefined => {
      if (!id) return undefined;
      return products.find((p) => p.id === id);
    },
    [products],
  );

  return {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    addPage,
    deletePage,
    updatePageContent,
    reorderPages,
    importProducts,
    exportProducts,
    getProduct,
  };
}
