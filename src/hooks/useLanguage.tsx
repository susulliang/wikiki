import { createContext, useState, useCallback, useContext, type ReactNode } from 'react';
import {
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
  type LanguageCode,
  type TranslationKey,
} from '@/i18n/translations';

const LANGUAGE_KEY = '__wikiki_language';

function loadLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY) as LanguageCode;
    if (LANGUAGE_OPTIONS.some((l) => l.code === stored)) return stored;
  } catch {
    // ignore
  }
  // Try to detect browser language
  try {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('zh')) return 'zh';
    if (browserLang.startsWith('ja')) return 'jp';
    if (browserLang.startsWith('de')) return 'de';
    if (browserLang.startsWith('it')) return 'it';
    if (browserLang.startsWith('es')) return 'es';
  } catch {
    // ignore
  }
  return 'en';
}

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(loadLanguage);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const dict = TRANSLATIONS[language] ?? TRANSLATIONS.en;
      return dict[key] ?? TRANSLATIONS.en[key] ?? key;
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
