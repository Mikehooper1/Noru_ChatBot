import { useBusiness } from '../hooks/useBusiness';
import ServicesTable from '../components/services/ServicesTable';

export default function ServicesPage() {
  const { currentBusiness } = useBusiness();

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Services</h2>
      {currentBusiness && <ServicesTable businessId={currentBusiness.id} />}
    </div>
  );
}
