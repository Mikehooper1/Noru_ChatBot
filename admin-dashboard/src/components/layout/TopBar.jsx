import { Link } from 'react-router-dom';
import { logout } from '../../firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../hooks/useBusiness';
import Icon from '../shared/Icon';
import { Badge } from '../shared/Card';

function initials(email) {
  if (!email) return '?';
  return email.slice(0, 2).toUpperCase();
}

export default function TopBar() {
  const { user, isAdmin, userPlan } = useAuth();
  const { businesses, currentBusiness, setCurrentBusiness } = useBusiness();

  return (
    <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {businesses.length > 0 ? (
          <div className="relative">
            <select
              value={currentBusiness?.id || ''}
              onChange={(e) => {
                const biz = businesses.find((b) => b.id === e.target.value);
                setCurrentBusiness(biz);
              }}
              className="appearance-none pl-3 pr-9 py-2 bg-surface-subtle border border-slate-200 rounded-xl text-sm font-medium text-ink min-w-[220px] focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
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
          <Link to="/businesses" className="inline-flex items-center gap-2 text-sm text-primary-dark font-medium">
            <Icon name="plus" className="w-4 h-4" /> Create your first chatbot
          </Link>
        )}
        {currentBusiness && (
          <Link to="/plans">
            <Badge color="primary" className="capitalize hover:opacity-80">
              {userPlan || 'free'} plan
            </Badge>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink text-white text-[11px] font-semibold uppercase tracking-wide">
            Admin
          </span>
        )}
        <div className="hidden sm:flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-gradient text-white text-xs font-semibold flex items-center justify-center">
            {initials(user?.email)}
          </div>
          <span className="text-sm text-ink-soft max-w-[180px] truncate">{user?.email}</span>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-ink-muted hover:bg-slate-100 hover:text-ink transition-colors"
        >
          <Icon name="logout" className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
