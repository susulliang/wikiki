import { Database, FileJson, Download, Upload, HardDrive, FileText, Tag, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { IProduct } from '@/data/products';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DatabasePageProps {
  storageMode: 'json' | 'sqlite';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sqliteInfo: any;
  sqliteReady: boolean;
  onSwitchMode: (mode: 'json' | 'sqlite', migrate?: boolean) => Promise<void>;
  onExportJSON: () => void;
  onExportDB: () => void;
  onImportJSON: () => void;
  onImportDB: () => void;
  products: IProduct[];
}

export default function DatabasePage({
  storageMode,
  sqliteInfo,
  sqliteReady,
  onSwitchMode,
  onExportJSON,
  onExportDB,
  onImportJSON,
  onImportDB,
  products,
}: DatabasePageProps) {
  const totalPages = products.reduce((sum, p) => sum + p.pages.length, 0);
  const allTags = new Set<string>();
  products.forEach((p) => p.tags.forEach((t) => allTags.add(t)));

  const stats: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: 'Products', value: products.length, icon: Database },
    { label: 'Pages', value: totalPages, icon: FileText },
    { label: 'Tags', value: allTags.size, icon: Tag },
  ];

  const sqliteActive = storageMode === 'sqlite';

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <header className="mb-8 border-b-2 border-border pb-6">
          <h1 className="text-4xl font-bold uppercase tracking-tight text-foreground">
            Database
          </h1>
          <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
            Storage mode &amp; data management
          </p>
        </header>

        {/* Stats */}
        <section className="mb-8 grid grid-cols-3 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="border-2 border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </span>
                  <Icon className="size-4 text-primary" />
                </div>
                <p className="mt-2 text-3xl font-bold text-foreground">{s.value}</p>
              </div>
            );
          })}
        </section>

        {/* Primary: SQLite storage */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Primary Storage
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div
            className={cn(
              'relative overflow-hidden border-2 bg-card p-6 transition-all',
              sqliteActive ? 'border-primary' : 'border-border',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center border-2',
                    sqliteActive ? 'border-primary bg-primary/10' : 'border-border bg-background',
                  )}
                >
                  <Database className={cn('size-6', sqliteActive ? 'text-primary' : 'text-muted-foreground')} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">
                      SQLite Database
                    </h2>
                    {sqliteActive && (
                      <span className="inline-flex items-center gap-1 border-2 border-primary bg-primary px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                        <Check className="size-3" /> Active
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    In-browser SQL database via WASM. Structured queries, larger datasets, the
                    recommended engine for Wikiki.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>STATUS: {sqliteReady ? 'READY' : sqliteInfo ? 'INITIALIZING' : 'OFFLINE'}</span>
                    {sqliteInfo && (
                      <>
                        <span>SIZE: {sqliteInfo.dbSizeFormatted}</span>
                        <span>
                          RECORDS: {sqliteInfo.productCount} products / {sqliteInfo.pageCount} pages
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {!sqliteActive && (
                <Button
                  onClick={() => onSwitchMode('sqlite', true)}
                  className="shrink-0 gap-2 uppercase tracking-wider"
                >
                  Activate SQLite
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Secondary: JSON backup option */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Backup / Portable
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div
            className={cn(
              'flex items-center justify-between gap-4 border bg-card p-4 transition-all',
              !sqliteActive ? 'border-primary' : 'border-border',
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-9 items-center justify-center border',
                  !sqliteActive ? 'border-primary bg-primary/10' : 'border-border bg-background',
                )}
              >
                <FileJson className={cn('size-4', !sqliteActive ? 'text-primary' : 'text-muted-foreground')} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
                    JSON Storage
                  </h3>
                  {!sqliteActive && (
                    <span className="border border-primary bg-primary/10 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Browser localStorage. Lightweight fallback &amp; portable backup format.
                </p>
              </div>
            </div>
            {!sqliteActive ? (
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Current mode</span>
            ) : (
              <Button
                onClick={() => onSwitchMode('json', true)}
                variant="outline"
                size="sm"
                className="shrink-0 gap-2 border-2 uppercase tracking-wider"
              >
                Switch to JSON
              </Button>
            )}
          </div>
        </section>

        {/* Import & Export */}
        <section className="border-2 border-border bg-card p-6">
          <h2 className="mb-4 text-xl font-bold uppercase tracking-wide text-foreground">
            Import &amp; Export
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button onClick={onExportJSON} variant="outline" className="gap-2 border-2 uppercase tracking-wider">
              <Download className="size-4" />
              Export JSON
            </Button>
            <Button onClick={onExportDB} variant="outline" className="gap-2 border-2 uppercase tracking-wider">
              <HardDrive className="size-4" />
              Export SQLite
            </Button>
            <Button onClick={onImportJSON} variant="outline" className="gap-2 border-2 uppercase tracking-wider">
              <Upload className="size-4" />
              Import JSON
            </Button>
            <Button onClick={onImportDB} variant="outline" className="gap-2 border-2 uppercase tracking-wider">
              <Upload className="size-4" />
              Import SQLite
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
