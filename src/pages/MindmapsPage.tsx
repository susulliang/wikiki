import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Network, Database, Upload, HardDrive, Plus } from 'lucide-react';
import type { IBundle } from '@/data/bundles';
import { useTheme, THEME_OPTIONS } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MindmapsPageProps {
  bundles: IBundle[];
  onSelectBundle: (id: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sqliteInfo: any;
  sqliteReady: boolean;
  onExportDB: () => void;
  onImportDB: () => void;
  onCreateBundle: () => void;
}

interface GroupItem {
  bundle: IBundle;
  label: string;
}
interface Group {
  root: string;
  items: GroupItem[];
}

/** Pleasing colorful palette for mindmap nodes.
 *  Each entry: rootFill (vibrant), childFill (lighter tint), textColor (on root). */
const NODE_PALETTE = [
  { root: 'hsl(210 65% 53%)', child: 'hsl(210 65% 70%)', text: '#ffffff' }, // Blue
  { root: 'hsl(140 52% 48%)', child: 'hsl(140 52% 68%)', text: '#ffffff' }, // Green
  { root: 'hsl(35 82% 52%)', child: 'hsl(35 82% 68%)', text: '#ffffff' },   // Orange
  { root: 'hsl(280 48% 58%)', child: 'hsl(280 48% 72%)', text: '#ffffff' }, // Purple
  { root: 'hsl(340 62% 56%)', child: 'hsl(340 62% 72%)', text: '#ffffff' }, // Rose
  { root: 'hsl(180 55% 43%)', child: 'hsl(180 55% 62%)', text: '#ffffff' }, // Teal
  { root: 'hsl(45 78% 50%)', child: 'hsl(45 78% 68%)', text: '#1a1a1a' },   // Amber
  { root: 'hsl(120 38% 43%)', child: 'hsl(120 38% 63%)', text: '#ffffff' }, // Forest
  { root: 'hsl(240 50% 60%)', child: 'hsl(240 50% 73%)', text: '#ffffff' }, // Indigo
  { root: 'hsl(15 68% 53%)', child: 'hsl(15 68% 70%)', text: '#ffffff' },   // Coral
];

function buildGroups(bundles: IBundle[]): Map<string, Group> {
  const groups = new Map<string, Group>();
  bundles.forEach((p) => {
    const parts = p.name.trim().split(/\s+/);
    const firstWord = parts[0] || p.name;
    const key = firstWord.toLowerCase();
    const remainder = parts.slice(1).join(' ').trim();
    if (!groups.has(key)) groups.set(key, { root: firstWord, items: [] });
    groups.get(key)!.items.push({ bundle: p, label: remainder || firstWord });
  });
  return groups;
}

export default function MindmapsPage({
  bundles,
  onSelectBundle,
  sqliteInfo,
  sqliteReady,
  onExportDB,
  onImportDB,
  onCreateBundle,
}: MindmapsPageProps) {
  const { theme: currentTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = useMemo(
    () => THEME_OPTIONS.find((t) => t.value === currentTheme)?.isDark ?? false,
    [currentTheme],
  );

  const totalPages = bundles.reduce((sum, p) => sum + p.pages.length, 0);
  const allTags = new Set<string>();
  bundles.forEach((p) => p.tags.forEach((t) => allTags.add(t)));

  const { option, nodeIdToBundleId } = useMemo(() => {
    const groups = buildGroups(bundles);
    const nodes: Record<string, unknown>[] = [];
    const links: Record<string, unknown>[] = [];
    const nodeIdToBundleId = new Map<string, string>();

    let colorIdx = 0;
    groups.forEach((group, key) => {
      const rootNodeId = `root-${key}`;
      const palette = NODE_PALETTE[colorIdx % NODE_PALETTE.length];
      colorIdx++;
      nodes.push({
        id: rootNodeId,
        name: group.root,
        symbolSize: 44,
        itemStyle: { color: palette.root, borderColor: palette.root },
        label: { show: true, color: palette.text, fontWeight: 'bold', fontSize: 13 },
        category: 0,
      });
      group.items.forEach((item) => {
        const nodeId = `node-${item.bundle.id}`;
        nodes.push({
          id: nodeId,
          name: item.label,
          symbolSize: 26,
          itemStyle: {
            color: palette.child,
            borderColor: palette.root,
            borderWidth: 2,
          },
          label: {
            show: true,
            color: isDark ? '#f5f5f5' : '#1a1a1a',
            fontSize: 11,
          },
          category: 1,
        });
        nodeIdToBundleId.set(nodeId, item.bundle.id);
        links.push({
          source: rootNodeId,
          target: nodeId,
          lineStyle: { color: palette.root, width: 1.5, curveness: 0.15, opacity: 0.6 },
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
            { name: 'Bundles' },
          ],
        },
      ],
    };
    return { option, nodeIdToBundleId };
  }, [bundles, isDark]);

  const onEvents = useMemo(
    () => ({
      click: (params: { data?: { id?: string } }) => {
        const bundleId = params.data?.id ? nodeIdToBundleId.get(params.data.id) : undefined;
        if (bundleId) onSelectBundle(bundleId);
      },
    }),
    [nodeIdToBundleId, onSelectBundle],
  );

  return (
    <div className="relative h-full overflow-hidden">
      {/* Mindmap or empty state — full canvas */}
      {bundles.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex size-20 items-center justify-center border-2 border-border bg-card">
            <Network className="size-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground">
            {t('empty.noBundles')}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {t('empty.noBundlesDesc')}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Button
              onClick={onImportDB}
              size="lg"
              className="h-12 gap-2.5 px-8 text-base"
            >
              <Database className="size-5" />
              {t('action.uploadSQLite')}
            </Button>
            <Button
              onClick={onCreateBundle}
              size="lg"
              variant="outline"
              className="h-12 gap-2.5 px-8 text-base"
            >
              <Plus className="size-5" />
              {t('action.createBundleLong')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0">
          <ReactECharts
            option={option}
            onEvents={onEvents}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
      )}

      {/* Floating status + toolbar panel — bottom-left corner, transparent */}
      <div className="pointer-events-auto absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-2xl border border-foreground/10 px-3 py-2 shadow-lg backdrop-blur-2xl backdrop-saturate-150">
        {/* DB status dot */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-2 rounded-full',
              sqliteReady ? 'bg-primary' : 'bg-muted-foreground animate-pulse',
            )}
          />
          <Database className="size-4 text-primary" />
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span title={`${bundles.length} bundles`}>{bundles.length} bundles</span>
          <span title={`${totalPages} pages`}>{totalPages} pages</span>
          <span title={`${allTags.size} tags`} className="hidden sm:inline">{allTags.size} tags</span>
          {sqliteInfo && (
            <span className="hidden md:inline" title={sqliteInfo.dbSizeFormatted}>
              {sqliteInfo.dbSizeFormatted}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Button
            onClick={onImportDB}
            variant="ghost"
            size="icon"
            className="size-7"
            title="Import SQLite"
          >
            <Upload className="size-3.5" />
          </Button>
          <Button
            onClick={onExportDB}
            variant="ghost"
            size="icon"
            className="size-7"
            title="Export SQLite"
          >
            <HardDrive className="size-3.5" />
          </Button>
          <Button
            onClick={onCreateBundle}
            variant="ghost"
            size="icon"
            className="size-7"
            title="Create bundle"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Hint text — top-left, non-interactive */}
      {bundles.length > 0 && (
        <div className="pointer-events-none absolute left-4 top-4 z-10 text-[10px] uppercase tracking-widest text-muted-foreground">
          Drag to move · Scroll to zoom · Click a node to open
        </div>
      )}
    </div>
  );
}
