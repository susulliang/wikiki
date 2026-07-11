import { Check } from 'lucide-react';
import type { ThemeName } from '@/hooks/useTheme';
import { THEME_OPTIONS } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const THEME_PALETTE: Record<ThemeName, string> = {
  'graphite': 'linear-gradient(135deg, #f5f5f4 0%, #1c1c1c 100%)',
  'graphite-night': 'linear-gradient(135deg, #1c1c1c 0%, #0a0a0a 100%)',
  'warm-light': 'linear-gradient(135deg, #fbfaf7 0%, #85946b 100%)',
  'clean-light': 'linear-gradient(135deg, #f8fafc 0%, #3b82f6 100%)',
  'soft-light': 'linear-gradient(135deg, #FAF5FF 0%, #a855f7 100%)',
  'sunset': 'linear-gradient(135deg, #2d1d18 0%, #f97316 100%)',
  'forest': 'linear-gradient(135deg, #f4f7f4 0%, #2e7d32 100%)',
  'dark': 'linear-gradient(135deg, #18181b 0%, #eab308 100%)',
  'midnight': 'linear-gradient(135deg, #090d16 0%, #14b8a6 100%)',
};

interface ThemesPageProps {
  currentTheme: ThemeName;
  onSetTheme: (theme: ThemeName) => void;
}

export default function ThemesPage({ currentTheme, onSetTheme }: ThemesPageProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <header className="mb-10 border-b-2 border-border pb-6">
          <h1 className="text-4xl font-bold uppercase tracking-tight text-foreground">
            Themes
          </h1>
          <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
            Choose your accent color
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-center gap-8 py-6">
          {THEME_OPTIONS.map((t) => {
            const isActive = currentTheme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onSetTheme(t.value)}
                aria-label={t.label}
                aria-pressed={isActive}
                className="group relative flex size-14 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span
                  className={cn(
                    'block size-12 rounded-full ring-offset-2 ring-offset-background transition-all',
                    isActive && 'ring-2 ring-primary',
                  )}
                  style={{ background: THEME_PALETTE[t.value] }}
                  aria-hidden
                />
                {isActive && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Check className="size-5 text-white drop-shadow-md" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
