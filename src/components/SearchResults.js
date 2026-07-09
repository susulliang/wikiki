import { motion } from 'framer-motion';
import { FileText, Tag, BookOpen } from 'lucide-react';
function highlightText(text, query) {
    if (!query)
        return text;
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    const parts = [];
    let lastIdx = 0;
    let idx = lower.indexOf(q, lastIdx);
    while (idx !== -1) {
        if (idx > lastIdx) {
            parts.push(text.slice(lastIdx, idx));
        }
        parts.push(<mark key={idx} className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/30">
        {text.slice(idx, idx + q.length)}
      </mark>);
        lastIdx = idx + q.length;
        idx = lower.indexOf(q, lastIdx);
    }
    if (lastIdx < text.length) {
        parts.push(text.slice(lastIdx));
    }
    return parts.length > 0 ? parts : text;
}
export default function SearchResults({ results, query, onSelect }) {
    if (results.length === 0) {
        return (<div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <FileText className="mb-4 size-12 text-muted-foreground/50"/>
        <p className="text-sm text-muted-foreground">
          No results found for <span className="font-medium text-foreground">"{query}"</span>
        </p>
      </div>);
    }
    return (<div className="flex-1 overflow-auto space-y-4 p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Search Results</h2>
        <span className="text-sm text-muted-foreground">
          Found {results.length} results for "{query}"
        </span>
      </div>
      <div className="space-y-3">
        {results.map((result, i) => (<motion.button key={`${result.productId}-${result.pageId ?? 'name'}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04 }} onClick={() => {
                const productPageIdx = result.pageId
                    ? undefined
                    : 0;
                onSelect(result.productId, productPageIdx ?? 0);
            }} className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/50">
            <div className="mb-1.5 flex items-center gap-2">
              {result.matchType === 'tag' ? (<Tag className="size-4 text-muted-foreground"/>) : (<BookOpen className="size-4 text-muted-foreground"/>)}
              <span className="font-medium">{highlightText(result.productName, query)}</span>
              {result.pageName && (<>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-sm text-muted-foreground">{result.pageName}</span>
                </>)}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {highlightText(result.snippet, query)}
            </p>
          </motion.button>))}
      </div>
    </div>);
}
