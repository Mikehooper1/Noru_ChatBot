import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/flows', label: 'Flows', icon: '🔀' },
  { to: '/services', label: 'Services', icon: '🛎️' },
  { to: '/channels', label: 'Channels', icon: '📡' },
  { to: '/ai-settings', label: 'AI Settings', icon: '🤖' },
  { to: '/appointments', label: 'Appointments', icon: '📅' },
  { to: '/broadcast', label: 'Broadcast', icon: '📢' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-primary">Noru ChatBot</h1>
        <p className="text-xs text-gray-500 mt-1">Admin Dashboard</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
