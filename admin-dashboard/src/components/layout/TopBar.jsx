import { Link } from 'react-router-dom';
import { logout } from '../../firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../hooks/useBusiness';
import { useLayout } from '../../contexts/LayoutContext';
import Icon from '../shared/Icon';
import ThemeToggle from '../shared/ThemeToggle';
import { Badge } from '../shared/Card';

function initials(email) {
  if (!email) return '?';
  return email.slice(0, 2).toUpperCase();
}

export default function TopBar() {
  const { user, isAdmin, userPlan } = useAuth();
  const { businesses, currentBusiness, setCurrentBusiness } = useBusiness();
  const { openSidebar } = useLayout();

  return (
    <header className="h-14 sm:h-16 bg-white/85 dark:bg-slate-900/85 backdrop-blur border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={openSidebar}
          className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl text-ink-muted hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 flex-shrink-0"
          aria-label="Open navigation menu"
        >
          <Icon name="menu" className="w-5 h-5" />
        </button>

        {businesses.length > 0 ? (
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <select
              value={currentBusiness?.id || ''}
              onChange={(e) => {
                const biz = businesses.find((b) => b.id === e.target.value);
                setCurrentBusiness(biz);
              }}
              className="appearance-none w-full sm:w-auto pl-3 pr-9 py-2 bg-surface-subtle dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-ink dark:text-slate-100 sm:min-w-[180px] md:min-w-[220px] focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <svg className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          </div>
        ) : (
          <Link to="/businesses" className="inline-flex items-center gap-2 text-sm text-primary-dark dark:text-primary-light font-medium truncate">
            <Icon name="plus" className="w-4 h-4 flex-shrink-0" />
            <span className="hidden min-[400px]:inline">Create your first chatbot</span>
            <span className="min-[400px]:hidden">New chatbot</span>
          </Link>
        )}
        {currentBusiness && (
          <Link to="/plans" className="hidden sm:block flex-shrink-0">
            <Badge color="primary" className="capitalize hover:opacity-80">
              {userPlan || 'free'} plan
            </Badge>
          </Link>
        )}
        <div className="hidden lg:flex items-center gap-2 bg-surface-subtle dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 min-w-[220px] xl:min-w-[280px]">
          <Icon name="inbox" className="w-4 h-4 text-slate-400" />
          <input
            className="bg-transparent w-full text-sm outline-none text-ink dark:text-slate-200 placeholder:text-slate-400"
            placeholder="Search flows, contacts, campaigns..."
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <ThemeToggle />
        {isAdmin && (
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink dark:bg-slate-700 text-white text-[11px] font-semibold uppercase tracking-wide">
            Admin
          </span>
        )}
        <div className="hidden md:flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-gradient text-white text-xs font-semibold flex items-center justify-center">
            {initials(user?.email)}
          </div>
          <span className="text-sm text-ink-soft dark:text-slate-300 max-w-[140px] lg:max-w-[180px] truncate">{user?.email}</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-2 px-2 sm:px-3 py-2 rounded-xl text-sm font-medium text-ink-muted dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-ink dark:hover:text-slate-200 transition-colors"
        >
          <Icon name="logout" className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
