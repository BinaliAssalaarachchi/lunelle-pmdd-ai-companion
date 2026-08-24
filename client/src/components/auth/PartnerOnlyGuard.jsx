import { Navigate, Outlet } from 'react-router-dom';
import { LoadingState } from '../ui/states.jsx';
import { usePartnerAppMode } from '../../contexts/PartnerAppModeContext.jsx';

/** Blocks owner clinical routes when the user is connected as a partner only. */
export function PartnerOnlyGuard() {
  const { loading, partnerOnly } = usePartnerAppMode();

  if (loading) {
    return <LoadingState message="Loading…" />;
  }

  if (partnerOnly) {
    return <Navigate to="/partner/support" replace />;
  }

  return <Outlet />;
}

/** Fallback for unknown paths — partners land on support, owners on home. */
export function AppDefaultRedirect() {
  const { loading, partnerOnly } = usePartnerAppMode();

  if (loading) {
    return <LoadingState message="Loading…" />;
  }

  return <Navigate to={partnerOnly ? '/partner/support' : '/'} replace />;
}
