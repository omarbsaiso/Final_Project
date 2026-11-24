import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedLayout({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="full-page-loader"><span className="spinner-border" role="status" /><p>Loading your workspace…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
