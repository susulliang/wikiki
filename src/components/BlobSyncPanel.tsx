import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { X, Cloud, CloudUpload, CloudDownload, Trash2, KeyRound, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/hooks/useLanguage';
import {
  localCollections,
  type CollectionEntry,
  type ProviderId,
} from '@/lib/cloud-provider';
import {
  getActiveProvider,
  getActiveProviderId,
  setActiveProviderId,
} from '@/lib/provider-registry';
import {
  getBlobCreds as getEdgeoneCreds,
  saveBlobCreds as saveEdgeoneCreds,
  clearBlobCreds as clearEdgeoneCreds,
} from '@/lib/edgeone-blob';
import {
  getD1Creds,
  saveD1Creds,
  clearD1Creds,
} from '@/lib/d1-provider';
import { getSQLiteStorage, jsonBundlesToSQLite, bundlesFromDbBytes, mergeBundles } from '@/lib/sqlite-storage';
import type { IBundle } from '@/data/bundles';

interface BlobSyncPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundles: IBundle[];
  onReloadBundles: () => Promise<void>;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function BlobSyncPanel({ open, onOpenChange, bundles, onReloadBundles }: BlobSyncPanelProps) {
  const { t } = useLanguage();

  // Active cloud provider (edgeone | d1), persisted to localStorage.
  const [providerId, setProviderId] = useState<ProviderId>(() => getActiveProviderId());

  // EdgeOne credential form state
  const [eoProjectId, setEoProjectId] = useState('');
  const [eoToken, setEoToken] = useState('');
  const [eoStoreName, setEoStoreName] = useState('wikiki-db-sync');

  // D1 credential form state
  const [cfAccountId, setCfAccountId] = useState('');
  const [cfApiToken, setCfApiToken] = useState('');

  const [hasCreds, setHasCreds] = useState(false);
  const [testing, setTesting] = useState(false);
  const [remote, setRemote] = useState<CollectionEntry[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** Status message for the current upload/download operation (shown in UI + progress bar). */
  const [status, setStatus] = useState<{ op: string; step: string; pct: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = getActiveProviderId();
    setProviderId(id);
    if (id === 'edgeone') {
      const creds = getEdgeoneCreds();
      if (creds) {
        setEoProjectId(creds.projectId);
        setEoToken(creds.token);
        setEoStoreName(creds.storeName);
        setHasCreds(true);
      } else {
        setHasCreds(false);
        setRemote([]);
      }
    } else {
      const creds = getD1Creds();
      if (creds) {
        setCfAccountId(creds.accountId);
        setCfApiToken(creds.token);
        setHasCreds(true);
      } else {
        setHasCreds(false);
        setRemote([]);
      }
    }
    void refreshRemote(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refreshRemote = useCallback(async (id: ProviderId = getActiveProviderId()) => {
    setLoadingRemote(true);
    try {
      const list = await getActiveProvider().listUploadedCollections();
      // guard against provider switching mid-flight
      if (getActiveProviderId() === id) setRemote(list);
    } catch (e) {
      console.error('Failed to list remote collections:', String(e));
      if (getActiveProviderId() === id) setRemote([]);
    } finally {
      if (getActiveProviderId() === id) setLoadingRemote(false);
    }
  }, []);

  const handleSwitchProvider = useCallback(
    (id: ProviderId) => {
      if (id === providerId) return;
      setActiveProviderId(id);
      setProviderId(id);
      setRemote([]);
      // Reflect the newly-selected provider's stored credentials into the form.
      if (id === 'edgeone') {
        const creds = getEdgeoneCreds();
        if (creds) {
          setEoProjectId(creds.projectId);
          setEoToken(creds.token);
          setEoStoreName(creds.storeName);
          setHasCreds(true);
        } else {
          setHasCreds(false);
        }
      } else {
        const creds = getD1Creds();
        if (creds) {
          setCfAccountId(creds.accountId);
          setCfApiToken(creds.token);
          setHasCreds(true);
        } else {
          setHasCreds(false);
        }
      }
      void refreshRemote(id);
    },
    [providerId, refreshRemote],
  );

  /** Persist credentials for the active provider. Returns error message or null on success. */
  const persistCreds = useCallback((): string | null => {
    if (providerId === 'edgeone') {
      if (!eoProjectId.trim() || !eoToken.trim()) return 'Project ID and API Token are required';
      saveEdgeoneCreds({
        projectId: eoProjectId.trim(),
        token: eoToken.trim(),
        storeName: eoStoreName.trim() || 'wikiki-db-sync',
      });
      return null;
    }
    if (!cfAccountId.trim() || !cfApiToken.trim()) return 'Cloudflare Account ID and API Token are required';
    try {
      saveD1Creds({ accountId: cfAccountId.trim(), token: cfApiToken.trim() });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [providerId, eoProjectId, eoToken, eoStoreName, cfAccountId, cfApiToken]);

  const handleSaveCreds = useCallback(() => {
    const error = persistCreds();
    if (error) {
      toast.error(error);
      return;
    }
    setHasCreds(true);
    toast.success('Credentials saved');
    void refreshRemote();
  }, [persistCreds, refreshRemote]);

  const handleClearCreds = useCallback(() => {
    if (providerId === 'edgeone') {
      clearEdgeoneCreds();
      setEoProjectId('');
      setEoToken('');
      setEoStoreName('wikiki-db-sync');
    } else {
      clearD1Creds();
      setCfAccountId('');
      setCfApiToken('');
    }
    setHasCreds(false);
    setRemote([]);
    toast.info('Credentials cleared');
  }, [providerId]);

  const handleTest = useCallback(async () => {
    const error = persistCreds();
    if (error) {
      toast.error(error);
      return;
    }
    setHasCreds(true);
    setTesting(true);
    try {
      await getActiveProvider().testConnection();
      toast.success(t('blob.connectionOk'));
    } catch (e) {
      toast.error(`Connection failed: ${String(e).slice(0, 80)}`);
    } finally {
      setTesting(false);
    }
  }, [persistCreds, providerId, t]);

  const handleUpload = useCallback(
    async (name: string) => {
      setBusy(`upload:${name}`);
      setStatus({ op: 'upload', step: t('blob.statusReadingLocal'), pct: 10 });
      try {
        const storage = getSQLiteStorage();
        const all = await storage.getAllBundles();
        const localSubset = all.filter((b) => (b.collection && b.collection.trim() ? b.collection.trim() : 'Default') === name);
        if (localSubset.length === 0) {
          toast.error('No bundles in this collection');
          return;
        }

        // Download existing remote collection and merge (keep richer copies)
        let mergedBundles = localSubset;
        try {
          setStatus({ op: 'upload', step: 'Downloading remote for merge...', pct: 20 });
          const remoteBytes = await getActiveProvider().downloadCollectionDB(name);
          const remoteBundles = await bundlesFromDbBytes(remoteBytes);
          mergedBundles = mergeBundles(localSubset, remoteBundles);
        } catch {
          // No existing remote collection — upload local as-is
        }

        setStatus({ op: 'upload', step: t('blob.statusBuildingDb').replace('{n}', String(mergedBundles.length)), pct: 40 });
        const bytes = await jsonBundlesToSQLite(mergedBundles);
        setStatus({ op: 'upload', step: t('blob.statusUploading').replace('{size}', formatBytes(bytes.byteLength)), pct: 60 });
        await getActiveProvider().uploadCollectionDB(name, bytes, mergedBundles.length);
        setStatus({ op: 'upload', step: t('blob.statusRefreshing'), pct: 85 });
        await refreshRemote();
        setStatus({ op: 'upload', step: t('blob.statusUploadDone'), pct: 100 });
        toast.success(t('blob.uploaded'));
      } catch (e) {
        console.error('Upload failed:', e);
        toast.error(`Upload failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120));
      } finally {
        setBusy(null);
        setStatus(null);
      }
    },
    [refreshRemote, t],
  );

  const handleDownload = useCallback(
    async (name: string) => {
      setBusy(`download:${name}`);
      setStatus({ op: 'download', step: t('blob.statusDownloading'), pct: 15 });
      try {
        const bytes = await getActiveProvider().downloadCollectionDB(name);
        setStatus({ op: 'download', step: t('blob.statusParsing').replace('{size}', formatBytes(bytes.byteLength)), pct: 45 });
        const downloaded = await bundlesFromDbBytes(bytes);
        setStatus({ op: 'download', step: t('blob.statusImporting').replace('{n}', String(downloaded.length)), pct: 65 });
        const storage = getSQLiteStorage();
        const result = await storage.importBundles(downloaded);
        setStatus({ op: 'download', step: t('blob.statusReloading'), pct: 85 });
        await onReloadBundles();
        setStatus({
          op: 'download',
          step: t('blob.statusImportDone').replace('{added}', String(result.added)).replace('{updated}', String(result.updated)),
          pct: 100,
        });
        toast.success(t('blob.downloaded'));
      } catch (e) {
        console.error('Download failed:', e);
        toast.error(`Download failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120));
      } finally {
        setBusy(null);
        setStatus(null);
      }
    },
    [onReloadBundles, t],
  );

  const handleDelete = useCallback(
    async (name: string) => {
      if (!confirm(t('blob.confirmDelete'))) return;
      setBusy(`delete:${name}`);
      try {
        await getActiveProvider().deleteCollectionDB(name);
        await refreshRemote();
        toast.success(t('blob.deleted'));
      } catch (e) {
        toast.error(`Delete failed: ${String(e).slice(0, 80)}`);
      } finally {
        setBusy(null);
      }
    },
    [refreshRemote, t],
  );

  if (!open) return null;

  const local = localCollections(bundles);

  return (
    <div className="fixed right-4 top-20 z-50 w-[380px] max-h-[80vh] flex flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-background/60 shadow-2xl backdrop-blur-2xl backdrop-saturate-150">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Cloud className="size-4 text-primary" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold leading-tight">{t('blob.title')}</h3>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('blob.subtitle')}</p>
        </div>
        <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {t('blob.shiftBHint')}
        </span>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => onOpenChange(false)}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Status banner with progress bar (shown during upload/download) */}
      {status && (
        <div className="border-b border-border/60 bg-primary/5 px-4 py-2.5">
          <div className="mb-1 flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin text-primary" />
            <span className="flex-1 text-[11px] font-medium text-foreground">{status.step}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{status.pct}%</span>
          </div>
          <Progress value={status.pct} className="h-1" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Provider selector */}
        <div className="mb-3 flex gap-1 rounded-lg border border-border/60 bg-foreground/5 p-0.5">
          {(['edgeone', 'd1'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSwitchProvider(id)}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                providerId === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {id === 'edgeone' ? t('blob.providerEdgeone') : t('blob.providerD1')}
            </button>
          ))}
        </div>

        {/* Credentials */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="size-3" />
            {t('blob.credentials')}
          </div>

          {providerId === 'edgeone' ? (
            <div className="space-y-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">{t('blob.projectId')}</Label>
                <Input value={eoProjectId} onChange={(e) => setEoProjectId(e.target.value)} placeholder="pages-xxxxxxxx" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">{t('blob.apiToken')}</Label>
                <Input value={eoToken} onChange={(e) => setEoToken(e.target.value)} type="password" placeholder="c+KH5..." className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">{t('blob.storeName')}</Label>
                <Input value={eoStoreName} onChange={(e) => setEoStoreName(e.target.value)} placeholder="wikiki-db-sync" className="h-8 text-xs" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">{t('blob.cfAccountId')}</Label>
                <Input
                  value={cfAccountId}
                  onChange={(e) => setCfAccountId(e.target.value)}
                  placeholder="32-char hex, e.g. a1b2c3d4e5f6..."
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">{t('blob.cfApiToken')}</Label>
                <Input
                  value={cfApiToken}
                  onChange={(e) => setCfApiToken(e.target.value)}
                  type="password"
                  placeholder="D1 API token with edit permissions"
                  className="h-8 text-xs"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">{t('blob.d1Hint')}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-0.5">
            <Button size="sm" className="h-7 flex-1 text-xs" onClick={handleSaveCreds}>
              {t('action.save')}
            </Button>
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="size-3 animate-spin" /> : t('blob.testConnection')}
            </Button>
            {hasCreds && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleClearCreds}>
                {t('blob.clear')}
              </Button>
            )}
          </div>
          {hasCreds && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-500">
              <Check className="size-3" />
              {t('blob.connected')}
            </div>
          )}
        </div>

        {/* Local collections → upload */}
        <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('blob.localCollections')}
          </div>
          {local.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('blob.noLocal')}</p>
          ) : (
            <div className="space-y-1">
              {local.map((c) => (
                <div key={c.name} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-xs font-medium">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground">{c.bundleCount} {t('blob.bundles')}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 px-2 text-[10px]"
                    onClick={() => handleUpload(c.name)}
                    disabled={!hasCreds || busy === `upload:${c.name}`}
                  >
                    {busy === `upload:${c.name}` ? <Loader2 className="size-3 animate-spin" /> : <CloudUpload className="size-3" />}
                    {t('blob.upload')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remote collections → download / delete */}
        <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('blob.remoteCollections')}
            </div>
            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => refreshRemote()} disabled={!hasCreds || loadingRemote}>
              {loadingRemote ? <Loader2 className="size-3 animate-spin" /> : t('blob.refresh')}
            </Button>
          </div>
          {!hasCreds ? (
            <p className="text-xs text-muted-foreground">{t('blob.noCredentials')}</p>
          ) : remote.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('blob.noRemote')}</p>
          ) : (
            <div className="space-y-1">
              {remote.map((c) => (
                <div key={c.name} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-xs font-medium">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {c.bundleCount} {t('blob.bundles')} · {formatBytes(c.sizeBytes)} · {new Date(c.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 px-2 text-[10px]"
                    onClick={() => handleDownload(c.name)}
                    disabled={busy === `download:${c.name}`}
                  >
                    {busy === `download:${c.name}` ? <Loader2 className="size-3 animate-spin" /> : <CloudDownload className="size-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                    onClick={() => handleDelete(c.name)}
                    disabled={busy === `delete:${c.name}`}
                  >
                    {busy === `delete:${c.name}` ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
