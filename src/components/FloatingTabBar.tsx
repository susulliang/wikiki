import { Database, Package, Search, BookOpen, Palette, Network } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabId = 'database' | 'products' | 'supersearch' | 'wikis' | 'themes' | 'mindmaps';

interface FloatingTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: 'database', label: 'Database', icon: Database },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'supersearch', label: 'Search', icon: Search },
  { id: 'wikis', label: 'Wikis', icon: BookOpen },
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'mindmaps', label: 'Mindmaps', icon: Network },
];

export default function FloatingTabBar({ activeTab, onTabChange }: FloatingTabBarProps) {
  return (
    <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2">
      <nav className="flex items-center gap-1 rounded-full bg-foreground p-1.5 shadow-lg">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-background hover:bg-background/10',
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
