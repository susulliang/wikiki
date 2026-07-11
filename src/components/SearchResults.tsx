import { motion } from 'framer-motion';
import { FileText, Tag, BookOpen } from 'lucide-react';
import type { SearchResult } from '@/data/products';
import { getTagColor } from '@/data/products';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  onSelect: (productId: string, pageIndex?: number) => void;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let idx = lower.indexOf(q, lastIdx);
  while (idx !== -1) {
    if (idx > lastIdx) {
      parts.push(text.slice(lastIdx, idx));
    }
    parts.push(
      <mark key={idx} className="rounded-sm bg-primary/20 px-0.5 text-foreground">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    lastIdx = idx + q.length;
    idx = lower.indexOf(q, lastIdx);
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts.length > 0 ? parts : text;
}

export default function SearchResults({ results, query, onSelect }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <FileText className="mb-4 size-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No results found for <span className="font-medium text-foreground">"{query}"</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto space-y-4 p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Search Results</h2>
        <span className="text-sm text-muted-foreground">
          Found {results.length} results for "{query}"
        </span>
      </div>
      <div className="space-y-3">
        {results.map((result, i) => (
          <motion.button
            key={`${result.productId}-${result.pageId ?? 'name'}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            onClick={() => {
              const productPageIdx = result.pageId
                ? undefined
                : 0;
              onSelect(result.productId, productPageIdx ?? 0);
            }}
            className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
          >
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-hidden">
                <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium truncate">{highlightText(result.productName, query)}</span>
                {result.pageName && (
                  <>
                    <span className="text-muted-foreground shrink-0">/</span>
                    <span className="text-sm text-muted-foreground truncate">{result.pageName}</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                {result.productTags.map((tag, idx) => {
                  const color = getTagColor(tag);
                  return (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${color.bg} ${color.text}`}
                    >
                      <span className={`size-1 rounded-full ${color.dot}`} />
                      {tag}
                    </span>
                  );
                })}
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {highlightText(result.snippet, query)}
            </p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
