import { Check, Moon, Sun } from 'lucide-react';
import type { ThemeName } from '@/hooks/useTheme';
import { THEME_OPTIONS } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const THEME_PALETTE: Record<ThemeName, string> = {
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
        <header className="mb-8 border-b-2 border-border pb-6">
          <h1 className="font-serif text-4xl font-bold uppercase tracking-tight text-foreground">
            Themes
          </h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Choose your visual mode
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_OPTIONS.map((t) => {
            const isActive = currentTheme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onSetTheme(t.value)}
                aria-pressed={isActive}
                className={cn(
                  'group relative overflow-hidden bg-card text-left transition-all hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'border-2 border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'border-2 border-border hover:border-primary/50',
                )}
              >
                <div
                  className="h-32 w-full"
                  style={{ background: THEME_PALETTE[t.value] }}
                  aria-hidden
                />
                <div className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="font-serif text-lg font-bold uppercase tracking-wide text-foreground">
                      {t.label}
                    </h3>
                    <span className="mt-1 inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      {t.isDark ? <Moon className="size-3" /> : <Sun className="size-3" />}
                      {t.isDark ? 'Dark' : 'Light'}
                    </span>
                  </div>
                  {isActive && (
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-4" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
