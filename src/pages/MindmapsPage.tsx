import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Network } from 'lucide-react';
import type { IProduct } from '@/data/products';
import { useTheme, THEME_OPTIONS } from '@/hooks/useTheme';

interface MindmapsPageProps {
  products: IProduct[];
  onSelectProduct: (id: string) => void;
}

interface GroupItem {
  product: IProduct;
  label: string;
}
interface Group {
  root: string;
  items: GroupItem[];
}

/** Color palette for root nodes. Uses CSS chart variables so it adapts to the
 *  active theme (greyscale in Graphite / Graphite Night, colorful elsewhere). */
const ROOT_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)',
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)',
];

/** Group products by the first word of their name (e.g. "Apple iPhone" → root "Apple"). */
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

export default function MindmapsPage({ products, onSelectProduct }: MindmapsPageProps) {
  const { theme: currentTheme } = useTheme();
  const isDark = useMemo(
    () => THEME_OPTIONS.find((t) => t.value === currentTheme)?.isDark ?? false,
    [currentTheme],
  );

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
        label: { show: true, color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
        category: 0,
      });
      group.items.forEach((item) => {
        const nodeId = `node-${item.product.id}`;
        nodes.push({
          id: nodeId,
          name: item.label,
          symbolSize: 26,
          itemStyle: {
            color: isDark ? '#3f3f46' : '#e4e4e7',
            borderColor: rootColor,
            borderWidth: 2,
          },
          label: {
            show: true,
            color: isDark ? '#e4e4e7' : '#27272a',
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
      tooltip: { trigger: 'item' },
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

  if (products.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex size-20 items-center justify-center border-2 border-border bg-card">
          <Network className="size-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground">
          No Products Yet
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Add products to see a visual grouping of your database here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute left-4 top-4 z-10 text-[10px] uppercase tracking-widest text-muted-foreground">
          Drag to move • Scroll to zoom • Click a node to open
        </div>
        <ReactECharts
          option={option}
          onEvents={onEvents}
          style={{ height: '100%', width: '100%' }}
          theme={isDark ? 'dark' : 'light'}
        />
      </div>
    </div>
  );
}
