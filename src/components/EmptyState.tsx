import { BookOpen, Plus, FileJson, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onCreateProduct: () => void;
  onImportJSON: () => void;
  onImportDB?: () => void;
}

export default function EmptyState({ onCreateProduct, onImportJSON, onImportDB }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary/10">
        <BookOpen className="size-10 text-primary" />
      </div>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Wikiki</h1>
      <p className="mb-8 max-w-md text-base text-muted-foreground">
        Your personal wiki knowledge base
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button onClick={onImportJSON} size="lg" className="gap-2 min-w-[220px]">
          <FileJson className="size-4" />
          Import JSON File
        </Button>
        {onImportDB && (
          <Button onClick={onImportDB} variant="secondary" size="lg" className="gap-2 min-w-[220px]">
            <Database className="size-4" />
            Import SQLite DB
          </Button>
        )}
        <Button onClick={onCreateProduct} variant="outline" size="lg" className="gap-2 min-w-[220px]">
          <Plus className="size-4" />
          Create New Product
        </Button>
      </div>
      <p className="mt-6 max-w-sm text-xs text-muted-foreground">
        Import an existing Wikiki JSON or SQLite database file, or create a new product to start building your knowledge base.
      </p>
    </div>
  );
}
