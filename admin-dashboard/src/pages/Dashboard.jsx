import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, doc, deleteDoc, getDocs, writeBatch } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useBusiness } from '../hooks/useBusiness';
import { useConversations } from '../hooks/useConversations';
import { api } from '../services/api';
import OverviewStats from '../components/dashboard/OverviewStats';
import BotIdentityForm from '../components/dashboard/BotIdentityForm';
import RecentConversations from '../components/dashboard/RecentConversations';
import { Button } from '../components/shared/Button';
import Icon from '../components/shared/Icon';
import { EmptyState } from '../components/shared/Card';

export default function Dashboard() {
  const { currentBusiness, businesses, setCurrentBusiness } = useBusiness();
  const { conversations } = useConversations(currentBusiness?.id);
  const [stats, setStats] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentBusiness?.id) return;
    api.getDailyAnalytics(currentBusiness.id).then(setStats).catch(console.error);
  }, [currentBusiness?.id]);

  // Helper to delete all docs in a subcollection (batched)
  const deleteSubcollection = async (parentPath, subName) => {
    const snap = await getDocs(collection(db, parentPath, subName));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  };

  const deleteChatbot = async () => {
    if (!currentBusiness) return;
    setDeleting(true);
    setDeleteError('');

    const bizId = currentBusiness.id;
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

      // Switch to next available chatbot or redirect
      const remaining = businesses.filter((b) => b.id !== bizId);
      setCurrentBusiness(remaining[0] || null);
      setShowDeleteModal(false);

      if (remaining.length === 0) {
        navigate('/businesses');
      }
    } catch (err) {
      console.error('Delete chatbot failed:', err);
      setDeleteError(err.message || 'Failed to delete chatbot.');
    } finally {
      setDeleting(false);
    }
  };

  if (!currentBusiness) {
    return (
      <div className="page-container">
        <div className="card">
          <EmptyState
            icon={<Icon name="bot" className="w-6 h-6" />}
            title="No chatbot yet"
            description="Create your first AI chatbot agent to start chatting with customers on your website, WhatsApp and Telegram."
            action={<Link to="/businesses"><Button><Icon name="plus" className="w-4 h-4" /> Create chatbot</Button></Link>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <div className="page-header !mb-0">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Overview for <span className="font-medium text-ink-soft dark:text-slate-300">{currentBusiness.name}</span></p>
        </div>
        <div className="page-actions">
          <Link to="/agents"><Button variant="secondary"><Icon name="inbox" className="w-4 h-4" /> Agent Inbox</Button></Link>
          <Link to="/appointments"><Button variant="secondary"><Icon name="calendar" className="w-4 h-4" /> Appointments</Button></Link>
          <Button
            id="delete-current-chatbot"
            variant="danger"
            onClick={() => { setShowDeleteModal(true); setDeleteError(''); }}
          >
            <Icon name="trash" className="w-4 h-4" /> Delete
          </Button>
        </div>
      </div>

      <OverviewStats stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BotIdentityForm business={currentBusiness} />
        <RecentConversations conversations={conversations} />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal-panel max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Delete Chatbot</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-slate-300">
              Are you sure you want to delete <strong>{currentBusiness.name}</strong>? All conversations, flows, AI config, and channel settings will be permanently removed.
            </p>

            {deleteError && (
              <div className="alert-error">{deleteError}</div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={deleteChatbot} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
