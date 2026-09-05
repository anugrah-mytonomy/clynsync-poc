import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { HelpIcon, LogoutIcon, SettingsIcon, UploadIcon } from '@/components/ui/icons';
import dashboardIcon from '@/assets/Dashboard.svg';
import logoIcon from '@/assets/Logo_icon.svg';
import userAvatar from '@/assets/User_Avatar.svg';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: dashboardIcon, end: true },
  { to: '/dashboard/poc-5', label: 'POC 5', icon: UploadIcon },
];

const bottomNavItems = [
  { to: '/dashboard/help', label: 'Help & Support', icon: HelpIcon },
  { to: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
];

const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-sm rounded-md px-md py-sm text-sm font-medium transition-colors',
    isActive ? 'bg-[#BADDE8]' : 'text-slate-600 hover:bg-surface',
  );

const Sidebar = () => {
  const { logout, isLoggingOut } = useAuth();

  return (
    <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-border bg-background px-md py-lg">
      <div className="flex items-center gap-sm px-md">
        <img src={logoIcon} alt="" className="h-[46px] w-[46px] shrink-0" aria-hidden="true" />
        <span className="text-xl font-semibold text-slate-900">Clinic AI Portal</span>
      </div>

      <nav className="mt-xl flex flex-1 flex-col gap-xs">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClasses}>
            {typeof Icon === 'string' ? (
              <img src={Icon} alt="" className="shrink-0" aria-hidden="true" />
            ) : (
              <Icon className="h-5 w-5 shrink-0" />
            )}
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col gap-xs">
        {bottomNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={navLinkClasses}>
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}

        <div className="mt-md flex items-center gap-sm border-t border-border px-md pt-md">
          <img
            src={userAvatar}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">John Doe</p>
            <p className="truncate text-xs text-muted">clinic-lead@mytonomy.com</p>
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={isLoggingOut}
            aria-label="Log out"
            className="shrink-0 rounded-md p-xs text-muted transition-colors hover:bg-surface hover:text-slate-900 disabled:opacity-60"
          >
            <LogoutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
