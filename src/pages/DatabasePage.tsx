import { Database, FileJson, Download, Upload, HardDrive, FileText, Tag } from 'lucide-react';
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

interface StorageCardProps {
  title: string;
  description: string;
  isActive: boolean;
  icon: LucideIcon;
  details: React.ReactNode;
  onActivate: () => void;
}

function StorageCard({ title, description, isActive, icon: Icon, details, onActivate }: StorageCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col bg-card p-6 transition-all',
        isActive ? 'border-2 border-primary' : 'border border-border',
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-10 items-center justify-center border-2',
              isActive ? 'border-primary bg-primary/10' : 'border-border bg-background',
            )}
          >
            <Icon className={cn('size-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
          </span>
          <h3 className="font-serif text-xl font-bold uppercase tracking-wide text-foreground">
            {title}
          </h3>
        </div>
        <span
          className={cn(
            'border-2 px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider',
            isActive
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground',
          )}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{description}</p>

      <div className="mb-5 border-l-2 border-border pl-3">{details}</div>

      <Button
        onClick={onActivate}
        variant={isActive ? 'outline' : 'default'}
        disabled={isActive}
        className={cn(
          'mt-auto w-full gap-2 uppercase tracking-wider',
          isActive ? 'border-2' : '',
        )}
      >
        {isActive ? 'Current Mode' : 'Switch to ' + title}
      </Button>
    </div>
  );
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <header className="mb-8 border-b-2 border-border pb-6">
          <h1 className="font-serif text-4xl font-bold uppercase tracking-tight text-foreground">
            Database
          </h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Storage mode &amp; data management
          </p>
        </header>

        <section className="mb-8 grid grid-cols-3 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="border-2 border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </span>
                  <Icon className="size-4 text-primary" />
                </div>
                <p className="mt-2 font-serif text-3xl font-bold text-foreground">{s.value}</p>
              </div>
            );
          })}
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <StorageCard
            title="JSON Storage"
            description="Browser localStorage. Lightweight, portable, no setup required."
            isActive={storageMode === 'json'}
            icon={FileJson}
            onActivate={() => onSwitchMode('json', true)}
            details={
              <div className="space-y-1 font-mono text-xs text-muted-foreground">
                <div>KEY: __wikiki_products</div>
                <div>FORMAT: JSON serialized</div>
              </div>
            }
          />
          <StorageCard
            title="SQLite Storage"
            description="In-browser SQL database via WASM. Structured queries, larger datasets."
            isActive={storageMode === 'sqlite'}
            icon={Database}
            onActivate={() => onSwitchMode('sqlite', true)}
            details={
              <div className="space-y-1 font-mono text-xs text-muted-foreground">
                <div>STATUS: {sqliteReady ? 'READY' : sqliteInfo ? 'INITIALIZING' : 'OFFLINE'}</div>
                {sqliteInfo && (
                  <>
                    <div>SIZE: {sqliteInfo.dbSizeFormatted}</div>
                    <div>
                      RECORDS: {sqliteInfo.productCount} products / {sqliteInfo.pageCount} pages
                    </div>
                  </>
                )}
              </div>
            }
          />
        </section>

        <section className="border-2 border-border bg-card p-6">
          <h2 className="mb-4 font-serif text-xl font-bold uppercase tracking-wide text-foreground">
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
