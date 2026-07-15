import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Search, BookOpen, Palette, Network } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import type { TranslationKey } from '@/i18n/translations';

export type TabId = 'bundles' | 'supersearch' | 'wikis' | 'themes' | 'mindmaps';

interface FloatingTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isMinimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
}

const TABS: Array<{ id: TabId; labelKey: TranslationKey; icon: LucideIcon }> = [
  { id: 'mindmaps', labelKey: 'tab.mindmaps', icon: Network },
  { id: 'bundles', labelKey: 'tab.bundles', icon: Package },
  { id: 'supersearch', labelKey: 'tab.search', icon: Search },
  { id: 'wikis', labelKey: 'tab.wikis', icon: BookOpen },
  { id: 'themes', labelKey: 'tab.themes', icon: Palette },
];

const SWIPE_THRESHOLD = 50;
const COLLAPSE_DELAY = 3000;
const NARROW_BREAKPOINT = 640; // sm breakpoint

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
  const { t } = useLanguage();
  const [showText, setShowText] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  // Track viewport width to suppress text on narrow devices
  useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // On narrow screens, never show text
  const canShowText = showText && !isNarrow;

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

  // Swipe-up or swipe-right gesture to minimize. We track the gesture via
  // window-level listeners (NOT pointer capture) so that child buttons still
  // receive their click events. Pointer capture on the <nav> would hijack
  // all pointer events, preventing tab buttons from firing onClick.
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only track touch/pen gestures, not mouse — mouse swipes are uncommon
    // and tracking them can interfere with hover-click flows.
    if (e.pointerType === 'mouse') return;

    startX.current = e.clientX;
    startY.current = e.clientY;

    const moveHandler = (ev: PointerEvent) => {
      if (startX.current === null || startY.current === null) return;
      const dx = ev.clientX - startX.current;
      const dy = ev.clientY - startY.current;
      const upward = dy < -SWIPE_THRESHOLD && Math.abs(dx) < 60;
      const rightward = dx > SWIPE_THRESHOLD && Math.abs(dy) < 60;
      if (upward || rightward) {
        onMinimizedChange(true);
        cleanup();
      }
    };

    const cleanup = () => {
      startX.current = null;
      startY.current = null;
      window.removeEventListener('pointermove', moveHandler);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
    };

    window.addEventListener('pointermove', moveHandler);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  }, [onMinimizedChange]);

  return (
    <AnimatePresence>
      {isMinimized ? (
        <motion.button
          key="minimized"
          type="button"
          onClick={() => onMinimizedChange(false)}
          aria-label="Expand tab bar"
          className="fixed right-4 top-4 z-50 flex size-12 cursor-pointer items-center justify-center rounded-full border border-foreground/15 bg-background/75 shadow-xl backdrop-blur-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 cursor-pointer items-center gap-1 rounded-full border border-foreground/10 bg-background/65 p-1.5 shadow-2xl backdrop-blur-sm"
          style={{ touchAction: 'none' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onPointerDown={handlePointerDown}
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const label = t(tab.labelKey);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex cursor-pointer items-center rounded-full px-3 py-2 text-xs uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-foreground/10',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span
                  className={cn(
                    'overflow-hidden whitespace-nowrap transition-all duration-300',
                    canShowText ? 'ml-2 max-w-[120px] opacity-100' : 'ml-0 max-w-0 opacity-0',
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
