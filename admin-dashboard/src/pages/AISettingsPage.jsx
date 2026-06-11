import { useEffect, useState } from 'react';
import { useBusiness } from '../hooks/useBusiness';
import AISettingsForm from '../components/ai/AISettingsForm';
import { api } from '../services/api';
import { Spinner } from '../components/shared/Card';

export default function AISettingsPage() {
  const { currentBusiness } = useBusiness();
  const [aiConfig, setAiConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentBusiness?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    api
      .getAIConfig(currentBusiness.id)
      .then(setAiConfig)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentBusiness?.id]);

  const handleSaved = (updated) => {
    setAiConfig(updated);
  };

  if (!currentBusiness) {
    return (
      <div className="p-6">
        <p className="text-ink-muted">Select or create a chatbot first.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="page-title">AI Settings</h2>
        <p className="page-subtitle">
          Configure Gemini for <strong>{currentBusiness.name}</strong> — no backend .env needed
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-ink-muted">
          <Spinner /> Loading settings…
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      {!loading && (
        <AISettingsForm
          businessId={currentBusiness.id}
          aiConfig={aiConfig || {}}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
