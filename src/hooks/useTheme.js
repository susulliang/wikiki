import { useState, useCallback, useEffect } from 'react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
const THEME_KEY = '__wikiki_theme';
export const THEME_OPTIONS = [
    { value: 'warm-light', label: '温暖亮色', isDark: false },
    { value: 'clean-light', label: '清爽亮色', isDark: false },
    { value: 'soft-light', label: '柔和亮色', isDark: false },
    { value: 'sunset', label: '落日暖色', isDark: false },
    { value: 'forest', label: '森林暖色', isDark: false },
    { value: 'dark', label: '深色', isDark: true },
    { value: 'midnight', label: '午夜蓝', isDark: true },
];
export function useTheme() {
    const [theme, setThemeState] = useState(() => {
        try {
            const stored = scopedStorage.getItem(THEME_KEY);
            if (THEME_OPTIONS.some(t => t.value === stored))
                return stored;
        }
        catch {
            // ignore
        }
        return 'warm-light';
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
            scopedStorage.setItem(THEME_KEY, theme);
        }
        catch {
            // ignore
        }
    }, [theme]);
    const setTheme = useCallback((newTheme) => {
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
