import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Pencil,
  GripVertical,
  PanelTopClose,
  PanelTopOpen,
} from 'lucide-react';
import type { IProduct, IPage } from '@/data/products';
import { getTagColor } from '@/data/products';
import RichTextEditor from '@/components/RichTextEditor';
import ProductDialog from '@/components/ProductDialog';
import PageDialog from '@/components/PageDialog';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ProductDetailProps {
  product: IProduct;
  pageIndex: number;
  onPageChange: (index: number) => void;
  onUpdateProduct: (id: string, name: string, tags: string[]) => void | Promise<void>;
  onDeleteProduct: (id: string) => void | Promise<void>;
  onAddPage: (productId: string, name: string) => IPage | null | Promise<IPage | null>;
  onDeletePage: (productId: string, pageId: string) => void | Promise<void>;
  onUpdatePageContent: (productId: string, pageId: string, content: string) => void | Promise<void>;
  onReorderPages: (productId: string, pages: IPage[]) => void | Promise<void>;
}

export default function ProductDetail({
  product,
  pageIndex,
  onPageChange,
  onUpdateProduct,
  onDeleteProduct,
  onAddPage,
  onDeletePage,
  onUpdatePageContent,
  onReorderPages,
}: ProductDetailProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addPageDialogOpen, setAddPageDialogOpen] = useState(false);
  const [deleteProductDialogOpen, setDeleteProductDialogOpen] = useState(false);
  const [deletePageDialogOpen, setDeletePageDialogOpen] = useState(false);
  const [deletePageId, setDeletePageId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showToolbar, setShowToolbar] = useState(true);

  const currentPage = product.pages[pageIndex] ?? product.pages[0];

  const handleSaveProduct = useCallback(
    async (name: string, tags: string[]) => {
      await onUpdateProduct(product.id, name, tags);
      toast.success('产品信息已更新');
    },
    [product.id, onUpdateProduct],
  );

  const handleAddPage = useCallback(
    async (name: string) => {
      const newPage = await onAddPage(product.id, name);
      if (newPage) {
        const idx = product.pages.length;
        onPageChange(idx);
        toast.success(`页面 "${name}" 已创建`);
      }
    },
    [product.id, product.pages.length, onAddPage, onPageChange],
  );

  const handleDeletePageConfirm = useCallback(async () => {
    if (deletePageId) {
      await onDeletePage(product.id, deletePageId);
      if (pageIndex >= product.pages.length - 1) {
        onPageChange(Math.max(0, product.pages.length - 2));
      }
      toast.success('页面已删除');
    }
    setDeletePageDialogOpen(false);
    setDeletePageId(null);
  }, [deletePageId, product.id, product.pages.length, pageIndex, onDeletePage, onPageChange]);

  const handleDeleteProduct = useCallback(async () => {
    await onDeleteProduct(product.id);
    toast.success('产品已删除');
    setDeleteProductDialogOpen(false);
  }, [product.id, onDeleteProduct]);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...product.pages];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onReorderPages(product.id, reordered);
    setDragIdx(idx);
    if (pageIndex === dragIdx) {
      onPageChange(idx);
    } else if (pageIndex === idx) {
      onPageChange(dragIdx < idx ? pageIndex - 1 : pageIndex + 1);
    }
  }, [dragIdx, product.id, product.pages, pageIndex, onReorderPages, onPageChange]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
  }, []);

  return (
    <div className="flex flex-col">
      {/* Product Header - sticky, blurred transparent */}
      <div className="sticky top-0 z-30 isolate border-b border-border/70 px-6 py-2.5 flex flex-col gap-2 shrink-0 bg-background/45 backdrop-blur-xl supports-[backdrop-filter]:bg-background/35">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <h1 className="truncate text-xl font-bold tracking-tight">{product.name}</h1>
            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {product.tags.map((tag) => {
                  const color = getTagColor(tag);
                  return (
                    <Badge key={tag} variant="outline" className={`gap-1 ${color.bg} ${color.text} border-transparent`}>
                      <span className={`size-1.5 rounded-full ${color.dot}`} />
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowToolbar(!showToolbar)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={showToolbar ? '隐藏工具栏' : '显示工具栏'}
            >
              {showToolbar ? <PanelTopClose className="size-4" /> : <PanelTopOpen className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditDialogOpen(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="编辑">
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteProductDialogOpen(true)}
              className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="删除"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Page Tabs */}
        <div className="flex items-center gap-1 -ml-1">
          <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
            {product.pages.map((page, idx) => (
              <div
                key={page.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`group flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${
                  idx === pageIndex
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                } ${dragIdx === idx ? 'opacity-50' : ''}`}
                onClick={() => onPageChange(idx)}
              >
                <GripVertical className="size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                <span className="truncate max-w-[120px]">{page.title}</span>
                {product.pages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePageId(page.id);
                      setDeletePageDialogOpen(true);
                    }}
                    className="ml-0.5 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                    title="删除页面"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAddPageDialogOpen(true)}
            className="shrink-0 h-6 w-6 text-muted-foreground hover:text-foreground"
            title="添加页面"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="relative flex flex-col" id="wiki-editor-container">
        <div className="flex flex-col">
          <RichTextEditor
            key={currentPage.id}
            content={currentPage?.content ?? ''}
            onChange={(html) => onUpdatePageContent(product.id, currentPage.id, html)}
            showToolbar={showToolbar}
          />
        </div>
      </div>

      {/* Dialogs */}
      <ProductDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        initialName={product.name}
        initialTags={product.tags}
        onSave={handleSaveProduct}
        title="编辑产品信息"
      />

      <PageDialog
        open={addPageDialogOpen}
        onOpenChange={setAddPageDialogOpen}
        onSave={handleAddPage}
      />

      <ConfirmDialog
        open={deleteProductDialogOpen}
        onOpenChange={setDeleteProductDialogOpen}
        title="删除产品"
        description={`确定要删除「${product.name}」吗？该产品下的所有页面数据将被永久删除，此操作不可撤销。`}
        confirmLabel="删除"
        variant="destructive"
        onConfirm={handleDeleteProduct}
      />

      <ConfirmDialog
        open={deletePageDialogOpen}
        onOpenChange={setDeletePageDialogOpen}
        title="删除页面"
        description="确定要删除该页面吗？页面内容将被永久删除。"
        confirmLabel="删除"
        variant="destructive"
        onConfirm={handleDeletePageConfirm}
      />
    </div>
  );
}
