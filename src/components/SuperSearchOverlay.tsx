import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Sparkles, CornerDownLeft, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { SearchResult } from '@/data/products';
import { getTagColor } from '@/data/products';
import { highlightSearchText } from '@/lib/search';

interface SuperSearchOverlayProps {
  open: boolean;
  query: string;
  results: SearchResult[];
  loading?: boolean;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
}

interface NodePosition {
  x: number;
  y: number;
}

function getNodePositions(count: number): NodePosition[] {
  if (count === 0) {
    return [];
  }

  const radiusX = count <= 4 ? 250 : 340;
  const radiusY = count <= 4 ? 155 : 220;

  return Array.from({ length: count }, (_, index) => {
    const angle = (-Math.PI / 2) + (index * (Math.PI * 2)) / count;
    return {
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY,
    };
  });
}

export default function SuperSearchOverlay({
  open,
  query,
  results,
  loading = false,
  onQueryChange,
  onClose,
  onSelect,
}: SuperSearchOverlayProps) {
  const visibleResults = results.slice(0, 8);
  const positions = useMemo(() => getNodePositions(visibleResults.length), [visibleResults.length]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
          className="fixed inset-0 z-[90] bg-background/70 backdrop-blur-md"
        >
          <div className="relative h-full w-full overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.12),transparent_42%)]" />

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute right-6 top-6 z-20 h-10 w-10 rounded-full border bg-card/80 shadow-sm backdrop-blur"
              title="Close super search"
            >
              <X className="size-4" />
            </Button>

            <div className="pointer-events-none absolute inset-0">
              {positions.map((position, index) => {
                const length = Math.sqrt(position.x ** 2 + position.y ** 2);
                const angle = Math.atan2(position.y, position.x);

                return (
                  <motion.div
                    key={`line-${visibleResults[index]?.productId}-${visibleResults[index]?.pageId ?? 'root'}-${index}`}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 0.55, scaleX: 1 }}
                    exit={{ opacity: 0, scaleX: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.04 }}
                    className="absolute left-1/2 top-1/2 h-px origin-left bg-border"
                    style={{
                      width: `${length}px`,
                      transform: `translateY(-50%) rotate(${angle}rad)`,
                    }}
                  />
                );
              })}
            </div>

            {positions.map((position, index) => {
              const result = visibleResults[index];
              if (!result) {
                return null;
              }

              return (
                <motion.button
                  key={`${result.productId}-${result.pageId ?? 'root'}-${index}`}
                  initial={{ opacity: 0, scale: 0.92, x: position.x * 0.8, y: position.y * 0.8 }}
                  animate={{ opacity: 1, scale: 1, x: position.x, y: position.y }}
                  exit={{ opacity: 0, scale: 0.92, x: position.x * 0.8, y: position.y * 0.8 }}
                  transition={{ duration: 0.28, delay: index * 0.04 }}
                  onClick={() => onSelect(result)}
                  className="absolute left-1/2 top-1/2 z-10 w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/70 bg-card/95 p-4 text-left shadow-sm transition-all hover:scale-[1.01] hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {highlightSearchText(result.productName, query)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {result.pageName ? highlightSearchText(result.pageName, query) : 'Product overview'}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      {result.matchType}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-auto pt-1">
                    {result.productTags.slice(0, 3).map((tag, idx) => {
                      const color = getTagColor(tag);
                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] ${color.bg} ${color.text}`}
                        >
                          <span className={`size-1 rounded-full ${color.dot}`} />
                          {tag}
                        </span>
                      );
                    })}
                    {result.productTags.length > 3 && (
                      <span className="text-[9px] text-muted-foreground self-center">
                        +{result.productTags.length - 3}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: query.trim() ? -180 : 0 
              }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute left-1/2 top-1/2 z-20 w-[min(92vw,620px)] -translate-x-1/2 -translate-y-1/2"
            >
              <div className="overflow-hidden rounded-[28px] border border-border/80 bg-card/95 p-5 shadow-2xl backdrop-blur-xl transition-all duration-300">
                <AnimatePresence mode="wait">
                  {!query.trim() && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                          <Sparkles className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Super Search</p>
                          <p className="text-xs text-muted-foreground">Case-insensitive and word-order-insensitive search</p>
                        </div>
                      </div>
                      <div className="hidden items-center gap-1 rounded-full border bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground md:flex">
                        <CornerDownLeft className="size-3" />
                        Open result
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Search product, page, or content..."
                    className="h-14 rounded-2xl border-border/80 bg-background/70 pl-11 pr-4 text-base shadow-inner"
                  />
                </div>

                <AnimatePresence>
                  {!query.trim() && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>Type a few keywords to branch the results out</span>
                        <span className="hidden md:inline">Press Esc to close</span>
                      </div>

                      <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
                        Try `pricing roadmap`, `api auth`, or any phrase in any word order.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {query.trim() && (
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{results.length} results connected to this query</span>
                    <span className="hidden md:inline">Press Esc to close</span>
                  </div>
                )}

                {query.trim() && loading && (
                  <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
                    Building the search graph...
                  </div>
                )}

                {query.trim() && !loading && visibleResults.length === 0 && (
                  <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
                    No connected nodes found for <span className="font-medium text-foreground">"{query}"</span>.
                  </div>
                )}

                {results.length > visibleResults.length && (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Showing the top {visibleResults.length} nodes around the root.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
