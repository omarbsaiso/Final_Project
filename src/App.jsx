import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './layouts/AppShell';
import ProtectedLayout from './layouts/ProtectedLayout';

const CallDetailsPage = lazy(() => import('./pages/CallDetailsPage'));
const CallsPage = lazy(() => import('./pages/CallsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));

export default function App() {
  return (
    <Suspense fallback={<div className="full-page-loader"><span className="spinner-border" role="status" /><p>Loading your workspace…</p></div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="calls" element={<CallsPage />} />
            <Route path="calls/:callId" element={<CallDetailsPage />} />
            <Route path="knowledge" element={<KnowledgeBasePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route element={<ProtectedLayout roles={['Admin']} />}>
              <Route path="users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="/not-found" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Routes>
    </Suspense>
  );
}
