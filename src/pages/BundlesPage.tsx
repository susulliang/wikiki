import { Plus, FileText, Package, Network } from 'lucide-react';
import type { IBundle } from '@/data/bundles';
import { getTagColor } from '@/data/bundles';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BundlesPageProps {
  bundles: IBundle[];
  selectedBundleId: string | null;
  onSelectBundle: (id: string, pageIndex?: number) => void;
  onCreateBundle: () => void;
  onDeleteBundle: (id: string) => void;
  onOpenMindmap: (id: string) => void;
}

/** Detect mindmap content (matches BundleDetail logic). */
function hasMindmapContent(content: string): boolean {
  return content.includes('<div') && (
    content.includes('mindmap') ||
    content.includes('data-mindmap') ||
    content.includes('Mermaid')
  );
}

function bundleHasMindmap(bundle: IBundle): boolean {
  return bundle.pages.some(
    (p) => p.title.toLowerCase() === 'mindmap' || hasMindmapContent(p.content),
  );
}

interface CollectionGroup {
  name: string;
  bundles: IBundle[];
}

function groupByCollection(bundles: IBundle[]): CollectionGroup[] {
  const map = new Map<string, IBundle[]>();
  for (const b of bundles) {
    const key = b.collection?.trim() || 'Default';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  // Sort: Default last, otherwise alphabetical
  const groups = Array.from(map.entries()).map(([name, items]) => ({ name, bundles: items }));
  groups.sort((a, b) => {
    if (a.name === 'Default') return 1;
    if (b.name === 'Default') return -1;
    return a.name.localeCompare(b.name);
  });
  return groups;
}

export default function BundlesPage({
  bundles,
  selectedBundleId,
  onSelectBundle,
  onCreateBundle,
  onOpenMindmap,
}: BundlesPageProps) {
  const { t } = useLanguage();

  if (bundles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex size-20 items-center justify-center rounded-3xl border-2 border-border bg-card">
          <Package className="size-10 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-2xl font-bold uppercase tracking-tight text-foreground">
          {t('empty.noBundles')}
        </h2>
        <p className="mb-6 mt-2 max-w-sm text-sm text-muted-foreground">
          {t('empty.noBundlesDesc')}
        </p>
        <Button onClick={onCreateBundle} className="gap-2 rounded-full uppercase tracking-wider">
          <Plus className="size-4" />
          {t('action.createBundle')}
        </Button>
      </div>
    );
  }

  const groups = groupByCollection(bundles);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-6 pt-[4.5rem] pb-10 md:px-10">
        <header className="mb-8 flex items-center justify-between border-b-2 border-border pb-6">
          <div>
            <h1 className="font-serif text-4xl font-bold uppercase tracking-tight text-foreground">
              {t('tab.bundles')}
            </h1>
            <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
              {bundles.length} {t('common.bundles')} · {groups.length} collections
            </p>
          </div>
          <Button onClick={onCreateBundle} className="gap-2 rounded-full uppercase tracking-wider">
            <Plus className="size-4" />
            {t('action.createBundle')}
          </Button>
        </header>

        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.name}>
              {/* Collection header */}
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-serif text-lg font-bold text-foreground">{group.name}</h2>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {group.bundles.length} {group.bundles.length === 1 ? 'bundle' : 'bundles'}
                </span>
                <div className="ml-2 h-px flex-1 bg-border" />
              </div>

              {/* Bundles grid within this collection */}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {group.bundles.map((bundle) => {
                  const isSelected = bundle.id === selectedBundleId;
                  const showMindmap = bundleHasMindmap(bundle);
                  return (
                    <div
                      key={bundle.id}
                      className={cn(
                        'group relative flex cursor-pointer flex-col rounded-3xl bg-card p-4 transition-all hover:-translate-y-1 hover:shadow-md',
                        isSelected ? 'border-2 border-primary' : 'border-2 border-border hover:border-primary/50',
                      )}
                      onClick={() => onSelectBundle(bundle.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectBundle(bundle.id);
                        }
                      }}
                    >
                      {/* Mindmap button — the only action button on the card */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showMindmap) onOpenMindmap(bundle.id);
                        }}
                        disabled={!showMindmap}
                        aria-label={`Open mindmap for ${bundle.name}`}
                        title={showMindmap ? 'Open mindmap' : 'No mindmap'}
                        className={cn(
                          'absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          showMindmap
                            ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary'
                            : 'border-border bg-background text-muted-foreground/30 cursor-default',
                        )}
                      >
                        <Network className="size-3" />
                      </button>

                      <h3 className="mb-2 pr-10 font-serif text-base font-bold leading-tight text-foreground">
                        {bundle.name}
                      </h3>

                      {bundle.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {bundle.tags.map((tag) => {
                            const color = getTagColor(tag);
                            return (
                              <span
                                key={tag}
                                className={cn(
                                  'rounded-full border px-1.5 py-0 text-[11px] font-medium',
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

                      <div className="mt-auto space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                          <FileText className="size-3" />
                          {bundle.pages.length} {bundle.pages.length === 1 ? 'page' : 'pages'}
                        </div>
                        <ul className="space-y-0">
                          {bundle.pages.slice(0, 5).map((page, idx) => (
                            <li key={page.id}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectBundle(bundle.id, idx);
                                }}
                                className="flex w-full items-center gap-1.5 truncate text-left text-xs text-foreground transition-colors hover:text-primary"
                                title={page.name || page.title}
                              >
                                <span className="size-1 shrink-0 rounded-full bg-primary/60" />
                                <span className="truncate">{page.name || page.title}</span>
                              </button>
                            </li>
                          ))}
                          {bundle.pages.length > 5 && (
                            <li className="text-[11px] text-muted-foreground">
                              +{bundle.pages.length - 5} more
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
