import { Link, NavLink, Outlet } from 'react-router-dom';
import { BrandLockup } from '../ui/BrandMark.jsx';

const NAV = [
  { to: '/', label: 'Home', end: true, icon: 'home' },
  { to: '/insights', label: 'Insights', icon: 'insights' },
  { to: '/track', label: 'Track', icon: 'track', primary: true },
  { to: '/reports', label: 'Reports', icon: 'reports' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
];

function NavIcon({ name, className = 'h-[22px] w-[22px]' }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': true,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case 'track':
      return (
        <svg {...common}>
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      );
    case 'insights':
      return (
        <svg {...common}>
          <path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
          <path d="M18 14l.7 2.1L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.9L18 14Z" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <path d="M5 19V9M10 19V5M15 19v-7M20 19v-4" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19a7 7 0 0 1 14 0" />
        </svg>
      );
    default:
      return null;
  }
}

function sidebarLinkClass({ isActive }) {
  return [
    'group flex min-h-[44px] items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-cream text-ink'
      : 'text-moss hover:bg-cream/70 hover:text-ink',
  ].join(' ');
}

function SidebarLink({ item }) {
  return (
    <NavLink to={item.to} end={item.end} className={sidebarLinkClass}>
      {({ isActive }) => (
        <>
          <span
            className={[
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              isActive
                ? 'bg-pine text-cream'
                : 'text-moss group-hover:text-ink',
            ].join(' ')}
          >
            <NavIcon name={item.icon} className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1">{item.label}</span>
          {isActive ? (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-clay"
            />
          ) : null}
        </>
      )}
    </NavLink>
  );
}

function MobileTab({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 py-2 text-center"
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              'flex flex-col items-center gap-1 transition-colors',
              isActive ? 'text-ink' : 'text-faint',
            ].join(' ')}
          >
            <NavIcon name={item.icon} className="h-[22px] w-[22px]" />
            <span className="text-xs font-medium leading-none">
              {item.label}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={[
              'h-1 w-1 rounded-full transition-colors',
              isActive ? 'bg-clay' : 'bg-transparent',
            ].join(' ')}
          />
        </>
      )}
    </NavLink>
  );
}

function MobileTrackButton() {
  return (
    <NavLink
      to="/track"
      aria-label="Log today's symptoms"
      className="flex flex-col items-center justify-end pb-2"
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              'flex h-14 w-14 -translate-y-2 items-center justify-center rounded-full text-white transition-all shadow-lift',
              isActive
                ? 'bg-clay ring-4 ring-clay-soft'
                : 'bg-clay-deep hover:bg-clay',
            ].join(' ')}
          >
            <NavIcon name="track" className="h-6 w-6" />
          </span>
          <span
            className={[
              '-mt-1.5 text-xs font-medium leading-none transition-colors',
              isActive ? 'text-ink' : 'text-faint',
            ].join(' ')}
          >
            Track
          </span>
        </>
      )}
    </NavLink>
  );
}

export function AppShell() {
  return (
    <div className="app-ambient min-h-screen md:flex">
      {/* Desktop sidebar */}
      <nav
        aria-label="Primary"
        className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-pine/15 bg-[#eefbf9] px-5 py-8 md:flex"
      >
        <div className="mb-10 px-3">
          <BrandLockup
            markClassName="h-10 w-10"
            textClassName="text-[1.7rem] leading-none"
          />
        </div>

        <div className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>

        <Link
          to="/track"
          className="btn-brand-mix mt-auto min-h-[48px] w-full px-4 py-3 text-sm"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            +
          </span>
          Log symptoms
        </Link>
      </nav>

      <main className="min-w-0 flex-1 px-5 pb-32 pt-7 md:ml-64 md:px-12 md:py-12 lg:px-16">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm shadow-lift md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
          {NAV.map((item) =>
            item.primary ? (
              <MobileTrackButton key={item.to} />
            ) : (
              <MobileTab key={item.to} item={item} />
            ),
          )}
        </div>
      </nav>
    </div>
  );
}
