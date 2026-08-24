import { NavLink, Outlet } from 'react-router-dom';
import { BrandLockup } from '../ui/BrandMark.jsx';

const PARTNER_NAV = [
  { to: '/partner/support', label: 'Shared space', end: true, icon: 'support' },
  { to: '/profile', label: 'Account', icon: 'profile' },
];

function sidebarLinkClass({ isActive }) {
  return [
    'group flex min-h-[44px] items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-cream text-ink'
      : 'text-moss hover:bg-cream/70 hover:text-ink',
  ].join(' ');
}

function SupportIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function ProfileIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

function PartnerNavLink({ item }) {
  const Icon = item.icon === 'support' ? SupportIcon : ProfileIcon;

  return (
    <NavLink to={item.to} end={item.end} className={sidebarLinkClass}>
      {({ isActive }) => (
        <>
          <span
            className={[
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              isActive ? 'bg-pine text-cream' : 'text-moss group-hover:text-ink',
            ].join(' ')}
          >
            <Icon />
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

function PartnerMobileLink({ item }) {
  const Icon = item.icon === 'support' ? SupportIcon : ProfileIcon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 py-2 text-center"
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              'flex flex-col items-center gap-1 transition-colors',
              isActive ? 'text-ink' : 'text-faint',
            ].join(' ')}
          >
            <Icon className="h-[22px] w-[22px]" />
            <span className="text-xs font-medium leading-none">{item.label}</span>
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

export function PartnerAppShellLayout() {
  return (
    <div className="app-ambient min-h-screen md:flex">
      <nav
        aria-label="Partner"
        className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-pine/15 bg-[#eefbf9] px-5 py-8 md:flex"
      >
        <div className="mb-10 px-3">
          <BrandLockup
            markClassName="h-10 w-10"
            textClassName="text-[1.7rem] leading-none"
          />
        </div>

        <p className="mb-4 px-3 text-sm leading-relaxed text-moss">
          You&apos;re viewing a shared support space — not a personal tracking
          account.
        </p>

        <div className="flex flex-1 flex-col gap-1">
          {PARTNER_NAV.map((item) => (
            <PartnerNavLink key={item.to} item={item} />
          ))}
        </div>
      </nav>

      <main className="min-w-0 flex-1 px-5 pb-28 pt-7 md:ml-64 md:px-12 md:py-12 lg:px-16">
        <Outlet />
      </main>

      <nav
        aria-label="Partner sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm shadow-lift md:hidden"
      >
        <div className="mx-auto flex max-w-md items-end justify-around px-4">
          {PARTNER_NAV.map((item) => (
            <PartnerMobileLink key={item.to} item={item} />
          ))}
        </div>
      </nav>
    </div>
  );
}
