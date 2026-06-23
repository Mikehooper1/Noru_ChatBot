import { useEffect, useState } from 'react';
import { doc, onSnapshot } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useBusiness } from '../hooks/useBusiness';
import { useAuth } from '../contexts/AuthContext';
import ChannelToggle from '../components/channels/ChannelToggle';

const channels = [
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'telegram', label: 'Telegram', icon: '✈️' },
  { id: 'email', label: 'Email', icon: '📧' },
  { id: 'website', label: 'Website Widget', icon: '🌐' },
  { id: 'phone', label: 'Phone Voice AI', icon: '📞' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
];

export default function ChannelsPage() {
  const { userPlan } = useAuth();
  const { currentBusiness } = useBusiness();
  const [configs, setConfigs] = useState({});

  useEffect(() => {
    if (!currentBusiness?.id) return;
    const unsubs = channels.map((ch) =>
      onSnapshot(doc(db, 'businesses', currentBusiness.id, 'channels', ch.id), (snap) => {
        setConfigs((prev) => ({ ...prev, [ch.id]: snap.exists() ? snap.data() : {} }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [currentBusiness?.id]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Channels</h2>
      <div className="space-y-4">
        {channels.map((ch) => (
          <ChannelToggle
            key={`${currentBusiness?.id}-${ch.id}`}
            businessId={currentBusiness?.id}
            channel={ch.id}
            config={configs[ch.id]}
            plan={userPlan || 'free'}
            label={ch.label}
            icon={ch.icon}
          />
        ))}
      </div>
    </div>
  );
}
