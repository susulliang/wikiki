import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';
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

/** Color palette for child nodes. In dark themes uses a greyscale ramp that
 *  aligns with the Graphite chart tokens; in light themes uses the original
 *  soft pastel palette for readability on light backgrounds. */
const COLORS_LIGHT = [
  '#FF9CEE', '#B2FF59', '#FFFF8D', '#FFCC80', '#CE93D8',
  '#80DEEA', '#A5D6A7', '#90CAF9', '#FFAB91',
];
const COLORS_DARK = [
  '#d9d9d9', '#a6a6a6', '#808080', '#595959', '#333333',
  '#bdbdbd', '#8c8c8c', '#666666', '#404040',
];

export default function MindmapView({ content }: MindmapViewProps) {
  const { theme: currentTheme } = useTheme();
  const isDark = useMemo(() => THEME_OPTIONS.find(t => t.value === currentTheme)?.isDark ?? false, [currentTheme]);

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

  // Apply colors and styles recursively
  const styledData = useMemo(() => {
    if (!treeData) return null;

    const processNode = (node: MindmapNode, level: number, colorIdx: number): MindmapNode => {
      const COLORS = isDark ? COLORS_DARK : COLORS_LIGHT;
      const color = level === 0 ? (isDark ? '#999999' : '#333333') : COLORS[colorIdx % COLORS.length];
      const textColor = level === 0 ? '#FFFFFF' : (isDark ? '#1a1a1a' : '#333333');
      
      return {
        ...node,
        label: {
          backgroundColor: color,
          color: textColor,
          padding: [6, 10],
          borderRadius: 4,
          fontSize: level === 0 ? 16 : 12,
          fontWeight: level === 0 ? 'bold' : 'normal',
          shadowBlur: 4,
          shadowColor: 'rgba(0,0,0,0.2)',
          shadowOffsetX: 2,
          shadowOffsetY: 2,
        },
        itemStyle: {
          color: color,
          borderColor: color,
        },
        lineStyle: {
          color: color,
          width: Math.max(1, 4 - level),
        },
        children: node.children?.map((child, idx) => 
          processNode(child, level + 1, level === 0 ? idx : colorIdx)
        )
      };
    };

    return processNode(treeData, 0, 0);
  }, [treeData]);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: 'var(--popover)',
      borderColor: 'var(--border)',
      textStyle: { color: 'var(--popover-foreground)' },
    },
    series: [
      {
        type: 'tree',
        data: [styledData],
        layout: 'radial',
        symbol: 'circle',
        symbolSize: 1, // Hide the default circles
        nodePadding: 20,
        roam: true, // Enable drag and zoom
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
            rotate: 0, // Keep text horizontal
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
      <div className="absolute top-4 left-4 z-10 text-[10px] text-muted-foreground uppercase tracking-widest pointer-events-none">
        Drag to move • Scroll to zoom
      </div>
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}
