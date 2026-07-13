import { Check, Globe } from 'lucide-react';
import type { ThemeName } from '@/hooks/useTheme';
import { THEME_OPTIONS } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { LANGUAGE_OPTIONS } from '@/i18n/translations';
import type { TranslationKey } from '@/i18n/translations';
import { cn } from '@/lib/utils';

const THEME_PALETTE: Record<ThemeName, string> = {
  'graphite': 'linear-gradient(135deg, #f5f5f4 0%, #1c1c1c 100%)',
  'graphite-night': 'linear-gradient(135deg, #1c1c1c 0%, #0a0a0a 100%)',
  'warm-light': 'linear-gradient(135deg, #fbfaf7 0%, #85946b 100%)',
  'clean-light': 'linear-gradient(135deg, #f8fafc 0%, #3b82f6 100%)',
  'soft-light': 'linear-gradient(135deg, #FAF5FF 0%, #a855f7 100%)',
  'sunset': 'linear-gradient(135deg, #2d1d18 0%, #f97316 100%)',
  'forest': 'linear-gradient(135deg, #f4f7f4 0%, #2e7d32 100%)',
  'charcoal': 'linear-gradient(135deg, #18181b 0%, #eab308 100%)',
  'midnight': 'linear-gradient(135deg, #090d16 0%, #14b8a6 100%)',
};

const THEME_LABEL_KEYS: Record<ThemeName, TranslationKey> = {
  'graphite': 'theme.graphite',
  'graphite-night': 'theme.graphiteNight',
  'warm-light': 'theme.warmLight',
  'clean-light': 'theme.cleanLight',
  'soft-light': 'theme.softLavender',
  'sunset': 'theme.sunsetGlow',
  'forest': 'theme.forestMoss',
  'charcoal': 'theme.charcoalDark',
  'midnight': 'theme.midnightBlue',
};

interface ThemesPageProps {
  currentTheme: ThemeName;
  onSetTheme: (theme: ThemeName) => void;
}

export default function ThemesPage({ currentTheme, onSetTheme }: ThemesPageProps) {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        {/* Theme section */}
        <div className="mb-2 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <span>{t('common.theme')}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 py-6">
          {THEME_OPTIONS.map((th) => {
            const isActive = currentTheme === th.value;
            return (
              <button
                key={th.value}
                type="button"
                onClick={() => onSetTheme(th.value)}
                aria-label={t(THEME_LABEL_KEYS[th.value])}
                aria-pressed={isActive}
                className="group relative flex flex-col items-center gap-2"
              >
                <span
                  className={cn(
                    'flex size-14 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isActive && 'ring-2 ring-primary',
                  )}
                  style={{ background: THEME_PALETTE[th.value] }}
                >
                  {isActive && <Check className="size-5 text-white drop-shadow-md" />}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t(THEME_LABEL_KEYS[th.value])}
                </span>
              </button>
            );
          })}
        </div>

        {/* Language section */}
        <div className="mt-12 border-t border-border/50 pt-10">
          <div className="mb-6 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Globe className="size-3.5" />
            <span>{t('common.language')}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {LANGUAGE_OPTIONS.map((lang) => {
              const isActive = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  aria-label={lang.label}
                  aria-pressed={isActive}
                  className={cn(
                    'flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/40',
                  )}
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase tracking-wide">
                    {lang.flag}
                  </span>
                  <span className="font-medium">{lang.nativeLabel}</span>
                  {isActive && <Check className="size-4" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
