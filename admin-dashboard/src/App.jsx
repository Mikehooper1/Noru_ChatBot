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

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto">{children}</main>
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
