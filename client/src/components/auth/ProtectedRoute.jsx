import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { LoadingDots } from '../ui/states.jsx';

export function ProtectedRoute() {
  const { user, loading, configured } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        role="status"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper text-moss"
      >
        <LoadingDots />
        <p className="text-sm text-moss">Checking session…</p>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Firebase not configured
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-moss">
          Add your Firebase web config to <code>client/.env</code>, enable
          Email/Password auth, then restart the Vite dev server.
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
