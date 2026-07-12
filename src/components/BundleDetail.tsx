import { useState, useCallback, useLayoutEffect, useMemo } from 'react';
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
  Network,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { IBundle, IPage } from '@/data/bundles';
import { getTagColor } from '@/data/bundles';
import RichTextEditor from '@/components/RichTextEditor';
import MindmapView from '@/components/MindmapView';
import BundleDialog from '@/components/BundleDialog';
import PageDialog from '@/components/PageDialog';
import ConfirmDialog from '@/components/ConfirmDialog';

interface BundleDetailProps {
  bundle: IBundle;
  pageIndex: number;
  onPageChange: (index: number) => void;
  onUpdateBundle: (id: string, name: string, tags: string[], authors: string[], collection: string) => void | Promise<void>;
  onDeleteBundle: (id: string) => void | Promise<void>;
  onAddPage: (bundleId: string, name: string) => IPage | null | Promise<IPage | null>;
  onDeletePage: (bundleId: string, pageId: string) => void | Promise<void>;
  onUpdatePageContent: (bundleId: string, pageId: string, content: string) => void | Promise<void>;
  onReorderPages: (bundleId: string, pages: IPage[]) => void | Promise<void>;
  highlightQuery?: string;
  /** Mindmap trigger - non-zero value triggers mindmap view (timestamp for uniqueness) */
  openMindmap?: number;
}

export default function BundleDetail({
  bundle,
  pageIndex,
  onPageChange,
  onUpdateBundle,
  onDeleteBundle,
  onAddPage,
  onDeletePage,
  onUpdatePageContent,
  onReorderPages,
  highlightQuery = '',
  openMindmap = 0,
}: BundleDetailProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addPageDialogOpen, setAddPageDialogOpen] = useState(false);
  const [deleteBundleDialogOpen, setDeleteBundleDialogOpen] = useState(false);
  const [deletePageDialogOpen, setDeletePageDialogOpen] = useState(false);
  const [deletePageId, setDeletePageId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showMindmap, setShowMindmap] = useState(false);

  const currentPage = bundle.pages[pageIndex] ?? bundle.pages[0];
  
  // Detect mindmap content in a page (must match search.tsx detection logic)
  const hasMindmapContent = (content: string): boolean => {
    return content.includes('<div') && (
      content.includes('mindmap') || 
      content.includes('data-mindmap') ||
      content.includes('Mermaid')
    );
  };
  
  // Find the mindmap page: prefer the current page if it has mindmap content,
  // otherwise look for a page titled "mindmap" or with mindmap content
  const mindmapPage = useMemo(() => {
    if (currentPage && hasMindmapContent(currentPage.content)) {
      return currentPage;
    }
    return bundle.pages.find((p) => 
      p.title.toLowerCase() === 'mindmap' || hasMindmapContent(p.content)
    );
  }, [bundle.pages, currentPage]);

  // Auto-open mindmap view when triggered (timestamp ensures effect re-runs each click)
  useLayoutEffect(() => {
    if (openMindmap > 0 && mindmapPage) {
      setShowMindmap(true);
    }
  }, [openMindmap, mindmapPage]);

  const handleSaveBundle = useCallback(
    async (name: string, tags: string[], authors: string[], collection: string) => {
      await onUpdateBundle(bundle.id, name, tags, authors, collection);
      toast.success('Bundle updated');
    },
    [bundle.id, onUpdateBundle],
  );

  const handleAddPage = useCallback(
    async (name: string) => {
      const newPage = await onAddPage(bundle.id, name);
      if (newPage) {
        const idx = bundle.pages.length;
        onPageChange(idx);
        toast.success(`Page "${name}" created`);
      }
    },
    [bundle.id, bundle.pages.length, onAddPage, onPageChange],
  );

  const handleDeletePageConfirm = useCallback(async () => {
    if (deletePageId) {
      await onDeletePage(bundle.id, deletePageId);
      if (pageIndex >= bundle.pages.length - 1) {
        onPageChange(Math.max(0, bundle.pages.length - 2));
      }
      toast.success('Page deleted');
    }
    setDeletePageDialogOpen(false);
    setDeletePageId(null);
  }, [deletePageId, bundle.id, bundle.pages.length, pageIndex, onDeletePage, onPageChange]);

  const handleDeleteBundle = useCallback(async () => {
    await onDeleteBundle(bundle.id);
    toast.success('Bundle deleted');
    setDeleteBundleDialogOpen(false);
  }, [bundle.id, onDeleteBundle]);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...bundle.pages];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onReorderPages(bundle.id, reordered);
    setDragIdx(idx);
    if (pageIndex === dragIdx) {
      onPageChange(idx);
    } else if (pageIndex === idx) {
      onPageChange(dragIdx < idx ? pageIndex - 1 : pageIndex + 1);
    }
  }, [dragIdx, bundle.id, bundle.pages, pageIndex, onReorderPages, onPageChange]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
  }, []);

  return (
    <div className="flex-1 overflow-auto min-h-0 relative" id="bundle-detail-container">
      {/* Bundle Header - sticky, fully transparent so global bg shows */}
      <div
        className="sticky top-0 z-30 px-6 py-2.5 flex flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{bundle.name}</h1>
            {bundle.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {bundle.tags.map((tag) => {
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
            {mindmapPage && (
              <Button
                variant={showMindmap ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setShowMindmap(!showMindmap)}
                className={`h-8 w-8 ${showMindmap ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                title="Toggle Mindmap"
              >
                <Network className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowToolbar(!showToolbar)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={showToolbar ? 'Hide Toolbar' : 'Show Toolbar'}
            >
              {showToolbar ? <PanelTopClose className="size-4" /> : <PanelTopOpen className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditDialogOpen(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Edit">
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteBundleDialogOpen(true)}
              className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Page Tabs */}
        <div className="flex items-center gap-1 -ml-1">
          <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
            {bundle.pages.map((page, idx) => (
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
                {bundle.pages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePageId(page.id);
                      setDeletePageDialogOpen(true);
                    }}
                    className="ml-0.5 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                    title="Delete Page"
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
            title="Add Page"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-col min-h-max">
        <RichTextEditor
          key={currentPage.id}
          content={currentPage?.content ?? ''}
          onChange={(html) => onUpdatePageContent(bundle.id, currentPage.id, html)}
          showToolbar={showToolbar}
          highlightQuery={highlightQuery}
        />
      </div>

      {/* Mindmap Fullscreen Overlay */}
      {showMindmap && mindmapPage && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <Network className="size-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">{bundle.name} - Mindmap</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowMindmap(false)}>
              <Minimize2 className="size-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <MindmapView content={mindmapPage.content} />
          </div>
        </div>
      )}

      {/* Dialogs */}
      <BundleDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        initialName={bundle.name}
        initialTags={bundle.tags}
        initialAuthors={bundle.authors}
        initialCollection={bundle.collection}
        onSave={handleSaveBundle}
        title="Edit Bundle Info"
      />

      <PageDialog
        open={addPageDialogOpen}
        onOpenChange={setAddPageDialogOpen}
        onSave={handleAddPage}
      />

      <ConfirmDialog
        open={deleteBundleDialogOpen}
        onOpenChange={setDeleteBundleDialogOpen}
        title="Delete Bundle"
        description={`Are you sure you want to delete "${bundle.name}"? All page data under this bundle will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteBundle}
      />

      <ConfirmDialog
        open={deletePageDialogOpen}
        onOpenChange={setDeletePageDialogOpen}
        title="Delete Page"
        description="Are you sure you want to delete this page? Page content will be permanently deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeletePageConfirm}
      />
    </div>
  );
}
