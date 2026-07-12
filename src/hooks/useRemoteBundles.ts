/**
 * Hook that downloads and caches remote cloud collection DBs for search.
 *
 * When enabled and cloud credentials are present, this fetches the remote
 * collection list, downloads each collection's SQLite DB, parses it into
 * IBundle[], and caches the results in memory for the session.
 *
 * Used by Super Search to include remote bundles in search results.
 */
import { useState, useEffect, useRef } from 'react';
import type { IBundle } from '@/data/bundles';
import { getActiveProvider } from '@/lib/provider-registry';
import { bundlesFromDbBytes } from '@/lib/sqlite-storage';

export interface RemoteCollectionBundles {
  collection: string;
  bundles: IBundle[];
}

export interface RemoteProgress {
  /** 0-100 percentage */
  pct: number;
  /** Human-readable status message */
  step: string;
}

export interface UseRemoteBundlesResult {
  /** Parsed bundles from all remote collections, keyed by collection name */
  remoteCollections: RemoteCollectionBundles[];
  /** True while downloading/parsing remote collections */
  loading: boolean;
  /** Error message if the fetch failed */
  error: string | null;
  /** Progress info for the current loading operation (null when idle) */
  progress: RemoteProgress | null;
}

export function useRemoteBundles(enabled: boolean): UseRemoteBundlesResult {
  const [remoteCollections, setRemoteCollections] = useState<RemoteCollectionBundles[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<RemoteProgress | null>(null);
  const cacheRef = useRef<Map<string, IBundle[]>>(new Map());

  useEffect(() => {
    if (!enabled) {
      setRemoteCollections([]);
      setLoading(false);
      setError(null);
      setProgress(null);
      return;
    }

    const provider = getActiveProvider();
    if (!provider.hasCredentials()) {
      setRemoteCollections([]);
      setProgress(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setProgress({ pct: 5, step: 'Listing remote collections…' });

    (async () => {
      try {
        const collections = await provider.listUploadedCollections();
        if (cancelled) return;

        if (collections.length === 0) {
          setProgress({ pct: 100, step: 'No remote collections found' });
          setRemoteCollections([]);
          return;
        }

        const results: RemoteCollectionBundles[] = [];
        const total = collections.length;
        let allCached = true;

        for (let i = 0; i < collections.length; i++) {
          if (cancelled) return;
          const entry = collections[i];

          // Check cache first
          const cached = cacheRef.current.get(entry.name);
          if (cached) {
            results.push({ collection: entry.name, bundles: cached });
            // Still advance progress for cached entries
            const pct = Math.round(((i + 1) / total) * 100);
            setProgress({ pct, step: `Loaded cached collection "${entry.name}" (${i + 1}/${total})` });
            continue;
          }

          allCached = false;
          // Download and parse
          setProgress({
            pct: Math.round((i / total) * 100),
            step: `Downloading collection "${entry.name}" (${i + 1}/${total})…`,
          });
          try {
            const bytes = await provider.downloadCollectionDB(entry.name);
            setProgress({
              pct: Math.round(((i + 0.5) / total) * 100),
              step: `Parsing "${entry.name}" (${i + 1}/${total})…`,
            });
            const bundles = await bundlesFromDbBytes(bytes);
            cacheRef.current.set(entry.name, bundles);
            results.push({ collection: entry.name, bundles });
          } catch (e) {
            console.error(`Failed to download collection ${entry.name}:`, e);
          }
          const pct = Math.round(((i + 1) / total) * 100);
          setProgress({ pct, step: `Loaded "${entry.name}" (${i + 1}/${total})` });
        }

        if (!cancelled) {
          setRemoteCollections(results);
          setProgress({
            pct: 100,
            step: allCached
              ? `Loaded ${results.length} cached collection${results.length !== 1 ? 's' : ''}`
              : `Loaded ${results.length} remote collection${results.length !== 1 ? 's' : ''}`,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setRemoteCollections([]);
          setProgress(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          // Keep the final progress visible briefly; parent clears on next query
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { remoteCollections, loading, error, progress };
}
