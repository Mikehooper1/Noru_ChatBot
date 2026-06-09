import { useBusiness } from '../hooks/useBusiness';
import { useFlows } from '../hooks/useFlows';
import FlowBuilder from '../components/flows/FlowBuilder';

export default function FlowsPage() {
  const { currentBusiness } = useBusiness();
  const { flows, loading } = useFlows(currentBusiness?.id);

  if (loading) return <div className="p-6">Loading flows...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Flow Builder</h2>
      {flows.length === 0 ? (
        <p className="text-gray-500">No flows configured. Run the seed script to create sample flows.</p>
      ) : (
        flows.map((flow) => (
          <FlowBuilder key={flow.id} flow={flow} businessId={currentBusiness.id} />
        ))
      )}
    </div>
  );
}
