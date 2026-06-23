import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { useBusiness } from '../hooks/useBusiness';
import { useAuth } from '../contexts/AuthContext';
import { PLANS, getAgentLimit } from '../constants/plans';
import { Button } from '../components/shared/Button';
import UpgradeChat from '../components/plans/UpgradeChat';
import { api } from '../services/api';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    document.body.appendChild(script);
  });
}

export default function PlansPage() {
  const { user, userPlan, userProfile, refreshUserProfile } = useAuth();
  const { ownedCount } = useBusiness();
  const [paying, setPaying] = useState(null);
  const [message, setMessage] = useState('');

  const currentPlan = userPlan || 'free';
  const agentLimit = getAgentLimit(currentPlan);

  const startPayment = async (planId) => {
    if (planId === 'free') return;
    setPaying(planId);
    setMessage('');

    try {
      const order = await api.createPaymentOrder(planId);

      if (order.mock || order.keyId === 'mock_key') {
        await api.verifyPayment({
          orderId: order.orderId,
          paymentId: `mock_pay_${Date.now()}`,
          signature: 'mock',
          planId,
        });
        await refreshUserProfile();
        setMessage(`✅ ${PLANS[planId].name} plan activated! Valid for 30 days. You can create up to ${PLANS[planId].businesses} AI agents.`);
        setPaying(null);
        return;
      }

      await loadRazorpayScript();

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Noru ChatBot',
        description: `${order.planName} Plan`,
        order_id: order.orderId,
        handler: async (response) => {
          try {
            await api.verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              planId,
            });
            await refreshUserProfile();
            setMessage(`✅ Payment successful! ${PLANS[planId].name} plan activated for 30 days.`);
          } catch (err) {
            setMessage(`Payment verification failed: ${err.message}`);
          }
          setPaying(null);
        },
        prefill: { email: user?.email || '' },
        theme: { color: '#4F46E5' },
        method: { upi: true, card: true, netbanking: true },
      });

      rzp.on('payment.failed', (resp) => {
        setMessage(`Payment failed: ${resp.error?.description || 'Try again'}`);
        setPaying(null);
      });

      rzp.open();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setPaying(null);
    }
  };

  const downgradeToFree = async () => {
    if (!user?.uid) return;
    await updateDoc(doc(db, 'users', user.uid), {
      plan: 'free',
      planExpiresAt: null,
      planUpdatedAt: serverTimestamp(),
    });
    await refreshUserProfile();
    setMessage('Downgraded to Free plan. You can keep 1 AI agent with 24-hour chat memory.');
  };

  return (
    <div className="page-container">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Plans & Billing</h2>
        <p className="text-gray-500 mt-1">
          Your account is on the{' '}
          <span className="text-primary font-semibold capitalize">{currentPlan}</span> plan —{' '}
          {ownedCount} of {agentLimit} AI agent{agentLimit !== 1 ? 's' : ''} in use
        </p>
        {userProfile?.planExpiresAt && (
          <p className="text-xs text-gray-400 mt-1">
            Expires:{' '}
            {(userProfile.planExpiresAt.toDate?.() ||
              new Date((userProfile.planExpiresAt.seconds || 0) * 1000)
            ).toLocaleDateString()}
          </p>
        )}
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${message.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <UpgradeChat currentPlan={currentPlan} onSelectPlan={(planId) => startPayment(planId)} paying={paying} />

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">What your AI agent does</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
              <span>💬</span>
              <div><strong>Chat</strong> — AI talks to customers on Website, WhatsApp, Telegram</div>
            </div>
            <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
              <span>📅</span>
              <div><strong>Book</strong> — Takes appointments through conversation flows</div>
            </div>
            <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
              <span>🔔</span>
              <div><strong>Remind</strong> — Sends appointment reminders (Pro+)</div>
            </div>
            <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
              <span>🤖</span>
              <div><strong>Answer</strong> — AI handles questions flows don&apos;t cover</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.values(PLANS).map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-6 flex flex-col ${
                isCurrent ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
              }`}
            >
              {isCurrent && <span className="text-xs font-semibold text-primary mb-2">CURRENT PLAN</span>}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-3xl font-bold mt-2">{plan.priceLabel}</p>
              <p className="text-xs text-gray-500 mt-1">Memory: {plan.sessionRetention}</p>
              <ul className="mt-4 space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              {plan.price > 0 ? (
                <Button
                  className="mt-6 w-full"
                  disabled={isCurrent || paying === plan.id}
                  onClick={() => startPayment(plan.id)}
                >
                  {isCurrent ? 'Current Plan' : paying === plan.id ? 'Opening checkout...' : `Pay ₹${plan.price} — UPI / Card`}
                </Button>
              ) : isCurrent ? (
                <Button variant="secondary" className="mt-6 w-full" disabled>Current Plan</Button>
              ) : (
                <Button variant="secondary" className="mt-6 w-full" onClick={downgradeToFree}>
                  Switch to Free
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
