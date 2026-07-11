import { Plus, Trash2, FileText, Package } from 'lucide-react';
import type { IBundle } from '@/data/bundles';
import { getTagColor } from '@/data/bundles';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BundlesPageProps {
  bundles: IBundle[];
  selectedBundleId: string | null;
  onSelectBundle: (id: string) => void;
  onCreateBundle: () => void;
  onDeleteBundle: (id: string) => void;
}

export default function BundlesPage({
  bundles,
  selectedBundleId,
  onSelectBundle,
  onCreateBundle,
  onDeleteBundle,
}: BundlesPageProps) {
  if (bundles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex size-20 items-center justify-center border-2 border-border bg-card">
          <Package className="size-10 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-2xl font-bold uppercase tracking-tight text-foreground">
          No Bundles Yet
        </h2>
        <p className="mb-6 mt-2 max-w-sm text-sm text-muted-foreground">
          Create your first bundle to start building a wiki knowledge base.
        </p>
        <Button onClick={onCreateBundle} className="gap-2 uppercase tracking-wider">
          <Plus className="size-4" />
          Create Bundle
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <header className="mb-8 flex items-center justify-between border-b-2 border-border pb-6">
          <div>
            <h1 className="font-serif text-4xl font-bold uppercase tracking-tight text-foreground">
              Bundles
            </h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {bundles.length} {bundles.length === 1 ? 'bundle' : 'bundles'} in your library
            </p>
          </div>
          <Button onClick={onCreateBundle} className="gap-2 uppercase tracking-wider">
            <Plus className="size-4" />
            Create
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => {
            const isSelected = bundle.id === selectedBundleId;
            return (
              <div
                key={bundle.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectBundle(bundle.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectBundle(bundle.id);
                  }
                }}
                className={cn(
                  'group relative flex cursor-pointer flex-col bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isSelected ? 'border-2 border-primary' : 'border-2 border-border hover:border-primary/50',
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBundle(bundle.id);
                  }}
                  aria-label={`Delete ${bundle.name}`}
                  className="absolute right-3 top-3 flex size-7 items-center justify-center border border-border bg-background text-muted-foreground opacity-0 transition-all hover:border-destructive hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>

                <h3 className="mb-3 pr-9 font-serif text-xl font-bold leading-tight text-foreground">
                  {bundle.name}
                </h3>

                {bundle.tags.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {bundle.tags.map((tag) => {
                      const color = getTagColor(tag);
                      return (
                        <span
                          key={tag}
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-xs font-medium',
                            color.bg,
                            color.text,
                            'border-transparent',
                          )}
                        >
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="mt-auto space-y-1.5">
                  <div className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    <FileText className="size-3" />
                    {bundle.pages.length} {bundle.pages.length === 1 ? 'page' : 'pages'}
                  </div>
                  <ul className="space-y-1">
                    {bundle.pages.slice(0, 4).map((page) => (
                      <li
                        key={page.id}
                        className="flex items-center gap-1.5 truncate text-sm text-foreground"
                      >
                        <span className="size-1 shrink-0 rounded-full bg-primary/60" />
                        <span className="truncate">{page.name || page.title}</span>
                      </li>
                    ))}
                    {bundle.pages.length > 4 && (
                      <li className="font-mono text-xs text-muted-foreground">
                        +{bundle.pages.length - 4} more
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
