import { Outlet, useLocation } from 'react-router-dom';
import { CoachLauncher } from '../coach/CoachLauncher.jsx';

export function InsightsLayout() {
  const { pathname } = useLocation();
  const showLauncher = pathname === '/insights' || pathname === '/insights/';

  return (
    <div className="mx-auto max-w-4xl">
      <Outlet />
      {showLauncher ? <CoachLauncher /> : null}
    </div>
  );
}
