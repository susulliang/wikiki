import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { X, Cloud, CloudUpload, CloudDownload, Trash2, KeyRound, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/useLanguage';
import {
  getBlobCreds,
  saveBlobCreds,
  clearBlobCreds,
  testConnection,
  listUploadedCollections,
  uploadCollectionDB,
  downloadCollectionDB,
  deleteCollectionDB,
  localCollections,
  type CollectionEntry,
} from '@/lib/edgeone-blob';
import { getSQLiteStorage, jsonBundlesToSQLite, bundlesFromDbBytes } from '@/lib/sqlite-storage';
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
  const [projectId, setProjectId] = useState('');
  const [token, setToken] = useState('');
  const [storeName, setStoreName] = useState('wikiki-db-sync');
  const [hasCreds, setHasCreds] = useState(false);
  const [testing, setTesting] = useState(false);
  const [remote, setRemote] = useState<CollectionEntry[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const creds = getBlobCreds();
    if (creds) {
      setProjectId(creds.projectId);
      setToken(creds.token);
      setStoreName(creds.storeName);
      setHasCreds(true);
      void refreshRemote();
    } else {
      setHasCreds(false);
      setRemote([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refreshRemote = useCallback(async () => {
    setLoadingRemote(true);
    try {
      const list = await listUploadedCollections();
      setRemote(list);
    } catch (e) {
      console.error('Failed to list remote collections:', String(e));
      setRemote([]);
    } finally {
      setLoadingRemote(false);
    }
  }, []);

  const handleSaveCreds = useCallback(() => {
    if (!projectId.trim() || !token.trim()) {
      toast.error('Project ID and API Token are required');
      return;
    }
    saveBlobCreds({ projectId: projectId.trim(), token: token.trim(), storeName: storeName.trim() || 'wikiki-db-sync' });
    setHasCreds(true);
    toast.success('Credentials saved');
    void refreshRemote();
  }, [projectId, token, storeName, refreshRemote]);

  const handleClearCreds = useCallback(() => {
    clearBlobCreds();
    setHasCreds(false);
    setRemote([]);
    setProjectId('');
    setToken('');
    setStoreName('wikiki-db-sync');
    toast.info('Credentials cleared');
  }, []);

  const handleTest = useCallback(async () => {
    if (!projectId.trim() || !token.trim()) {
      toast.error('Project ID and API Token are required');
      return;
    }
    saveBlobCreds({ projectId: projectId.trim(), token: token.trim(), storeName: storeName.trim() || 'wikiki-db-sync' });
    setHasCreds(true);
    setTesting(true);
    try {
      await testConnection();
      toast.success(t('blob.connectionOk'));
    } catch (e) {
      toast.error(`Connection failed: ${String(e).slice(0, 80)}`);
    } finally {
      setTesting(false);
    }
  }, [projectId, token, storeName, t]);

  const handleUpload = useCallback(
    async (name: string) => {
      setBusy(`upload:${name}`);
      try {
        const storage = getSQLiteStorage();
        const all = await storage.getAllBundles();
        const subset = all.filter((b) => (b.collection && b.collection.trim() ? b.collection.trim() : 'Default') === name);
        if (subset.length === 0) {
          toast.error('No bundles in this collection');
          return;
        }
        const bytes = await jsonBundlesToSQLite(subset);
        await uploadCollectionDB(name, bytes, subset.length);
        await refreshRemote();
        toast.success(t('blob.uploaded'));
      } catch (e) {
        toast.error(`Upload failed: ${String(e).slice(0, 80)}`);
      } finally {
        setBusy(null);
      }
    },
    [refreshRemote, t],
  );

  const handleDownload = useCallback(
    async (name: string) => {
      setBusy(`download:${name}`);
      try {
        const bytes = await downloadCollectionDB(name);
        const downloaded = await bundlesFromDbBytes(bytes);
        const storage = getSQLiteStorage();
        await storage.importBundles(downloaded);
        await onReloadBundles();
        toast.success(t('blob.downloaded'));
      } catch (e) {
        toast.error(`Download failed: ${String(e).slice(0, 80)}`);
      } finally {
        setBusy(null);
      }
    },
    [onReloadBundles, t],
  );

  const handleDelete = useCallback(
    async (name: string) => {
      if (!confirm(t('blob.confirmDelete'))) return;
      setBusy(`delete:${name}`);
      try {
        await deleteCollectionDB(name);
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

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Credentials */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="size-3" />
            {t('blob.credentials')}
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">{t('blob.projectId')}</Label>
              <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="pages-xxxxxxxx" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">{t('blob.apiToken')}</Label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="c+KH5..." className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">{t('blob.storeName')}</Label>
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="wikiki-db-sync" className="h-8 text-xs" />
            </div>
          </div>
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
            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={refreshRemote} disabled={!hasCreds || loadingRemote}>
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
