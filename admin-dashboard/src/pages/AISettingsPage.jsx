import { useEffect, useState } from 'react';
import { doc, onSnapshot } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useBusiness } from '../hooks/useBusiness';
import AISettingsForm from '../components/ai/AISettingsForm';

export default function AISettingsPage() {
  const { currentBusiness } = useBusiness();
  const [aiConfig, setAiConfig] = useState(null);

  useEffect(() => {
    if (!currentBusiness?.id) return;
    const unsub = onSnapshot(
      doc(db, 'businesses', currentBusiness.id, 'aiConfig', 'default'),
      (snap) => setAiConfig(snap.exists() ? snap.data() : null)
    );
    return unsub;
  }, [currentBusiness?.id]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">AI Settings</h2>
      {currentBusiness && aiConfig && (
        <AISettingsForm businessId={currentBusiness.id} aiConfig={aiConfig} />
      )}
    </div>
  );
}
