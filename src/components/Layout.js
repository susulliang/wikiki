import { Outlet } from 'react-router-dom';
import { StorageModeProvider } from '@/lib/storage-context';
export const Layout = () => {
    return (<StorageModeProvider>
      <Outlet />
    </StorageModeProvider>);
};
