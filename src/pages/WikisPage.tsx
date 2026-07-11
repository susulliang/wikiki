import { BookOpen, ArrowRight } from 'lucide-react';
import type { IBundle, IPage } from '@/data/bundles';
import BundleDetail from '@/components/BundleDetail';
import { Button } from '@/components/ui/button';

interface WikisPageProps {
  bundle: IBundle | null;
  pageIndex: number;
  onPageChange: (index: number) => void;
  onUpdateBundle: (id: string, name: string, tags: string[]) => void | Promise<void>;
  onDeleteBundle: (id: string) => void | Promise<void>;
  onAddPage: (bundleId: string, name: string) => Promise<IPage | null>;
  onDeletePage: (bundleId: string, pageId: string) => void | Promise<void>;
  onUpdatePageContent: (bundleId: string, pageId: string, content: string) => void | Promise<void>;
  onReorderPages: (bundleId: string, pages: IPage[]) => void | Promise<void>;
  highlightQuery?: string;
  openMindmap?: number;
  onNoBundle: () => void;
}

export default function WikisPage({
  bundle,
  pageIndex,
  onPageChange,
  onUpdateBundle,
  onDeleteBundle,
  onAddPage,
  onDeletePage,
  onUpdatePageContent,
  onReorderPages,
  highlightQuery,
  openMindmap,
  onNoBundle,
}: WikisPageProps) {
  if (!bundle) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex size-20 items-center justify-center border-2 border-border bg-card">
          <BookOpen className="size-10 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-3xl font-bold uppercase tracking-tight text-foreground">
          Select a Bundle
        </h2>
        <p className="mb-8 mt-2 max-w-sm text-sm text-muted-foreground">
          Choose a bundle from the Bundles page to view and edit its wiki pages.
        </p>
        <Button onClick={onNoBundle} className="gap-2 uppercase tracking-wider">
          Go to Bundles
          <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <BundleDetail
      bundle={bundle}
      pageIndex={pageIndex}
      onPageChange={onPageChange}
      onUpdateBundle={onUpdateBundle}
      onDeleteBundle={onDeleteBundle}
      onAddPage={onAddPage}
      onDeletePage={onDeletePage}
      onUpdatePageContent={onUpdatePageContent}
      onReorderPages={onReorderPages}
      highlightQuery={highlightQuery}
      openMindmap={openMindmap}
    />
  );
}
