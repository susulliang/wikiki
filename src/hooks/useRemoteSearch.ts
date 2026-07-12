/**
 * Hook that searches remote cloud storage WITHOUT downloading full DBs.
 *
 * Calls the active provider's `searchRemote(query)` method (if available),
 * which runs SQL LIKE queries against a server-side search index. Returns
 * lightweight RemoteSearchResult[] — just enough to show result cards with
 * excerpts. The user can then download the full collection if they want
 * to access the actual content.
 *
 * The search is debounced (via the debounced query prop) and only runs
 * when the query is non-empty and the provider supports remote search.
 */
import { useState, useEffect } from 'react';
import type { RemoteSearchResult } from '@/lib/cloud-provider';
import { getActiveProvider } from '@/lib/provider-registry';

export interface UseRemoteSearchResult {
  /** Remote search results (lightweight, no full content) */
  results: RemoteSearchResult[];
  /** True while the remote search query is in flight */
  loading: boolean;
  /** Error message if the search failed */
  error: string | null;
}

export function useRemoteSearch(
  enabled: boolean,
  debouncedQuery: string,
): UseRemoteSearchResult {
  const [results, setResults] = useState<RemoteSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    // Clear results if disabled or query is empty
    if (!enabled || !trimmed) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const provider = getActiveProvider();
    if (!provider.hasCredentials() || !provider.searchRemote) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const remoteResults = await provider.searchRemote!(trimmed);
        if (!cancelled) {
          setResults(remoteResults);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, debouncedQuery]);

  return { results, loading, error };
}
