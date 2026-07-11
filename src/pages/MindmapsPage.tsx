import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Network, Database, FileJson, Download, Upload, HardDrive } from 'lucide-react';
import type { IProduct } from '@/data/products';
import { useTheme, THEME_OPTIONS } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MindmapsPageProps {
  products: IProduct[];
  onSelectProduct: (id: string) => void;
  storageMode: 'json' | 'sqlite';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sqliteInfo: any;
  sqliteReady: boolean;
  onExportJSON: () => void;
  onExportDB: () => void;
  onImportJSON: () => void;
  onImportDB: () => void;
}

interface GroupItem {
  product: IProduct;
  label: string;
}
interface Group {
  root: string;
  items: GroupItem[];
}

const ROOT_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)',
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)',
];

function buildGroups(products: IProduct[]): Map<string, Group> {
  const groups = new Map<string, Group>();
  products.forEach((p) => {
    const parts = p.name.trim().split(/\s+/);
    const firstWord = parts[0] || p.name;
    const key = firstWord.toLowerCase();
    const remainder = parts.slice(1).join(' ').trim();
    if (!groups.has(key)) groups.set(key, { root: firstWord, items: [] });
    groups.get(key)!.items.push({ product: p, label: remainder || firstWord });
  });
  return groups;
}

export default function MindmapsPage({
  products,
  onSelectProduct,
  storageMode,
  sqliteInfo,
  sqliteReady,
  onExportJSON,
  onExportDB,
  onImportJSON,
  onImportDB,
}: MindmapsPageProps) {
  const { theme: currentTheme } = useTheme();
  const isDark = useMemo(
    () => THEME_OPTIONS.find((t) => t.value === currentTheme)?.isDark ?? false,
    [currentTheme],
  );

  const totalPages = products.reduce((sum, p) => sum + p.pages.length, 0);
  const allTags = new Set<string>();
  products.forEach((p) => p.tags.forEach((t) => allTags.add(t)));
  const sqliteActive = storageMode === 'sqlite';

  const { option, nodeIdToProductId } = useMemo(() => {
    const groups = buildGroups(products);
    const nodes: Record<string, unknown>[] = [];
    const links: Record<string, unknown>[] = [];
    const nodeIdToProductId = new Map<string, string>();

    let colorIdx = 0;
    groups.forEach((group, key) => {
      const rootNodeId = `root-${key}`;
      const rootColor = ROOT_COLORS[colorIdx % ROOT_COLORS.length];
      colorIdx++;
      nodes.push({
        id: rootNodeId,
        name: group.root,
        symbolSize: 44,
        itemStyle: { color: rootColor, borderColor: rootColor },
        label: { show: true, color: isDark ? '#0a0a0a' : '#ffffff', fontWeight: 'bold', fontSize: 13 },
        category: 0,
      });
      group.items.forEach((item) => {
        const nodeId = `node-${item.product.id}`;
        nodes.push({
          id: nodeId,
          name: item.label,
          symbolSize: 26,
          itemStyle: {
            color: isDark ? '#1a1a1a' : '#e4e4e7',
            borderColor: rootColor,
            borderWidth: 2,
          },
          label: {
            show: true,
            color: isDark ? '#e4e4e7' : '#1a1a1a',
            fontSize: 11,
          },
          category: 1,
        });
        nodeIdToProductId.set(nodeId, item.product.id);
        links.push({
          source: rootNodeId,
          target: nodeId,
          lineStyle: { color: rootColor, width: 1.5, curveness: 0.15, opacity: 0.6 },
        });
      });
    });

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'var(--popover)',
        borderColor: 'var(--border)',
        textStyle: { color: 'var(--popover-foreground)' },
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: nodes,
          links,
          roam: true,
          draggable: true,
          force: {
            repulsion: 240,
            edgeLength: [60, 120],
            gravity: 0.08,
            layoutAnimation: true,
          },
          label: { position: 'right' },
          emphasis: {
            focus: 'adjacency',
            lineStyle: { width: 3, opacity: 1 },
            label: { fontSize: 13, fontWeight: 'bold' },
          },
          categories: [
            { name: 'Groups' },
            { name: 'Products' },
          ],
        },
      ],
    };
    return { option, nodeIdToProductId };
  }, [products, isDark]);

  const onEvents = useMemo(
    () => ({
      click: (params: { data?: { id?: string } }) => {
        const productId = params.data?.id ? nodeIdToProductId.get(params.data.id) : undefined;
        if (productId) onSelectProduct(productId);
      },
    }),
    [nodeIdToProductId, onSelectProduct],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Minimal info bar */}
      <div className="flex items-center gap-3 border-b border-border bg-card/50 px-4 py-2 backdrop-blur-sm">
        {/* Storage mode indicator */}
        <div className="flex items-center gap-1.5">
          {sqliteActive ? (
            <Database className="size-3.5 text-primary" />
          ) : (
            <FileJson className="size-3.5 text-muted-foreground" />
          )}
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {sqliteActive ? 'SQLite' : 'JSON'}
          </span>
          {sqliteActive && (
            <span
              className={cn(
                'size-1.5 rounded-full',
                sqliteReady ? 'bg-primary' : 'bg-muted-foreground animate-pulse',
              )}
            />
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{products.length} products</span>
          <span>{totalPages} pages</span>
          <span>{allTags.size} tags</span>
          {sqliteInfo && (
            <span className="hidden sm:inline">{sqliteInfo.dbSizeFormatted}</span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Import / Export buttons */}
        <div className="flex items-center gap-1">
          <Button
            onClick={onImportJSON}
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 font-mono text-[10px] uppercase tracking-wider"
            title="Import JSON"
          >
            <Upload className="size-3" />
            <span className="hidden sm:inline">JSON</span>
          </Button>
          {sqliteActive && (
            <Button
              onClick={onImportDB}
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 font-mono text-[10px] uppercase tracking-wider"
              title="Import SQLite"
            >
              <Upload className="size-3" />
              <span className="hidden sm:inline">DB</span>
            </Button>
          )}
          <div className="mx-1 h-4 w-px bg-border" />
          <Button
            onClick={onExportJSON}
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 font-mono text-[10px] uppercase tracking-wider"
            title="Export JSON"
          >
            <Download className="size-3" />
            <span className="hidden sm:inline">JSON</span>
          </Button>
          {sqliteActive && (
            <Button
              onClick={onExportDB}
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 font-mono text-[10px] uppercase tracking-wider"
              title="Export SQLite"
            >
              <HardDrive className="size-3" />
              <span className="hidden sm:inline">DB</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mindmap or empty state */}
      {products.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex size-20 items-center justify-center border-2 border-border bg-card">
            <Network className="size-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground">
            No Products Yet
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Import a database or add products to see a visual grouping here.
          </p>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <div className="pointer-events-none absolute left-4 top-4 z-10 text-[10px] uppercase tracking-widest text-muted-foreground">
            Drag to move - Scroll to zoom - Click a node to open
          </div>
          <ReactECharts
            option={option}
            onEvents={onEvents}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
