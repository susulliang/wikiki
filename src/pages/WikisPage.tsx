import { BookOpen, ArrowRight } from 'lucide-react';
import type { IProduct, IPage } from '@/data/products';
import ProductDetail from '@/components/ProductDetail';
import { Button } from '@/components/ui/button';

interface WikisPageProps {
  product: IProduct | null;
  pageIndex: number;
  onPageChange: (index: number) => void;
  onUpdateProduct: (id: string, name: string, tags: string[]) => void | Promise<void>;
  onDeleteProduct: (id: string) => void | Promise<void>;
  onAddPage: (productId: string, name: string) => Promise<IPage | null>;
  onDeletePage: (productId: string, pageId: string) => void | Promise<void>;
  onUpdatePageContent: (productId: string, pageId: string, content: string) => void | Promise<void>;
  onReorderPages: (productId: string, pages: IPage[]) => void | Promise<void>;
  highlightQuery?: string;
  openMindmap?: number;
  onNoProduct: () => void;
}

export default function WikisPage({
  product,
  pageIndex,
  onPageChange,
  onUpdateProduct,
  onDeleteProduct,
  onAddPage,
  onDeletePage,
  onUpdatePageContent,
  onReorderPages,
  highlightQuery,
  openMindmap,
  onNoProduct,
}: WikisPageProps) {
  if (!product) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex size-20 items-center justify-center border-2 border-border bg-card">
          <BookOpen className="size-10 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-3xl font-bold uppercase tracking-tight text-foreground">
          Select a Product
        </h2>
        <p className="mb-8 mt-2 max-w-sm text-sm text-muted-foreground">
          Choose a product from the Products page to view and edit its wiki pages.
        </p>
        <Button onClick={onNoProduct} className="gap-2 uppercase tracking-wider">
          Go to Products
          <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <ProductDetail
      product={product}
      pageIndex={pageIndex}
      onPageChange={onPageChange}
      onUpdateProduct={onUpdateProduct}
      onDeleteProduct={onDeleteProduct}
      onAddPage={onAddPage}
      onDeletePage={onDeletePage}
      onUpdatePageContent={onUpdatePageContent}
      onReorderPages={onReorderPages}
      highlightQuery={highlightQuery}
      openMindmap={openMindmap}
    />
  );
}
