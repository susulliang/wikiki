import { useRef, useEffect } from 'react';
import { Search, Network, FileText, Loader2 } from 'lucide-react';
import type { ExtendedSearchResult } from '@/lib/search';
import { highlightSearchText } from '@/lib/search';
import { getTagColor } from '@/data/bundles';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

interface SuperSearchPageProps {
  query: string;
  results: ExtendedSearchResult[];
  loading: boolean;
  dbPrepping: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (result: ExtendedSearchResult, paragraphIndex?: number) => void;
}

export default function SuperSearchPage({
  query,
  results,
  loading,
  dbPrepping,
  onQueryChange,
  onSelect,
}: SuperSearchPageProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the search input as soon as the page mounts — the input is
  // interactive immediately even while the database is being prepped async.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
          {(loading || dbPrepping) && (
            <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {dbPrepping && !query && (
          <p className="mt-2 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Preparing search index…
          </p>
        )}
      </div>

      <div className="mx-auto flex h-full w-full max-w-2xl flex-1 flex-col overflow-y-auto px-6 pb-10">
        {!loading && !query && (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
            <Search className="mb-3 size-8 opacity-40" />
            <p className="text-sm">Start typing to search across your knowledge base.</p>
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
            <Search className="mb-3 size-8 opacity-40" />
            <p className="text-sm">{t('search.noResults')}</p>
          </div>
        )}

        <div className="space-y-3">
          {results.map((result, idx) => (
            <ResultCard
              key={`${result.bundleId}-${result.pageId ?? 'p'}-${idx}`}
              result={result}
              query={query}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ResultCardProps {
  result: ExtendedSearchResult;
  query: string;
  onSelect: (result: ExtendedSearchResult, paragraphIndex?: number) => void;
}

function ResultCard({ result, query, onSelect }: ResultCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result, 0)}
      className="block w-full border-2 border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
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
        <span
          className={cn(
            'shrink-0 border px-2 py-0.5 font-mono text-xs uppercase tracking-wider',
            result.matchType === 'name'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : result.matchType === 'tag'
                ? 'border-border bg-background text-muted-foreground'
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

      <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-foreground">
        {highlightSearchText(result.snippet, query)}
      </p>

      {result.bundleTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
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
    </button>
  );
}
