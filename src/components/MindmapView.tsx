import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';

interface MindmapViewProps {
  content: string;
}

interface MindmapNode {
  name: string;
  children?: MindmapNode[];
}

export default function MindmapView({ content }: MindmapViewProps) {
  const data = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    function parseList(element: Element): MindmapNode[] {
      const nodes: MindmapNode[] = [];
      const items = element.querySelectorAll(':scope > li');
      
      items.forEach(item => {
        // Get the text content of the list item, excluding nested lists
        let text = '';
        for (const child of Array.from(item.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            text += child.textContent;
          } else if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName !== 'UL' && (child as Element).tagName !== 'OL') {
            text += (child as Element).textContent;
          }
        }
        
        text = text.trim();
        if (!text) return;
        
        const node: MindmapNode = { name: text };
        const subList = item.querySelector(':scope > ul, :scope > ol');
        if (subList) {
          node.children = parseList(subList);
        }
        nodes.push(node);
      });
      
      return nodes;
    }

    const rootList = doc.querySelector('ul, ol');
    if (!rootList) {
      // If no list found, treat whole content as root
      const text = doc.body.textContent?.trim();
      return text ? [{ name: text }] : [{ name: 'Empty Mindmap' }];
    }

    return parseList(rootList);
  }, [content]);

  const option = {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove'
    },
    series: [
      {
        type: 'tree',
        data: [{
          name: 'Mindmap',
          children: data
        }],
        top: '10%',
        left: '10%',
        bottom: '10%',
        right: '20%',
        symbolSize: 7,
        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          fontSize: 12,
          fontWeight: 'bold'
        },
        leaves: {
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left'
          }
        },
        emphasis: {
          focus: 'descendant'
        },
        expandAndCollapse: true,
        animationDuration: 550,
        animationDurationUpdate: 750,
        initialTreeDepth: 2,
        lineStyle: {
          width: 2,
          curveness: 0.5
        },
        itemStyle: {
          color: '#863bff',
          borderColor: '#863bff'
        }
      }
    ]
  };

  return (
    <div className="w-full h-full bg-background p-4">
      <ReactECharts 
        option={option} 
        style={{ height: '100%', width: '100%' }}
        theme="light" // We can handle theme switching later if needed
      />
    </div>
  );
}
