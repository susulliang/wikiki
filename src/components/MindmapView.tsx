import ReactECharts from 'echarts-for-react';
import { useEffect, useMemo, useState } from 'react';
import { useTheme, THEME_OPTIONS } from '@/hooks/useTheme';

interface MindmapViewProps {
  content: string;
}

interface MindmapNode {
  name: string;
  children?: MindmapNode[];
  itemStyle?: any;
  label?: any;
  lineStyle?: any;
}

interface NodeColor {
  bg: string;
  text: string;
  border: string;
}

/** Curated palette for light themes — muted, harmonious, editorial tones
 *  that complement the Warm Editorial Minimal design system. */
const COLORS_LIGHT: NodeColor[] = [
  { bg: '#7a9e7e', text: '#ffffff', border: '#5e8262' }, // sage
  { bg: '#c9867a', text: '#ffffff', border: '#a86b60' }, // terracotta
  { bg: '#d4a85a', text: '#3d2e0a', border: '#b88a3e' }, // mustard
  { bg: '#8e7a98', text: '#ffffff', border: '#735c80' }, // plum
  { bg: '#6ba3a8', text: '#ffffff', border: '#52858a' }, // teal
  { bg: '#c89aa8', text: '#3d1a28', border: '#a87a88' }, // rose
  { bg: '#7a8ba0', text: '#ffffff', border: '#5e6f85' }, // slate
  { bg: '#a8a06a', text: '#2d2810', border: '#888050' }, // olive
];

/** Curated palette for dark themes — muted with subtle warm/cool tints
 *  that maintain readability on dark backgrounds without clashing. */
const COLORS_DARK: NodeColor[] = [
  { bg: '#6b7a6e', text: '#f0f5f0', border: '#8a9a8e' }, // sage
  { bg: '#9a6b62', text: '#f5ece8', border: '#b88a7e' }, // terracotta
  { bg: '#8a7240', text: '#f5eed8', border: '#aa9258' }, // mustard
  { bg: '#6b5e78', text: '#ece8f0', border: '#8a7e98' }, // plum
  { bg: '#557074', text: '#e8f0f0', border: '#728a8e' }, // teal
  { bg: '#8a6874', text: '#f5e8ec', border: '#a88494' }, // rose
  { bg: '#5e6e82', text: '#e8ecf0', border: '#7a8aa0' }, // slate
  { bg: '#6e6850', text: '#f0ece0', border: '#8a8470' }, // olive
];

/** Mix a hex color toward a target (white for light themes, dark for dark themes).
 *  Used to create progressively lighter tints for deeper-level nodes. */
function tint(hex: string, factor: number, isDark: boolean): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const target = isDark ? 35 : 255;
  const f = Math.min(0.5, factor);
  const nr = Math.round(r + (target - r) * f);
  const ng = Math.round(g + (target - g) * f);
  const nb = Math.round(b + (target - b) * f);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/** Prune a subtree: keep only branches that contain the keyword.
 *  Returns null if neither the node nor any descendant matches.
 *  Once a node matches, its entire subtree is preserved (no pruning of
 *  its daughters) — only non-matching sibling branches are cut. */
function pruneSubtree(node: MindmapNode, keyword: string): MindmapNode | null {
  if (!keyword) return node;
  const lower = keyword.toLowerCase();
  const selfMatch = node.name.toLowerCase().includes(lower);

  // Matching node: keep it together with ALL its descendants intact.
  if (selfMatch) return node;

  // Non-matching node: only survive if some descendant matches,
  // and prune away children that contain no matches at all.
  if (!node.children || node.children.length === 0) {
    return null;
  }

  const prunedChildren = node.children
    .map((child) => pruneSubtree(child, keyword))
    .filter((c): c is MindmapNode => c !== null);

  if (prunedChildren.length > 0) {
    return { ...node, children: prunedChildren };
  }
  return null;
}

/** Always keep the root; prune its children to matching branches only. */
function pruneTree(root: MindmapNode, keyword: string): MindmapNode {
  if (!keyword) return root;
  const prunedChildren = (root.children || [])
    .map((child) => pruneSubtree(child, keyword))
    .filter((c): c is MindmapNode => c !== null);
  return { ...root, children: prunedChildren };
}

/** Highlight matching nodes by overriding label border + glow. */
function highlightNode(node: MindmapNode, keyword: string, isDark: boolean): MindmapNode {
  if (!keyword) return node;
  const matches = node.name.toLowerCase().includes(keyword.toLowerCase());
  const highlighted: MindmapNode = { ...node };
  if (matches) {
    const accentBorder = isDark ? '#ffd86b' : '#d97706';
    const glow = isDark ? 'rgba(255,216,107,0.65)' : 'rgba(217,119,6,0.55)';
    highlighted.label = {
      ...node.label,
      borderColor: accentBorder,
      borderWidth: 2,
      shadowBlur: 18,
      shadowColor: glow,
    };
  }
  if (node.children) {
    highlighted.children = node.children.map((c) => highlightNode(c, keyword, isDark));
  }
  return highlighted;
}

export default function MindmapView({ content }: MindmapViewProps) {
  const { theme: currentTheme } = useTheme();
  const isDark = useMemo(() => THEME_OPTIONS.find(t => t.value === currentTheme)?.isDark ?? false, [currentTheme]);

  // Search state: input value (immediate), debounced query (for highlight),
  // and committed query (for branch pruning — set on ENTER).
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');

  // Debounce the search input for live highlighting.
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = searchInput.trim();
      setDebouncedQuery(q);
      // Clear pruning when the user empties the search.
      if (!q) setCommittedQuery('');
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const q = searchInput.trim();
      setCommittedQuery(q);
      setDebouncedQuery(q); // immediate highlight on ENTER
    } else if (e.key === 'Escape') {
      setSearchInput('');
      setDebouncedQuery('');
      setCommittedQuery('');
    }
  };

  const treeData = useMemo(() => {
    // 1. Strip HTML tags to get plain text
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    // Check if it's a list-based content first (fallback)
    const rootList = doc.querySelector('ul, ol');
    if (rootList) {
      function parseList(element: Element): MindmapNode[] {
        const nodes: MindmapNode[] = [];
        const items = element.querySelectorAll(':scope > li');
        items.forEach(item => {
          let text = '';
          for (const child of Array.from(item.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) text += child.textContent;
            else if (child.nodeType === Node.ELEMENT_NODE && !['UL', 'OL'].includes((child as Element).tagName)) {
              text += (child as Element).textContent;
            }
          }
          text = text.trim();
          if (!text) return;
          const node: MindmapNode = { name: text };
          const subList = item.querySelector(':scope > ul, :scope > ol');
          if (subList) node.children = parseList(subList);
          nodes.push(node);
        });
        return nodes;
      }
      return {
        name: 'Wikiki',
        children: parseList(rootList)
      };
    }

    // 2. Parse indented text (Mermaid-like mindmap syntax)
    const rawText = doc.body.textContent || '';
    const lines = rawText.split('\n').filter(l => l.trim().length > 0);

    if (lines.length === 0) return { name: 'Empty' };

    // Remove 'mindmap' header if present
    if (lines[0].trim().toLowerCase() === 'mindmap') {
      lines.shift();
    }

    const stack: { depth: number; node: MindmapNode }[] = [];
    let rootNode: MindmapNode | null = null;

    lines.forEach(line => {
      const match = line.match(/^(\s*)(.*)$/);
      if (!match) return;

      const indent = match[1].length;
      let text = match[2].trim();

      // Handle root[Text] syntax
      const rootMatch = text.match(/^root\[(.*)\]$/);
      if (rootMatch) text = rootMatch[1];

      const node: MindmapNode = { name: text, children: [] };

      if (stack.length === 0) {
        rootNode = node;
        stack.push({ depth: indent, node });
      } else {
        while (stack.length > 0 && stack[stack.length - 1].depth >= indent) {
          stack.pop();
        }

        if (stack.length > 0) {
          const parent = stack[stack.length - 1].node;
          if (!parent.children) parent.children = [];
          parent.children.push(node);
        }
        stack.push({ depth: indent, node });
      }
    });

    return rootNode || { name: 'Wikiki' };
  }, [content]);

  // Apply colors and styles recursively — each top-level branch gets a
  // distinctive color from the palette, and descendants inherit progressively
  // lighter tints of that branch color for visual hierarchy.
  const styledData = useMemo(() => {
    if (!treeData) return null;

    const palette = isDark ? COLORS_DARK : COLORS_LIGHT;

    // Root node: prominent, neutral, anchors the composition
    const rootColor: NodeColor = isDark
      ? { bg: '#9a9a9a', text: '#1a1a1a', border: '#bababa' }
      : { bg: '#3a3a3a', text: '#ffffff', border: '#1a1a1a' };

    const processNode = (
      node: MindmapNode,
      level: number,
      branchColor: NodeColor | null,
    ): MindmapNode => {
      let color: NodeColor;
      let lineColor: string;

      if (level === 0) {
        color = rootColor;
        lineColor = isDark ? '#666666' : '#cccccc';
      } else if (level === 1) {
        // Branch root: full palette color
        color = branchColor || palette[0];
        lineColor = color.border;
      } else {
        // Deeper levels: tint the branch color toward white/dark
        const base = branchColor || palette[0];
        const tintFactor = (level - 1) * 0.18;
        color = {
          bg: tint(base.bg, tintFactor, isDark),
          text: base.text,
          border: tint(base.border, tintFactor, isDark),
        };
        lineColor = tint(base.border, tintFactor * 0.5, isDark);
      }

      // Composition: size, weight, padding, radius all scale with level
      const fontSize = level === 0 ? 16 : level === 1 ? 13 : 12;
      const fontWeight: number | string = level === 0 ? 'bold' : level === 1 ? 500 : 'normal';
      const padding: [number, number] = level === 0 ? [10, 16] : [7, 12];
      const borderRadius = level === 0 ? 14 : 8;
      const shadowBlur = level === 0 ? 12 : 8;
      const shadowOpacity = isDark ? 0.4 : 0.12;
      const shadowOffsetY = level === 0 ? 3 : 2;

      return {
        ...node,
        label: {
          backgroundColor: color.bg,
          color: color.text,
          borderColor: color.border,
          borderWidth: 1,
          padding,
          borderRadius,
          fontSize,
          fontWeight,
          shadowBlur,
          shadowColor: `rgba(0,0,0,${shadowOpacity})`,
          shadowOffsetX: 0,
          shadowOffsetY,
        },
        itemStyle: {
          color: color.bg,
          borderColor: color.border,
        },
        lineStyle: {
          color: lineColor,
          width: Math.max(1, 3 - level * 0.5),
          opacity: Math.max(0.35, 1 - level * 0.15),
        },
        children: node.children?.map((child, idx) => {
          if (level === 0) {
            // Assign a palette color to each top-level branch
            return processNode(child, 1, palette[idx % palette.length]);
          }
          // Descendants inherit the branch color
          return processNode(child, level + 1, branchColor);
        }),
      };
    };

    return processNode(treeData, 0, null);
  }, [treeData, isDark]);

  // Apply branch pruning (committedQuery — set on ENTER) and highlighting
  // (debouncedQuery — live as the user types).
  const displayData = useMemo(() => {
    if (!styledData) return null;
    let data = styledData;
    if (committedQuery) {
      data = pruneTree(data, committedQuery);
    }
    if (debouncedQuery) {
      data = highlightNode(data, debouncedQuery, isDark);
    }
    return data;
  }, [styledData, committedQuery, debouncedQuery, isDark]);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.92)',
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
      borderWidth: 1,
      textStyle: {
        color: isDark ? '#e0e0e0' : '#333333',
        fontSize: 12,
      },
      padding: [8, 12],
    },
    series: [
      {
        type: 'tree',
        data: [displayData],
        layout: 'radial',
        symbol: 'circle',
        symbolSize: 1, // Hide the default circles — labels act as nodes
        nodePadding: 22,
        roam: true,
        expandAndCollapse: true,
        initialTreeDepth: 2,
        animationDuration: 550,
        animationDurationUpdate: 750,
        label: {
          position: 'inside',
          align: 'center',
          verticalAlign: 'middle',
          rotate: 0, // Keep text horizontal
        },
        leaves: {
          label: {
            position: 'inside',
            rotate: 0,
          }
        },
        emphasis: {
          label: {
            shadowBlur: 20,
            shadowColor: 'rgba(0,0,0,0.25)',
          },
          lineStyle: {
            width: 3,
            opacity: 1,
          }
        },
        lineStyle: {
          curveness: 0.5
        }
      }
    ]
  };

  return (
    <div className="w-full h-full bg-background relative">
      <div className="absolute top-4 right-4 z-10 text-[10px] text-muted-foreground uppercase tracking-widest pointer-events-none">
        Drag to move • Scroll to zoom
      </div>
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
      />
      <input
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onKeyDown={handleSearchKeyDown}
        placeholder="Search nodes... (Enter to filter, Esc to clear)"
        className="pointer-events-auto absolute bottom-4 left-4 z-20 w-64 rounded-md border border-border bg-card/90 px-3 py-1.5 text-sm text-foreground shadow-sm backdrop-blur-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
