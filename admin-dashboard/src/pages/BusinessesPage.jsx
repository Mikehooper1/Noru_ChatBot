import { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, setDoc, deleteDoc, getDocs, writeBatch, serverTimestamp } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../hooks/useBusiness';
import { canCreateAgent, getAgentLimit } from '../constants/plans';
import { Button } from '../components/shared/Button';
import { Input, Select } from '../components/shared/Input';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

export default function BusinessesPage() {
  const { user, isAdmin, userPlan } = useAuth();
  const { businesses, currentBusiness, setCurrentBusiness, ownedCount } = useBusiness();
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    type: 'clinic',
    botName: '',
    slug: '',
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');



  // Helper to delete all docs in a subcollection (batched)
  const deleteSubcollection = async (parentPath, subName) => {
    const snap = await getDocs(collection(db, parentPath, subName));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  };

  const deleteBusiness = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');

    const bizId = deleteTarget.id;
    const bizPath = `businesses/${bizId}`;

    try {
      // Delete known subcollections
      await deleteSubcollection(bizPath, 'channels');
      await deleteSubcollection(bizPath, 'aiConfig');
      await deleteSubcollection(bizPath, 'flows');

      // Delete conversations and their nested messages
      const convoSnap = await getDocs(collection(db, bizPath, 'conversations'));
      for (const convoDoc of convoSnap.docs) {
        const msgSnap = await getDocs(collection(db, bizPath, 'conversations', convoDoc.id, 'messages'));
        if (!msgSnap.empty) {
          const msgBatch = writeBatch(db);
          msgSnap.docs.forEach((m) => msgBatch.delete(m.ref));
          await msgBatch.commit();
        }
        await deleteDoc(convoDoc.ref);
      }

      // Delete the business document itself
      await deleteDoc(doc(db, 'businesses', bizId));

      // If the deleted bot was the active one, clear selection
      if (currentBusiness?.id === bizId) {
        const remaining = businesses.filter((b) => b.id !== bizId);
        setCurrentBusiness(remaining[0] || null);
      }

      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete chatbot failed:', err);
      setDeleteError(err.message || 'Failed to delete chatbot.');
    } finally {
      setDeleting(false);
    }
  };

  const createBusiness = async () => {
    if (!user || !form.name.trim()) return;

    if (!isAdmin && !canCreateAgent(userPlan, ownedCount, isAdmin)) {
      setError(`Your ${userPlan} plan allows up to ${getAgentLimit(userPlan)} AI agent(s). Upgrade in Plans to create more.`);
      return;
    }

    setCreating(true);
    setError('');

    const name = form.name.trim();
    const slug = form.slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const botName = form.botName.trim() || `${name} Bot`;
    const bizRef = doc(collection(db, 'businesses'));
    const businessId = bizRef.id;

    try {
      // Create business doc first so subcollection rules can verify ownership
      await setDoc(bizRef, {
        name,
        slug,
        type: form.type,
        ownerId: user.uid,
        adminIds: [user.uid],
        botName,
        botAvatar: '',
        welcomeMessage: `Hello! Welcome to ${name}. How can I help you?`,
        timezone: 'Asia/Kolkata',
        language: 'en',
        isActive: true,
        plan: 'free',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const channels = ['whatsapp', 'telegram', 'website', 'instagram', 'phone'];
      const channelWrites = channels.map((ch) =>
        setDoc(doc(db, 'businesses', businessId, 'channels', ch), {
          enabled: ch === 'website',
          ...(ch === 'website' && {
            primaryColor: '#4F46E5',
            position: 'bottom-right',
            allowedDomains: ['localhost'],
            embedCode: `<script>window.BotConfig={businessId:"${businessId}",primaryColor:"#4F46E5",position:"bottom-right",backendUrl:"${BACKEND_URL}"};</script><script src="${BACKEND_URL}/widget.min.js" defer></script>`,
          }),
        })
      );

      await Promise.all([
        ...channelWrites,
        setDoc(doc(db, 'businesses', businessId, 'aiConfig', 'default'), {
          modelTier: 'free',
          model: 'gemini-2.5-flash',
          systemPrompt: `You are a helpful assistant for ${name}.`,
          temperature: 0.7,
          maxTokens: 1024,
          tone: 'friendly',
          enableHandoff: true,
          enableAI: true,
          handoffTriggers: ['human', 'agent', 'help'],
          handoffMessage: 'Connecting you to a human agent. Please wait...',
          fallbackMessage: 'How can I help you today? Please choose an option below.',
          language: 'en',
          knowledgeBase: '',
          updatedAt: serverTimestamp(),
        }),
        setDoc(doc(db, 'businesses', businessId, 'flows', 'main-flow'), {
          name: 'Main Flow',
          trigger: 'book',
          isActive: true,
          order: 1,
          steps: [
            { id: 's1', type: 'message', message: `Welcome to ${name}! How can we help?`, quickReplies: ['Book appointment', 'Talk to agent'], inputType: null, nextStepId: 's2', conditions: [{ if: 'Talk to agent', goto: 's3' }] },
            { id: 's2', type: 'question', message: 'What date works for you? (DD-MM-YYYY)', quickReplies: [], inputType: 'date', nextStepId: 's4', conditions: [] },
            { id: 's3', type: 'handoff', message: 'Connecting you to an agent...', quickReplies: [], inputType: null, nextStepId: null, conditions: [] },
            { id: 's4', type: 'question', message: 'What time? (e.g. 14:00)', quickReplies: [], inputType: 'text', nextStepId: 's5', conditions: [] },
            { id: 's5', type: 'booking', message: 'Booking your appointment!', quickReplies: [], inputType: null, nextStepId: null, conditions: [] },
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ]);

      setShowForm(false);
      setForm({ name: '', type: 'clinic', botName: '', slug: '' });
      setCurrentBusiness({
        id: businessId,
        name,
        slug,
        botName,
        type: form.type,
        plan: 'free',
        ownerId: user.uid,
      });
    } catch (err) {
      console.error('Create chatbot failed:', err);
      setError(err.message || 'Failed to create chatbot. Deploy updated Firestore rules and try again.');
    } finally {
      setCreating(false);
    }
  };

  const atAgentLimit = !isAdmin && !canCreateAgent(userPlan, ownedCount, isAdmin);
  const agentLimit = getAgentLimit(userPlan);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{isAdmin ? 'All Businesses' : 'My Chatbots'}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin
              ? `${businesses.length} business${businesses.length !== 1 ? 'es' : ''} across the platform`
              : `${ownedCount} of ${agentLimit} AI agent${agentLimit !== 1 ? 's' : ''} on ${userPlan} plan`}
          </p>
        </div>
        {atAgentLimit ? (
          <Link to="/plans">
            <Button variant="secondary">Upgrade to add agents</Button>
          </Link>
        ) : (
          <Button onClick={() => { setShowForm(true); setError(''); }}>
            + New Chatbot
          </Button>
        )}
      </div>

      {atAgentLimit && (
        <div className="mb-4 p-3 bg-amber-50 text-amber-900 rounded-lg text-sm">
          You&apos;ve reached the {agentLimit}-agent limit on your {userPlan} plan.{' '}
          <Link to="/plans" className="font-medium underline">Upgrade your plan</Link> to create more.
        </div>
      )}



      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {businesses.map((biz) => (
          <div
            key={biz.id}
            className={`bg-white rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow relative group ${
              currentBusiness?.id === biz.id ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
            }`}
            onClick={() => setCurrentBusiness(biz)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{biz.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{biz.type}</span>
                {(biz.ownerId === user?.uid || isAdmin) && (
                  <button
                    id={`delete-chatbot-${biz.id}`}
                    title="Delete chatbot"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(biz);
                      setDeleteError('');
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500">{biz.botName}</p>
            <p className="text-xs text-gray-400 mt-2 capitalize">{biz.type} · {biz.slug}</p>
            {currentBusiness?.id === biz.id && (
              <p className="text-xs text-primary mt-2 font-medium">● Active in dashboard</p>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Chatbot</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-gray-700">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? All conversations, flows, AI config, and channel settings will be permanently removed.
            </p>

            {deleteError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{deleteError}</div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={deleteBusiness} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Create New Chatbot</h3>
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}
            <Input label="Business Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Clinic" />
            <Input label="Bot Name" value={form.botName} onChange={(e) => setForm({ ...form, botName: e.target.value })} placeholder="HealthBot" />
            <Select
              label="Business Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[
                { value: 'clinic', label: 'Clinic' },
                { value: 'hospital', label: 'Hospital' },
                { value: 'salon', label: 'Salon' },
                { value: 'ecommerce', label: 'E-commerce' },
                { value: 'saas', label: 'SaaS' },
              ]}
            />
            <Input label="Slug (optional)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="my-clinic" />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)} disabled={creating}>Cancel</Button>
              <Button onClick={createBusiness} disabled={creating || !form.name.trim()}>
                {creating ? 'Creating...' : 'Create Chatbot'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
