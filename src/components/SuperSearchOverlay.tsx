import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Sparkles, CornerDownLeft, X, ArrowLeft, Network, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ExtendedSearchResult, MatchingParagraph } from '@/lib/search';
import { getTagColor } from '@/data/bundles';
import { highlightSearchText } from '@/lib/search';

interface SuperSearchOverlayProps {
  open: boolean;
  query: string;
  results: ExtendedSearchResult[];
  loading?: boolean;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onSelect: (result: ExtendedSearchResult, paragraphIndex?: number) => void;
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
    // Start from top (-π/2) and go clockwise
    const angle = (-Math.PI / 2) + (index * (Math.PI * 2)) / count;
    return {
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY,
    };
  });
}

function ParagraphBubble({
  paragraph,
  query,
  index,
  onClick,
  isMindmap,
}: {
  paragraph: MatchingParagraph;
  query: string;
  index: number;
  onClick: () => void;
  isMindmap?: boolean;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      onClick={onClick}
      className="w-full rounded-xl border border-border/70 bg-card/95 p-4 text-left shadow-sm transition-all hover:scale-[1.01] hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isMindmap ? (
            <>
              <span className="flex size-5 items-center justify-center rounded-md bg-primary/15 text-primary shadow-sm">
                <Network className="size-3" />
              </span>
              <span className="font-medium text-primary">Mindmap</span>
            </>
          ) : (
            <>
              <FileText className="size-3.5" />
              <span>Match #{index + 1}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {paragraph.matchedTokens.slice(0, 3).map((token, i) => (
            <span
              key={i}
              className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              {token}
            </span>
          ))}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {highlightSearchText(paragraph.excerpt, query)}
      </p>
      {isMindmap && (
        <p className="mt-2 text-xs text-primary">
          Click to open in mindmap view
        </p>
      )}
    </motion.button>
  );
}

function ExpandedResultPanel({
  result,
  query,
  onBack,
  onSelectParagraph,
}: {
  result: ExtendedSearchResult;
  query: string;
  onBack: () => void;
  onSelectParagraph: (paragraphIndex: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute inset-0 z-30 flex h-full w-full flex-col rounded-2xl border border-border/80 bg-background/95"
    >
      <div className="flex items-center gap-3 border-b p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 rounded-full"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {highlightSearchText(result.bundleName, query)}
            </p>
            {result.isMindmap && (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary shadow-sm">
                <Network className="size-3" />
              </span>
            )}
          </div>
          {result.pageName && (
            <p className="truncate text-xs text-muted-foreground">
              {highlightSearchText(result.pageName, query)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {result.bundleTags.slice(0, 2).map((tag, idx) => {
            const color = getTagColor(tag);
            return (
              <span
                key={idx}
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${color.bg} ${color.text}`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            {result.matchingParagraphs.length} matching paragraph{result.matchingParagraphs.length !== 1 ? 's' : ''} found.
            {result.isMindmap && ' Contains mindmap content.'}
          </p>
          
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {result.matchingParagraphs.map((paragraph, index) => (
              <ParagraphBubble
                key={`${paragraph.matchStart}-${index}`}
                paragraph={paragraph}
                query={query}
                index={index}
                onClick={() => onSelectParagraph(index)}
                isMindmap={result.isMindmap}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  );
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
  const [expandedResult, setExpandedResult] = useState<ExtendedSearchResult | null>(null);
  const visibleResults = results.slice(0, 8);
  const positions = useMemo(() => getNodePositions(visibleResults.length), [visibleResults.length]);

  const handleResultClick = (result: ExtendedSearchResult) => {
    // If mindmap or only one paragraph, go directly to the bundle
    if (result.isMindmap || result.matchingParagraphs.length === 1) {
      onSelect(result, 0);
    } else {
      // Show expanded panel with all paragraphs
      setExpandedResult(result);
    }
  };

  const handleParagraphSelect = (paragraphIndex: number) => {
    if (expandedResult) {
      onSelect(expandedResult, paragraphIndex);
      setExpandedResult(null);
    }
  };

  const handleBack = () => {
    setExpandedResult(null);
  };

  const handleClose = () => {
    setExpandedResult(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !expandedResult) {
              handleClose();
            }
          }}
          className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-[2px]"
        >
          <div className="relative h-full w-full overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.12),transparent_42%)]" />

            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="absolute right-6 top-6 z-20 h-10 w-10 rounded-full border bg-card/90 shadow-sm"
              title="Close super search"
            >
              <X className="size-4" />
            </Button>

            {/* Connection lines - only show when not expanded */}
            {!expandedResult && (
              <div className="pointer-events-none absolute inset-0">
                {positions.map((position, index) => {
                  const length = Math.sqrt(position.x ** 2 + position.y ** 2);
                  const angle = Math.atan2(position.y, position.x);

                  return (
                    <motion.div
                      key={`line-${visibleResults[index]?.bundleId}-${visibleResults[index]?.pageId ?? 'root'}-${index}`}
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
            )}

            {/* Result nodes - only show when not expanded */}
            {!expandedResult && positions.map((position, index) => {
              const result = visibleResults[index];
              if (!result) {
                return null;
              }

              return (
                <motion.button
                  key={`${result.bundleId}-${result.pageId ?? 'root'}-${index}`}
                  initial={{ opacity: 0, scale: 0.92, x: position.x * 0.8, y: position.y * 0.8 }}
                  animate={{ opacity: 1, scale: 1, x: position.x, y: position.y }}
                  exit={{ opacity: 0, scale: 0.92, x: position.x * 0.8, y: position.y * 0.8 }}
                  transition={{ duration: 0.28, delay: index * 0.04 }}
                  onClick={() => handleResultClick(result)}
                  className="absolute left-1/2 top-1/2 z-10 w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/70 bg-card/95 p-4 text-left shadow-sm transition-all hover:scale-[1.01] hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {highlightSearchText(result.bundleName, query)}
                        </p>
                        {result.isMindmap && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm" title="Mindmap">
                            <Network className="size-3" />
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {result.pageName ? highlightSearchText(result.pageName, query) : 'Bundle overview'}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1 max-w-[40%]">
                      {result.bundleTags.slice(0, 2).map((tag, idx) => {
                        const color = getTagColor(tag);
                        return (
                          <span
                            key={idx}
                            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${color.bg} ${color.text}`}
                          >
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {highlightSearchText(result.snippet, query)}
                  </p>
                  {result.matchingParagraphs.length > 1 && (
                    <p className="mt-2 text-[10px] text-primary">
                      {result.matchingParagraphs.length} matches • Click to view all
                    </p>
                  )}
                </motion.button>
              );
            })}

            {/* Center search input */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0 
              }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              style={{ width: 'min(92vw, 620px)' }}
            >
              <motion.div 
                layout
                className="overflow-hidden rounded-[28px] border border-border/80 bg-card/95 shadow-2xl backdrop-blur-sm transition-all duration-300 flex flex-col items-center"
                style={{ 
                  width: query.trim() ? '360px' : '100%',
                  padding: query.trim() ? '12px' : '20px',
                  borderRadius: query.trim() ? '20px' : '28px',
                  transition: 'width 0.3s ease-in-out, padding 0.3s ease-in-out, border-radius 0.3s ease-in-out'
                }}
              >
                <AnimatePresence mode="popLayout">
                  {!query.trim() && (
                    <motion.div
                      key="header"
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="flex w-full items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                          <Sparkles className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Super Search</p>
                          <p className="text-xs text-muted-foreground">Whole-word search with smart ranking</p>
                        </div>
                      </div>
                      <div className="hidden items-center gap-1 rounded-full border bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground md:flex">
                        <CornerDownLeft className="size-3" />
                        Open result
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div 
                  layout
                  className="relative w-full flex justify-center"
                >
                  <motion.div 
                    layout
                    className="relative flex items-center w-full"
                  >
                    <Search className="pointer-events-none absolute left-4 size-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={query}
                      onChange={(event) => onQueryChange(event.target.value)}
                      placeholder="Search bundle, page, or content..."
                      className="h-14 w-full rounded-2xl border-border/80 bg-background/70 pl-11 pr-4 text-base shadow-inner"
                    />
                  </motion.div>
                </motion.div>

                <AnimatePresence mode="popLayout">
                  {!query.trim() && (
                    <motion.div
                      key="tips"
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="w-full"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground px-1">
                        <span>Type keywords to search (whole words only)</span>
                        <span className="hidden md:inline">Press Esc to close</span>
                      </div>

                      <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
                        Try `pricing`, `roadmap api`, or any phrase. Words can be in any order, but exact sequences rank higher.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {query.trim() && loading && (
                  <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
                    Building the search graph...
                  </div>
                )}

                {query.trim() && !loading && visibleResults.length === 0 && (
                  <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
                    No whole-word matches found for <span className="font-medium text-foreground">"{query}"</span>.
                  </div>
                )}

                {query.trim() && results.length > visibleResults.length && (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Showing the top {visibleResults.length} matches around the root.
                  </p>
                )}
              </motion.div>
            </motion.div>

            {/* Expanded result panel */}
            <AnimatePresence>
              {expandedResult && (
                <motion.div
                  layout
                  className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
                  style={{ 
                    width: 'min(95vw, 1200px)', 
                    height: 'min(90vh, 700px)',
                  }}
                >
                  <ExpandedResultPanel
                    result={expandedResult}
                    query={query}
                    onBack={handleBack}
                    onSelectParagraph={handleParagraphSelect}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}