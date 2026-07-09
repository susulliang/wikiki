import { useState, useMemo, useCallback, useRef, useEffect, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit-lite';
import {
  BookOpen,
  Plus,
  Search,
  Sun,
  Moon,
  Download,
  Upload,
  PanelLeftClose,
  PanelLeft,
  X,
  Database,
  FileJson,
  HardDrive,
  ArrowLeftRight,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import type { IProduct } from '@/data/products';
import { getTagColor, normalizeProduct } from '@/data/products';
import ProductDialog from '@/components/ProductDialog';
import { useStorageMode, type StorageMode } from '@/lib/storage-context';
import { type ThemeName, THEME_OPTIONS } from '@/hooks/useTheme';

const THEME_PALETTE: Record<ThemeName, string> = {
  'warm-light': 'linear-gradient(135deg, hsl(40 20% 97%) 0%, hsl(85 12% 48%) 100%)',
  'clean-light': 'linear-gradient(135deg, hsl(210 20% 98%) 0%, hsl(210 70% 48%) 100%)',
  'soft-light': 'linear-gradient(135deg, hsl(280 18% 97%) 0%, hsl(270 40% 58%) 100%)',
  'sunset': 'linear-gradient(135deg, hsl(30 40% 96%) 0%, hsl(20 65% 55%) 100%)',
  'forest': 'linear-gradient(135deg, hsl(80 15% 96%) 0%, hsl(140 25% 42%) 100%)',
  'dark': 'linear-gradient(135deg, hsl(220 15% 13%) 0%, hsl(38 75% 55%) 100%)',
  'midnight': 'linear-gradient(135deg, hsl(230 35% 9%) 0%, hsl(180 75% 45%) 100%)',
};

interface AppSidebarProps {
  products: IProduct[];
  selectedProductId: string | null;
  collapsed: boolean;
  theme: ThemeName;
  searchQuery: string;
  filterTags: string[];
  triggerAdd: boolean;
  triggerImportJSON: boolean;
  triggerImportDB: boolean;
  onSelectProduct: (id: string) => void;
  onAddProduct: (name: string, tags: string[]) => IProduct;
  onImportProductsJSON: (incoming: IProduct[]) => { added: number; updated: number };
  onExportProductsJSON: () => void;
  onToggleCollapse: () => void;
  onToggleTheme: () => void;
  onSetTheme: (theme: ThemeName) => void;
  onSearchChange: (query: string) => void;
  onOpenSuperSearch: () => void;
  onTagToggle: (tag: string) => void;
  onTriggerAddHandled: () => void;
  onTriggerImportJSONHandled: () => void;
  onTriggerImportDBHandled: () => void;
  onProductsChanged?: () => void;
  onHideSidebar?: () => void;
}

function parseImportFile(jsonText: string): IProduct[] | null {
  try {
    const data = JSON.parse(jsonText);
    if (!Array.isArray(data)) return null;
    return data.map((item: Record<string, unknown>) => normalizeProduct(item));
  } catch {
    return null;
  }
}

export default function AppSidebar({
  products,
  selectedProductId,
  collapsed,
  theme,
  searchQuery,
  filterTags,
  triggerAdd,
  triggerImportJSON,
  triggerImportDB,
  onSelectProduct,
  onAddProduct,
  onImportProductsJSON,
  onExportProductsJSON,
  onToggleCollapse,
  onToggleTheme,
  onSetTheme,
  onSearchChange,
  onOpenSuperSearch,
  onTagToggle,
  onTriggerAddHandled,
  onTriggerImportJSONHandled,
  onTriggerImportDBHandled,
  onProductsChanged,
  onHideSidebar,
}: AppSidebarProps) {
  const {
    mode: storageMode,
    sqliteInfo,
    sqliteReady,
    sqliteLoading,
    switchMode,
    importProducts: importProductsSQLite,
    exportProductsJSON: exportJSONFromContext,
    exportSQLiteDB,
    importSQLiteDB,
    reloadSQLiteProducts,
  } = useStorageMode();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [modeSwitchDialogOpen, setModeSwitchDialogOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<StorageMode>('json');
  const [modeSwitching, setModeSwitching] = useState(false);
  const [dbMenuOpen, setDbMenuOpen] = useState(false);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const dbFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (triggerAdd) {
      setAddDialogOpen(true);
      onTriggerAddHandled();
    }
  }, [triggerAdd, onTriggerAddHandled]);

  useEffect(() => {
    if (triggerImportJSON) {
      jsonFileInputRef.current?.click();
      onTriggerImportJSONHandled();
    }
  }, [triggerImportJSON, onTriggerImportJSONHandled]);

  useEffect(() => {
    if (triggerImportDB) {
      dbFileInputRef.current?.click();
      onTriggerImportDBHandled();
    }
  }, [triggerImportDB, onTriggerImportDBHandled]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (filterTags.length > 0) {
      result = result.filter((p) => filterTags.every((t) => p.tags.includes(t)));
    }
    return result;
  }, [products, searchQuery, filterTags]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    products.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [products]);

  const handleAddProduct = useCallback(
    (name: string, tags: string[]) => {
      const product = onAddProduct(name, tags);
      onSelectProduct(product.id);
      toast.success(`Product "${name}" created`);
    },
    [onAddProduct, onSelectProduct],
  );

  const processJSONFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.json')) {
        toast.error('Please select a JSON file');
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const parsed = parseImportFile(reader.result as string);
        if (!parsed) {
          toast.error('Invalid file format: JSON array expected');
          return;
        }
        if (parsed.length === 0) {
          toast.error('No product data found in file');
          return;
        }
        try {
          if (storageMode === 'sqlite') {
            const { added, updated } = await importProductsSQLite(parsed);
            const parts: string[] = [];
            if (added > 0) parts.push(`${added} added`);
            if (updated > 0) parts.push(`${updated} updated`);
            toast.success(`Import completed: ${parts.join(', ')}`);
            await reloadSQLiteProducts();
            onProductsChanged?.();
          } else {
            const { added, updated } = onImportProductsJSON(parsed);
            const parts: string[] = [];
            if (added > 0) parts.push(`${added} added`);
            if (updated > 0) parts.push(`${updated} updated`);
            toast.success(`Import completed: ${parts.join(', ')}`);
          }
        } catch (e) {
          logger.error('Import failed:', String(e));
          toast.error('Import failed');
        }
      };
      reader.onerror = () => toast.error('Failed to read file');
      reader.readAsText(file);
    },
    [storageMode, importProductsSQLite, onImportProductsJSON, reloadSQLiteProducts, onProductsChanged],
  );

  const processDBFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite') && !file.name.endsWith('.sqlite3')) {
        toast.error('Please select a .db / .sqlite / .sqlite3 file');
        return;
      }
      try {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        await importSQLiteDB(data);
        const info = sqliteInfo;
        toast.success(
          `SQLite DB imported: ${info?.productCount ?? 0} products, ${info?.pageCount ?? 0} pages`,
        );
        await reloadSQLiteProducts();
        onProductsChanged?.();
      } catch (e) {
        logger.error('DB import failed:', String(e));
        toast.error('Failed to import SQLite DB: Invalid or corrupted file');
      }
    },
    [importSQLiteDB, sqliteInfo, reloadSQLiteProducts, onProductsChanged],
  );

  const handleJSONImportClick = useCallback(() => {
    jsonFileInputRef.current?.click();
  }, []);

  const handleDBImportClick = useCallback(() => {
    dbFileInputRef.current?.click();
  }, []);

  const handleJSONFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processJSONFile(file);
      e.target.value = '';
    },
    [processJSONFile],
  );

  const handleDBFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processDBFile(file);
      e.target.value = '';
    },
    [processDBFile],
  );

  // 拖放处理
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const name = file.name.toLowerCase();
      if (name.endsWith('.json')) {
        processJSONFile(file);
      } else if (name.endsWith('.db') || name.endsWith('.sqlite') || name.endsWith('.sqlite3')) {
        processDBFile(file);
      } else {
        toast.error('Unsupported file format, please use .json or .db files');
      }
    },
    [processJSONFile, processDBFile],
  );

  const handleExportJSON = useCallback(async () => {
    if (storageMode === 'sqlite') {
      await exportJSONFromContext();
    } else {
      onExportProductsJSON();
    }
    toast.success('JSON file exported');
  }, [storageMode, exportJSONFromContext, onExportProductsJSON]);

  const handleExportDB = useCallback(async () => {
    try {
      if (storageMode !== 'sqlite') {
        toast.info('Converting to SQLite format...');
      }
      await exportSQLiteDB();
      toast.success('SQLite DB file exported');
    } catch (e) {
      logger.error('Export DB failed:', String(e));
      toast.error('Export failed');
    }
  }, [storageMode, exportSQLiteDB]);

  const handleModeSwitchClick = useCallback((newMode: StorageMode) => {
    setTargetMode(newMode);
    setModeSwitchDialogOpen(true);
  }, []);

  const handleModeSwitchConfirm = useCallback(
    async (migrate: boolean) => {
      setModeSwitching(true);
      try {
        await switchMode(targetMode, migrate);
        toast.success(
          migrate
            ? `Switched to ${targetMode === 'sqlite' ? 'SQLite' : 'JSON'} mode and migrated data`
            : `Switched to ${targetMode === 'sqlite' ? 'SQLite' : 'JSON'} mode`,
        );
        // 不刷新页面，由 useEffect 重新初始化
        if (targetMode === 'sqlite') {
          await reloadSQLiteProducts();
          onProductsChanged?.();
        }
        setModeSwitchDialogOpen(false);
      } catch (e) {
        logger.error('Mode switch failed:', String(e));
        toast.error(`Mode switch failed: ${String(e).slice(0, 60)}`);
      } finally {
        setModeSwitching(false);
      }
    },
    [targetMode, switchMode, reloadSQLiteProducts, onProductsChanged],
  );

  return (
    <>
      <aside
        className={`flex flex-col border-r bg-card transition-all duration-300 sticky top-0 h-screen self-start shrink-0 ${
          collapsed ? 'w-[56px]' : 'w-[260px]'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div
          className={`flex items-center border-b px-3 ${
            collapsed ? 'justify-center py-3' : 'justify-between py-3'
          }`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={onHideSidebar}
                className="flex size-7 shrink-0 items-center justify-center rounded-md transition-transform hover:scale-110 active:scale-95 overflow-hidden"
                title="Hide Sidebar"
              >
                <img src="/app-icon.svg" alt="Wikiki Logo" className="size-full object-cover" />
              </button>
              <span className="truncate text-sm font-semibold">Wikiki</span>
            </div>
          )}
          {collapsed && (
            <button
              onClick={onHideSidebar}
              className="flex size-7 items-center justify-center rounded-md transition-transform hover:scale-110 active:scale-95 overflow-hidden"
              title="Hide Sidebar"
            >
              <img src="/app-icon.svg" alt="Wikiki Logo" className="size-full object-cover" />
            </button>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onToggleCollapse}>
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>

        {!collapsed && (
          <div className="border-b px-2 py-2">
            <Collapsible open={dbMenuOpen} onOpenChange={setDbMenuOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent">
                  <Database className="size-3.5 shrink-0 text-primary" />
                  <span className="flex-1 text-left">Database</span>
                  <ChevronDown
                    className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
                      dbMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-2 space-y-2 px-1 pb-1">
                <button
                  onClick={() => handleModeSwitchClick(storageMode === 'json' ? 'sqlite' : 'json')}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent"
                  title="Click to switch storage mode"
                >
                  {storageMode === 'sqlite' ? (
                    <>
                      <HardDrive className="size-3.5 shrink-0 text-primary" />
                      <span className="flex-1 text-left">SQLite Mode</span>
                      {sqliteInfo && <span className="text-muted-foreground">{sqliteInfo.dbSizeFormatted}</span>}
                      <ArrowLeftRight className="size-3 shrink-0 text-muted-foreground" />
                    </>
                  ) : (
                    <>
                      <FileJson className="size-3.5 shrink-0 text-primary" />
                      <span className="flex-1 text-left">JSON Mode</span>
                      <ArrowLeftRight className="size-3 shrink-0 text-muted-foreground" />
                    </>
                  )}
                </button>

                {sqliteLoading && (
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Initializing SQLite...
                  </div>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-full gap-1.5 text-xs">
                      <Download className="size-3.5" />
                      Import DB
                      <ChevronDown className="ml-auto size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={handleJSONImportClick}>
                      <FileJson className="size-4" />
                      Import JSON File
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDBImportClick}>
                      <Database className="size-4" />
                      Import SQLite DB
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-full gap-1.5 text-xs" disabled={products.length === 0}>
                      <Upload className="size-3.5" />
                      Export DB
                      <ChevronDown className="ml-auto size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={handleExportJSON}>
                      <FileJson className="size-4" />
                      Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportDB}>
                      <Database className="size-4" />
                      Export as SQLite DB
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* 操作区 */}
        <div className={`flex items-center gap-1 border-b px-2 py-2 ${collapsed ? 'flex-col' : ''}`}>
          {collapsed ? (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCollapse} title="Expand Sidebar">
                <PanelLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleTheme} title="Switch Theme">
                {THEME_OPTIONS.find(t => t.value === theme)?.isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
              {/* 导入下拉菜单（折叠态） */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Import">
                    <Download className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-48">
                  <DropdownMenuItem onClick={handleJSONImportClick}>
                    <FileJson className="size-4" />
                    Import JSON File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDBImportClick}>
                    <Database className="size-4" />
                    Import SQLite DB
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* 导出下拉菜单（折叠态） */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Export" disabled={products.length === 0}>
                    <Upload className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-48">
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <FileJson className="size-4" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportDB}>
                    <Database className="size-4" />
                    Export as SQLite DB
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAddDialogOpen(true)} title="Add Product">
                <Plus className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSuperSearch} title="Super Search">
                <Search className="size-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="h-8 w-full gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              Add Product
            </Button>
          )}
        </div>

        {/* 主题选择器 */}
        {!collapsed && (
          <div className="border-b px-3 py-2.5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Theme</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => onSetTheme(t.value)}
                  title={t.label}
                  className={`relative h-6 w-6 rounded-full border-2 transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    theme === t.value ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{
                    background: THEME_PALETTE[t.value],
                  }}
                >
                  {theme === t.value && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="size-2 rounded-full bg-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 拖放提示遮罩 */}
        {isDragOver && !collapsed && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
            <div className="rounded-xl border-2 border-dashed border-primary bg-card/80 px-6 py-4 text-center">
              <Upload className="mx-auto mb-1 size-6 text-primary" />
              <p className="text-sm font-medium text-primary">Release to import</p>
              <p className="text-xs text-muted-foreground">Supports .json / .db files</p>
            </div>
          </div>
        )}

        {/* 搜索 */}
        {!collapsed && (
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search products..."
                className="h-8 pl-8 pr-7 text-xs"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="!absolute right-0.5 top-1/2 z-20 h-6 w-6 -translate-y-1/2"
                  onClick={() => onSearchChange('')}
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenSuperSearch}
              className="mt-2 flex h-8 w-full items-center justify-between rounded-md border border-dashed border-border/80 px-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/50 hover:text-foreground"
            >
              <span>Open Super Search</span>
              <span className="rounded-full border bg-background px-1.5 py-0.5 text-[10px]">Ctrl/Cmd K</span>
            </button>
          </div>
        )}

        {/* 标签 */}
        {!collapsed && allTags.length > 0 && (
          <div className="px-3 pt-3">
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => {
                const color = getTagColor(tag);
                const isActive = filterTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => onTagToggle(tag)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                      isActive
                        ? `${color.bg} ${color.text} ring-1 ring-primary`
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${color.dot}`} />
                    {tag}
                  </button>
                );
              })}
            </div>
            {filterTags.length > 0 && (
              <button
                onClick={() => filterTags.forEach((t) => onTagToggle(t))}
                className="mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!collapsed && <Separator className="mt-3" />}

        {/* 产品列表 */}
        <ScrollArea className="flex-1">
          <div className={`${collapsed ? 'px-1 py-2' : 'p-2'}`}>
            {collapsed
              ? filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => onSelectProduct(product.id)}
                    className={`mb-1 flex w-full items-center justify-center rounded-md p-2 transition-colors ${
                      product.id === selectedProductId
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                    title={product.name}
                  >
                    <BookOpen className="size-4" />
                  </button>
                ))
              : filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => onSelectProduct(product.id)}
                    className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      product.id === selectedProductId
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-foreground hover:bg-accent/50'
                    }`}
                  >
                    <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{product.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {product.pages.length}
                    </span>
                  </button>
                ))}
            {!collapsed && filteredProducts.length === 0 && (
              <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">
                {products.length === 0 ? 'No products yet, please import or create' : 'No results found'}
              </p>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* 隐藏的文件输入 */}
      <input
        ref={jsonFileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleJSONFileChange}
      />
      <input
        ref={dbFileInputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,application/x-sqlite3"
        className="hidden"
        onChange={handleDBFileChange}
      />

      {/* 添加产品对话框 */}
      <ProductDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSave={handleAddProduct}
        title="Create New Product"
      />

      {/* 模式切换对话框 */}
      <Dialog open={modeSwitchDialogOpen} onOpenChange={setModeSwitchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch Storage Mode</DialogTitle>
            <DialogDescription>
              Switching to {targetMode === 'sqlite' ? 'SQLite' : 'JSON'} mode
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              {targetMode === 'sqlite'
                ? 'SQLite mode uses the built-in browser database, supporting larger data volumes (hundreds of MB), suitable for Wikis with many images.'
                : 'JSON mode uses browser local storage, suitable for small Wikis, with data saved in JSON format for easy manual editing.'}
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="default"
                onClick={() => handleModeSwitchConfirm(true)}
                disabled={modeSwitching}
                className="w-full"
              >
                {modeSwitching ? <Loader2 className="size-4 animate-spin" /> : null}
                Migrate existing data and switch
              </Button>
              <Button
                variant="outline"
                onClick={() => handleModeSwitchConfirm(false)}
                disabled={modeSwitching}
                className="w-full"
              >
                Clear data and start fresh
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModeSwitchDialogOpen(false)} disabled={modeSwitching}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
