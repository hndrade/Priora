import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './stores/auth';
import { useData } from './stores/data';
import { useNotifications } from './stores/notifications';
import { initOfflineSync } from './lib/offline';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { ListPage } from './pages/ListPage';
import { DocsPage } from './pages/DocsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { Spinner } from './components/ui';

export default function App() {
  const { session, loading, init } = useAuth();

  useEffect(() => {
    void init();
    initOfflineSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HashRouter>
      {loading ? (
        <div className="flex h-screen items-center justify-center">
          <Spinner />
        </div>
      ) : session ? (
        <AuthedApp userId={session.user.id} />
      ) : (
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      )}
    </HashRouter>
  );
}

function AuthedApp({ userId }: { userId: string }) {
  const initData = useData((s) => s.init);
  const initNotifications = useNotifications((s) => s.init);

  useEffect(() => {
    void initData(userId);
    void initNotifications(userId);
  }, [userId, initData, initNotifications]);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/list/:listId" element={<ListPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/:docId" element={<DocsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
