import { NavLink } from 'react-router-dom';
import Icon from '../shared/Icon';

const navSections = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/businesses', label: 'My Chatbots', icon: 'bot' },
      { to: '/agents', label: 'Agent Inbox', icon: 'inbox' },
    ],
  },
  {
    title: 'Build',
    items: [
      { to: '/flows', label: 'Flows', icon: 'flow' },
      { to: '/services', label: 'Services', icon: 'service' },
      { to: '/channels', label: 'Channels', icon: 'channels' },
      { to: '/ai-settings', label: 'AI Settings', icon: 'ai' },
    ],
  },
  {
    title: 'Grow',
    items: [
      { to: '/appointments', label: 'Appointments', icon: 'calendar' },
      { to: '/broadcast', label: 'Broadcast', icon: 'broadcast' },
      { to: '/analytics', label: 'Analytics', icon: 'analytics' },
      { to: '/plans', label: 'Plans', icon: 'card' },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-screen flex flex-col sticky top-0 h-screen">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-lifted">
          <Icon name="bot" className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-ink leading-tight">Noru</h1>
          <p className="text-[11px] text-ink-muted leading-tight">AI Agent Platform</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary-50 text-primary-dark'
                        : 'text-ink-soft hover:bg-slate-50 hover:text-ink'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        name={item.icon}
                        className={`w-[18px] h-[18px] ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-100">
        <div className="rounded-xl bg-brand-gradient p-4 text-white">
          <p className="text-sm font-semibold">Powered by Gemini</p>
          <p className="text-xs text-white/80 mt-0.5">Multi-key failover keeps your agent always online.</p>
        </div>
      </div>
    </aside>
  );
}
