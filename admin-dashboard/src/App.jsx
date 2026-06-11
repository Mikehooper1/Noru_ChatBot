import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FlowsPage from './pages/FlowsPage';
import ServicesPage from './pages/ServicesPage';
import ChannelsPage from './pages/ChannelsPage';
import AISettingsPage from './pages/AISettingsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import BroadcastPage from './pages/BroadcastPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AgentsPage from './pages/AgentsPage';
import BusinessesPage from './pages/BusinessesPage';
import PlansPage from './pages/PlansPage';

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient animate-pulse" />
          <p className="text-ink-muted text-sm">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-surface-subtle">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto animate-fade-in">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
      <Route path="/businesses" element={<ProtectedLayout><BusinessesPage /></ProtectedLayout>} />
      <Route path="/agents" element={<ProtectedLayout><AgentsPage /></ProtectedLayout>} />
      <Route path="/plans" element={<ProtectedLayout><PlansPage /></ProtectedLayout>} />
      <Route path="/flows" element={<ProtectedLayout><FlowsPage /></ProtectedLayout>} />
      <Route path="/services" element={<ProtectedLayout><ServicesPage /></ProtectedLayout>} />
      <Route path="/channels" element={<ProtectedLayout><ChannelsPage /></ProtectedLayout>} />
      <Route path="/ai-settings" element={<ProtectedLayout><AISettingsPage /></ProtectedLayout>} />
      <Route path="/appointments" element={<ProtectedLayout><AppointmentsPage /></ProtectedLayout>} />
      <Route path="/broadcast" element={<ProtectedLayout><BroadcastPage /></ProtectedLayout>} />
      <Route path="/analytics" element={<ProtectedLayout><AnalyticsPage /></ProtectedLayout>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
