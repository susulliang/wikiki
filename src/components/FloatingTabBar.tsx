import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Package, Search, BookOpen, Palette, Network } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabId = 'database' | 'products' | 'supersearch' | 'wikis' | 'themes' | 'mindmaps';

interface FloatingTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isMinimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
}

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: 'database', label: 'Database', icon: Database },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'supersearch', label: 'Search', icon: Search },
  { id: 'wikis', label: 'Wikis', icon: BookOpen },
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'mindmaps', label: 'Mindmaps', icon: Network },
];

const SWIPE_THRESHOLD = 60;
const COLLAPSE_DELAY = 3000;

/** Wikiki vector mark — two pillars + center diamond forming a stylized W. */
function WikikiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 54 L20 10 L30 10 L18 54 Z" fill="currentColor" opacity="0.95" />
      <path d="M58 54 L44 10 L34 10 L46 54 Z" fill="currentColor" opacity="0.95" />
      <path d="M32 22 L40 34 L32 46 L24 34 Z" fill="currentColor" opacity="0.65" />
    </svg>
  );
}

export default function FloatingTabBar({
  activeTab,
  onTabChange,
  isMinimized,
  onMinimizedChange,
}: FloatingTabBarProps) {
  const [showText, setShowText] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const cancelCollapse = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const scheduleCollapse = useCallback(() => {
    cancelCollapse();
    collapseTimer.current = setTimeout(() => setShowText(false), COLLAPSE_DELAY);
  }, [cancelCollapse]);

  useEffect(() => () => cancelCollapse(), [cancelCollapse]);

  const handleMouseEnter = useCallback(() => {
    cancelCollapse();
    setShowText(true);
  }, [cancelCollapse]);

  const handleMouseLeave = useCallback(() => {
    scheduleCollapse();
  }, [scheduleCollapse]);

  const handleTabClick = useCallback(
    (tab: TabId) => {
      onTabChange(tab);
      scheduleCollapse();
    },
    [onTabChange, scheduleCollapse],
  );

  // Swipe-right gesture to minimize
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (startX.current === null || startY.current === null) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      if (dx > SWIPE_THRESHOLD && Math.abs(dy) < 40) {
        onMinimizedChange(true);
        startX.current = null;
        startY.current = null;
      }
    },
    [onMinimizedChange],
  );

  const handlePointerEnd = useCallback(() => {
    startX.current = null;
    startY.current = null;
  }, []);

  return (
    <AnimatePresence>
      {isMinimized ? (
        <motion.button
          key="minimized"
          type="button"
          onClick={() => onMinimizedChange(false)}
          aria-label="Expand tab bar"
          className="fixed right-4 top-4 z-50 flex size-12 items-center justify-center rounded-full border border-foreground/15 bg-background/60 shadow-xl backdrop-blur-2xl backdrop-saturate-150 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <WikikiMark className="size-7 text-primary" />
        </motion.button>
      ) : (
        <motion.nav
          key="expanded"
          className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-foreground/10 bg-background/40 p-1.5 shadow-2xl backdrop-blur-2xl backdrop-saturate-150"
          style={{ touchAction: 'pan-y' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center rounded-full px-3 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-foreground/10',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span
                  className={cn(
                    'overflow-hidden whitespace-nowrap transition-all duration-300',
                    showText ? 'ml-2 max-w-[120px] opacity-100' : 'ml-0 max-w-0 opacity-0',
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
