import { useState, useCallback, useEffect } from 'react';

const THEME_KEY = '__wikiki_theme';

export type ThemeName = 'graphite' | 'graphite-night' | 'warm-light' | 'clean-light' | 'soft-light' | 'sunset' | 'forest' | 'charcoal' | 'midnight';

export const THEME_OPTIONS = [
  { value: 'graphite' as const, label: 'Graphite', isDark: false },
  { value: 'graphite-night' as const, label: 'Graphite Night', isDark: true },
  { value: 'warm-light' as const, label: 'Warm Light', isDark: true },
  { value: 'clean-light' as const, label: 'Clean Light', isDark: false },
  { value: 'soft-light' as const, label: 'Soft Lavender', isDark: false },
  { value: 'sunset' as const, label: 'Sunset Glow', isDark: true },
  { value: 'forest' as const, label: 'Forest Moss', isDark: false },
  { value: 'charcoal' as const, label: 'Charcoal Dark', isDark: true },
  { value: 'midnight' as const, label: 'Midnight Blue', isDark: true },
] as const;

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    try {
      let stored = localStorage.getItem(THEME_KEY) as ThemeName;
      // Migrate old 'dark' theme name to 'charcoal'
      if (stored === ('dark' as string)) stored = 'charcoal' as ThemeName;
      if (THEME_OPTIONS.some(t => t.value === stored)) return stored;
    } catch {
      // ignore
    }
    return 'graphite';
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    THEME_OPTIONS.forEach(t => {
      root.classList.remove(t.value);
    });
    
    // Add current theme class
    root.classList.add(theme);
    
    // Set dark mode class for dark themes
    const isDark = THEME_OPTIONS.find(t => t.value === theme)?.isDark ?? false;
    root.classList.toggle('dark', isDark);
    
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const currentIdx = THEME_OPTIONS.findIndex(t => t.value === prev);
      const nextIdx = (currentIdx + 1) % THEME_OPTIONS.length;
      return THEME_OPTIONS[nextIdx].value;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}
