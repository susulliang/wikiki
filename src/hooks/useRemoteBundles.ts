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

export interface UseRemoteBundlesResult {
  /** Parsed bundles from all remote collections, keyed by collection name */
  remoteCollections: RemoteCollectionBundles[];
  /** True while downloading/parsing remote collections */
  loading: boolean;
  /** Error message if the fetch failed */
  error: string | null;
}

export function useRemoteBundles(enabled: boolean): UseRemoteBundlesResult {
  const [remoteCollections, setRemoteCollections] = useState<RemoteCollectionBundles[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, IBundle[]>>(new Map());

  useEffect(() => {
    if (!enabled) {
      setRemoteCollections([]);
      setLoading(false);
      setError(null);
      return;
    }

    const provider = getActiveProvider();
    if (!provider.hasCredentials()) {
      setRemoteCollections([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const collections = await provider.listUploadedCollections();
        const results: RemoteCollectionBundles[] = [];

        for (const entry of collections) {
          if (cancelled) return;

          // Check cache first
          const cached = cacheRef.current.get(entry.name);
          if (cached) {
            results.push({ collection: entry.name, bundles: cached });
            continue;
          }

          // Download and parse
          try {
            const bytes = await provider.downloadCollectionDB(entry.name);
            const bundles = await bundlesFromDbBytes(bytes);
            cacheRef.current.set(entry.name, bundles);
            results.push({ collection: entry.name, bundles });
          } catch (e) {
            console.error(`Failed to download collection ${entry.name}:`, e);
          }
        }

        if (!cancelled) {
          setRemoteCollections(results);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setRemoteCollections([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { remoteCollections, loading, error };
}
