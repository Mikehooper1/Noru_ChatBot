import { useBusiness } from '../hooks/useBusiness';
import ServicesTable from '../components/services/ServicesTable';

export default function ServicesPage() {
  const { currentBusiness } = useBusiness();

  return (
    <div className="page-container">
      <h2 className="text-2xl font-bold mb-2">Products & Services</h2>
      <p className="text-gray-600 mb-6">Manage your catalog — the AI agent uses these items for recommendations, budget checks, and bookings.</p>
      {currentBusiness && <ServicesTable businessId={currentBusiness.id} />}
    </div>
  );
}
