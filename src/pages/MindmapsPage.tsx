import { useState, useMemo } from 'react';
import { Network } from 'lucide-react';
import type { IProduct } from '@/data/products';
import MindmapView from '@/components/MindmapView';
import { cn } from '@/lib/utils';

interface MindmapsPageProps {
  products: IProduct[];
}

function hasMindmapContent(content: string): boolean {
  return content.includes('<div') && (
    content.includes('mindmap') ||
    content.includes('data-mindmap') ||
    content.includes('Mermaid')
  );
}

export default function MindmapsPage({ products }: MindmapsPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(products[0]?.id ?? null);

  const selectedProduct = useMemo(() => {
    if (selectedId) {
      const found = products.find((p) => p.id === selectedId);
      if (found) return found;
    }
    return products[0] ?? null;
  }, [products, selectedId]);

  const mindmapPage = useMemo(() => {
    if (!selectedProduct) return null;
    const withMindmap = selectedProduct.pages.find((p) => hasMindmapContent(p.content));
    return withMindmap ?? selectedProduct.pages[0] ?? null;
  }, [selectedProduct]);

  if (products.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex size-20 items-center justify-center border-2 border-border bg-card">
          <Network className="size-10 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-2xl font-bold uppercase tracking-tight text-foreground">
          No Mindmaps Yet
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Create products and pages with mindmap content to see a visual knowledge graph here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b-2 border-border px-6 py-6 md:px-10">
        <h1 className="font-serif text-4xl font-bold uppercase tracking-tight text-foreground">
          Mindmaps
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Visual knowledge graph
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-border px-6 py-3 md:px-10">
        {products.map((p) => {
          const isActive = selectedProduct?.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={cn(
                'whitespace-nowrap rounded-full border-2 px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden p-4">
        {mindmapPage ? (
          <MindmapView content={mindmapPage.content} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            This product has no pages to visualize.
          </div>
        )}
      </div>
    </div>
  );
}
