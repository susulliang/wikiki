import { useRef, useEffect, useState } from 'react';
import { Search, Network, FileText, Loader2, CloudDownload, Cloud, ChevronDown, ChevronUp } from 'lucide-react';
import type { ExtendedSearchResult, MatchingParagraph } from '@/lib/search';
import { highlightSearchText } from '@/lib/search';
import { getTagColor } from '@/data/bundles';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface SuperSearchPageProps {
  query: string;
  results: ExtendedSearchResult[];
  loading: boolean;
  dbPrepping: boolean;
  remoteLoading?: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (result: ExtendedSearchResult, paragraphIndex?: number) => void;
  onOpenMindmap?: (result: ExtendedSearchResult) => void;
  onDownloadCollection?: (collection: string) => void;
}

export default function SuperSearchPage({
  query,
  results,
  loading,
  dbPrepping,
  remoteLoading,
  onQueryChange,
  onSelect,
  onOpenMindmap,
  onDownloadCollection,
}: SuperSearchPageProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  // Track whether the user's query differs from the displayed results
  // (i.e., search is debouncing/computing). When the input changes but
  // results haven't updated yet, show a "searching…" indicator.
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // When query changes, mark as searching; results prop will catch up after debounce
  useEffect(() => {
    if (!query.trim()) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
  }, [query]);

  // When results update (debounce completed), clear searching flag
  useEffect(() => {
    if (query.trim()) {
      // Results just arrived — flip the flag off on next tick so the
      // progress bar completes smoothly rather than vanishing mid-frame.
      const t = setTimeout(() => setIsSearching(false), 150);
      return () => clearTimeout(t);
    }
  }, [results, query]);

  // Split results into local and remote for separate sections
  const localResults = results.filter((r) => r.source !== 'remote');
  const remoteResults = results.filter((r) => r.source === 'remote');

  const showDbPrepBar = dbPrepping;
  const showRemoteBar = remoteLoading && !dbPrepping;
  const showSearchBar = isSearching && !dbPrepping && !remoteLoading;

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('search.placeholder')}
            className="w-full border-2 border-border bg-card py-4 pl-12 pr-4 font-serif text-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {(loading || dbPrepping || remoteLoading || isSearching) && (
            <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Progress bars — stacked, highest priority first */}
        <div className="mt-3 space-y-2">
          {showDbPrepBar && (
            <ProgressBar
              label="Preparing search index…"
              pct={45}
              variant="muted"
            />
          )}
          {showRemoteBar && (
            <ProgressBar
              label="Searching remote collections…"
              variant="primary"
              indeterminate
            />
          )}
          {showSearchBar && (
            <ProgressBar
              label={`Searching for "${query.trim()}"…`}
              pct={75}
              variant="muted"
              indeterminate
            />
          )}
        </div>
      </div>

      <div className="mx-auto flex h-full w-full max-w-2xl flex-1 flex-col overflow-y-auto px-6 pb-10">
        {!loading && !query && (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
            <Search className="mb-3 size-8 opacity-40" />
            <p className="text-sm">Start typing to search across your knowledge base.</p>
          </div>
        )}

        {!loading && query && !isSearching && results.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
            <Search className="mb-3 size-8 opacity-40" />
            <p className="text-sm">{t('search.noResults')}</p>
          </div>
        )}

        {/* Local results */}
        {localResults.length > 0 && (
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {localResults.length} local result{localResults.length !== 1 ? 's' : ''}
            </p>
            {localResults.map((result, idx) => (
              <ResultCard
                key={`local-${result.bundleId}-${result.pageId ?? 'p'}-${idx}`}
                result={result}
                query={query}
                onSelect={onSelect}
                onOpenMindmap={onOpenMindmap}
              />
            ))}
          </div>
        )}

        {/* Remote results */}
        {remoteResults.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5 border-t border-border/60 pt-3 text-[11px] font-semibold uppercase tracking-wider text-primary/70">
              <Cloud className="size-3" />
              Remote — download to access ({remoteResults.length})
            </div>
            <div className="space-y-3">
              {remoteResults.map((result, idx) => (
                <RemoteResultCard
                  key={`remote-${result.bundleId}-${result.pageId ?? 'p'}-${idx}`}
                  result={result}
                  query={query}
                  onDownload={onDownloadCollection}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A labeled progress bar with percentage. */
function ProgressBar({
  label,
  pct = 0,
  variant = 'muted',
  indeterminate = false,
}: {
  label: string;
  pct?: number;
  variant?: 'muted' | 'primary';
  indeterminate?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-lg border px-3 py-2',
      variant === 'primary' ? 'border-primary/30 bg-primary/5' : 'border-border bg-card/50',
    )}>
      <div className="mb-1 flex items-center gap-1.5">
        <Loader2 className={cn(
          'size-3 animate-spin',
          variant === 'primary' ? 'text-primary' : 'text-muted-foreground',
        )} />
        <span className={cn(
          'flex-1 text-[11px] font-medium',
          variant === 'primary' ? 'text-foreground' : 'text-muted-foreground',
        )}>
          {label}
        </span>
        {!indeterminate && (
          <span className="font-mono text-[10px] text-muted-foreground">{pct}%</span>
        )}
      </div>
      <Progress
        value={indeterminate ? 50 : pct}
        className={cn('h-1', indeterminate && 'animate-pulse')}
      />
    </div>
  );
}

// ── Local result card with expandable matching paragraph bubbles ──

interface ResultCardProps {
  result: ExtendedSearchResult;
  query: string;
  onSelect: (result: ExtendedSearchResult, paragraphIndex?: number) => void;
  onOpenMindmap?: (result: ExtendedSearchResult) => void;
}

function ResultCard({ result, query, onSelect, onOpenMindmap }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const paragraphs = result.matchingParagraphs;
  const hasMultiple = paragraphs.length > 1;

  return (
    <div className="border-2 border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onSelect(result, 0)}
            className="truncate font-serif text-lg font-bold text-foreground hover:text-primary"
          >
            {result.bundleName}
          </button>
          {result.isMindmap && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-primary">
              <Network className="size-3" />
              Mindmap
            </span>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 border px-2 py-0.5 font-mono text-xs uppercase tracking-wider',
            result.matchType === 'name'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground',
          )}
        >
          {result.matchType}
        </span>
      </div>

      {result.pageName && (
        <div className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <FileText className="size-3" />
          {result.pageName}
        </div>
      )}

      {/* Bubble showing the top match — always visible */}
      <ParagraphBubble
        paragraph={paragraphs[0]}
        query={query}
        rank={1}
        onClick={() => onSelect(result, 0)}
      />

      {/* Expandable additional bubbles */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {paragraphs.length - 1} more match{paragraphs.length - 1 !== 1 ? 'es' : ''}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {paragraphs.slice(1).map((para, i) => (
                <ParagraphBubble
                  key={`${para.matchStart}-${i}`}
                  paragraph={para}
                  query={query}
                  rank={i + 2}
                  onClick={() => onSelect(result, i + 1)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Noticable mindmap entry — jumps straight into this bundle's mindmap
          view with the search term (minus product name) pre-filtering nodes. */}
      {result.isMindmap && onOpenMindmap && (
        <button
          type="button"
          onClick={() => onOpenMindmap(result)}
          className="group mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-primary/60 bg-primary/10 px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-primary transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Network className="size-4 transition-transform group-hover:scale-110" />
          Open Mindmap
          <span className="hidden font-mono text-[10px] font-normal normal-case tracking-normal opacity-70 sm:inline">
            · search term auto-filters nodes
          </span>
        </button>
      )}

      {result.bundleTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.bundleTags.map((tag) => {
            const color = getTagColor(tag);
            return (
              <span
                key={tag}
                className={cn(
                  'rounded-full border border-transparent px-2 py-0.5 text-xs font-medium',
                  color.bg,
                  color.text,
                )}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A single matching excerpt bubble, ranked by relevance. */
function ParagraphBubble({
  paragraph,
  query,
  rank,
  onClick,
}: {
  paragraph: MatchingParagraph;
  query: string;
  rank: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-lg border border-border/60 bg-background/50 p-3 text-left transition-all hover:border-primary/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Match #{rank}
        </span>
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
      <p className="line-clamp-3 text-sm leading-relaxed text-foreground">
        {highlightSearchText(paragraph.excerpt, query)}
      </p>
    </button>
  );
}

// ── Remote result card (shows matches + download prompt) ──

interface RemoteResultCardProps {
  result: ExtendedSearchResult;
  query: string;
  onDownload?: (collection: string) => void;
}

function RemoteResultCard({ result, query, onDownload }: RemoteResultCardProps) {
  const paragraphs = result.matchingParagraphs;

  return (
    <div className="border-2 border-dashed border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary/50">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Cloud className="size-4 shrink-0 text-primary/60" />
          <span className="truncate font-serif text-lg font-bold text-foreground">
            {result.bundleName}
          </span>
          {result.isMindmap && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-primary">
              <Network className="size-3" />
              Mindmap
            </span>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
          {result.collection}
        </span>
      </div>

      {result.pageName && (
        <div className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <FileText className="size-3" />
          {result.pageName}
        </div>
      )}

      {/* Show top 2 matching paragraphs as bubbles */}
      <div className="space-y-2">
        {paragraphs.slice(0, 2).map((para, i) => (
          <div
            key={`${para.matchStart}-${i}`}
            className="rounded-lg border border-border/60 bg-background/50 p-3"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Match #{i + 1}
              </span>
              <div className="flex items-center gap-1">
                {para.matchedTokens.slice(0, 3).map((token, j) => (
                  <span
                    key={j}
                    className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>
            <p className="line-clamp-2 text-sm leading-relaxed text-foreground">
              {highlightSearchText(para.excerpt, query)}
            </p>
          </div>
        ))}
        {paragraphs.length > 2 && (
          <p className="text-[10px] text-muted-foreground">
            +{paragraphs.length - 2} more match{paragraphs.length - 2 !== 1 ? 'es' : ''}
          </p>
        )}
      </div>

      {result.bundleTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.bundleTags.map((tag) => {
            const color = getTagColor(tag);
            return (
              <span
                key={tag}
                className={cn(
                  'rounded-full border border-transparent px-2 py-0.5 text-xs font-medium',
                  color.bg,
                  color.text,
                )}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Download prompt */}
      {onDownload && result.collection && (
        <Button
          size="sm"
          className="mt-3 w-full gap-1.5 text-xs"
          onClick={() => onDownload(result.collection!)}
        >
          <CloudDownload className="size-3.5" />
          Download collection "{result.collection}"
        </Button>
      )}
    </div>
  );
}
