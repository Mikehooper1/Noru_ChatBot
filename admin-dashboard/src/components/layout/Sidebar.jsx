import { NavLink } from 'react-router-dom';
import { useLayout } from '../../contexts/LayoutContext';
import { navSections } from '../../constants/navigation';
import Icon from '../shared/Icon';

export default function Sidebar() {
  const { sidebarOpen, closeSidebar } = useLayout();

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          aria-label="Close navigation menu"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto w-64 min-h-screen h-screen flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-lifted flex-shrink-0">
            <Icon name="bot" className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-ink dark:text-slate-100 leading-tight">Noru</h1>
            <p className="text-[11px] text-ink-muted dark:text-slate-400 leading-tight">AI Agent Platform</p>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400"
            aria-label="Close menu"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={closeSidebar}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary-50 text-primary-dark dark:bg-primary/20 dark:text-primary-light'
                          : 'text-ink-soft dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-ink dark:hover:text-slate-100'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          name={item.icon}
                          className={`w-[18px] h-[18px] flex-shrink-0 ${
                            isActive
                              ? 'text-primary dark:text-primary-light'
                              : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                          }`}
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

        <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800">
          <div className="rounded-xl bg-brand-gradient p-4 text-white">
            <p className="text-sm font-semibold">Powered by Gemini</p>
            <p className="text-xs text-white/80 mt-0.5">Multi-key failover keeps your agent always online.</p>
          </div>
        </div>
      </aside>
    </>
  );
}
