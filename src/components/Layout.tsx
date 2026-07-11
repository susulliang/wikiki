import { Outlet } from 'react-router-dom';
import { StorageModeProvider } from '@/lib/storage-context';
import { LanguageProvider } from '@/hooks/useLanguage';

export const Layout = () => {
  return (
    <StorageModeProvider>
      <LanguageProvider>
        <Outlet />
      </LanguageProvider>
    </StorageModeProvider>
  );
};
