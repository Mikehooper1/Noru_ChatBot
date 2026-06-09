import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBusiness } from '../hooks/useBusiness';
import { useConversations } from '../hooks/useConversations';
import { api } from '../services/api';
import OverviewStats from '../components/dashboard/OverviewStats';
import BotIdentityForm from '../components/dashboard/BotIdentityForm';
import RecentConversations from '../components/dashboard/RecentConversations';
import { Button } from '../components/shared/Button';

export default function Dashboard() {
  const { currentBusiness } = useBusiness();
  const { conversations } = useConversations(currentBusiness?.id);
  const [stats, setStats] = useState({});

  useEffect(() => {
    if (!currentBusiness?.id) return;
    api.getDailyAnalytics(currentBusiness.id).then(setStats).catch(console.error);
  }, [currentBusiness?.id]);

  if (!currentBusiness) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No business found. Run the seed script to create sample data.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex gap-2">
          <Link to="/broadcast"><Button variant="secondary">New Broadcast</Button></Link>
          <Link to="/appointments"><Button variant="secondary">View Appointments</Button></Link>
        </div>
      </div>

      <OverviewStats stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BotIdentityForm business={currentBusiness} />
        <RecentConversations conversations={conversations} />
      </div>
    </div>
  );
}
