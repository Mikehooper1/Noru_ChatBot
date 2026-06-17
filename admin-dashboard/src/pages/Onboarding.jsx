import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp, db } from '../firebase/firestore';
import { logout } from '../firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../hooks/useBusiness';
import { createBusiness } from '../utils/createBusiness';
import { api } from '../services/api';
import { PLANS, channelAllowed } from '../constants/plans';
import { Input, Select } from '../components/shared/Input';
import { Button } from '../components/shared/Button';
import Icon from '../components/shared/Icon';

const STEPS = ['Business', 'Channels', 'Plan'];

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    document.body.appendChild(script);
  });
}

export default function Onboarding() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { businesses, loading: bizLoading, setCurrentBusiness } = useBusiness();
  const navigate = useNavigate();

  useEffect(() => {
    if (bizLoading) return;
    if (businesses.length > 0 || userProfile?.onboardingComplete) {
      navigate('/dashboard', { replace: true });
    }
  }, [bizLoading, businesses.length, userProfile?.onboardingComplete, navigate]);

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [details, setDetails] = useState({ name: '', type: 'clinic', botName: '', slug: '' });
  const [channels, setChannels] = useState({
    whatsappPhoneNumberId: '',
    whatsappAccessToken: '',
    whatsappVerifyToken: '',
    telegramBotToken: '',
    telegramBotUsername: '',
  });
  const [selectedPlan, setSelectedPlan] = useState('free');

  const updateDetails = (key) => (e) => setDetails((d) => ({ ...d, [key]: e.target.value }));
  const updateChannel = (key) => (e) => setChannels((c) => ({ ...c, [key]: e.target.value }));

  const next = () => {
    setError('');
    if (step === 0 && !details.name.trim()) {
      setError('Please enter your business name.');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
  };

  const saveChannelTokens = async (businessId) => {
    const wantsWhatsApp = channels.whatsappPhoneNumberId.trim() || channels.whatsappAccessToken.trim();
    if (wantsWhatsApp) {
      await api.saveWhatsAppConfig({
        businessId,
        phoneNumberId: channels.whatsappPhoneNumberId.trim(),
        accessToken: channels.whatsappAccessToken.trim(),
        verifyToken: channels.whatsappVerifyToken.trim(),
        enabled: channelAllowed(selectedPlan, 'whatsapp') && !!channels.whatsappAccessToken.trim(),
      });
    }

    if (channels.telegramBotToken.trim()) {
      await setDoc(
        doc(db, 'businesses', businessId, 'channels', 'telegram'),
        {
          enabled: channelAllowed(selectedPlan, 'telegram'),
          botToken: channels.telegramBotToken.trim(),
          botUsername: channels.telegramBotUsername.trim(),
        },
        { merge: true }
      );
    }
  };

  const runPayment = async () => {
    if (selectedPlan === 'free') return;
    setStatusMsg('Opening secure checkout...');
    const order = await api.createPaymentOrder(selectedPlan);

    if (order.mock || order.keyId === 'mock_key') {
      await api.verifyPayment({
        orderId: order.orderId,
        paymentId: `mock_pay_${Date.now()}`,
        signature: 'mock',
        planId: selectedPlan,
      });
      await refreshUserProfile();
      return;
    }

    await loadRazorpayScript();
    await new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Noru ChatBot',
        description: `${order.planName} Plan — ${details.name}`,
        order_id: order.orderId,
        handler: async (response) => {
          try {
            await api.verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              planId: selectedPlan,
            });
            await refreshUserProfile();
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        prefill: { email: user?.email || '', name: details.name },
        theme: { color: '#4F46E5' },
        modal: { ondismiss: () => reject(new Error('Payment cancelled. Your plan was not changed.')) },
      });
      rzp.on('payment.failed', (resp) =>
        reject(new Error(resp.error?.description || 'Payment failed. Please try again.'))
      );
      rzp.open();
    });
  };

  const finish = async () => {
    if (!user) return;
    setWorking(true);
    setError('');
    try {
      setStatusMsg('Creating your business...');
      const created = await createBusiness({
        user,
        name: details.name,
        type: details.type,
        botName: details.botName,
        slug: details.slug,
      });

      setStatusMsg('Saving channel settings...');
      await saveChannelTokens(created.id).catch((err) => {
        // Don't block onboarding if optional token save fails — surface later.
        console.error('Channel token save failed:', err);
      });

      await runPayment();

      setStatusMsg('Finishing up...');
      await setDoc(
        doc(db, 'users', user.uid),
        {
          plan: selectedPlan,
          onboardingComplete: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await refreshUserProfile();
      setCurrentBusiness(created);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setWorking(false);
      setStatusMsg('');
    }
  };

  if (bizLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <div className="w-10 h-10 rounded-xl bg-brand-gradient animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center">
            <Icon name="bot" className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-ink">Noru</span>
        </div>
        <button onClick={logout} className="text-sm text-ink-muted hover:text-ink">
          Sign out
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                    i <= step ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-xs mt-1 ${i <= step ? 'text-ink font-medium' : 'text-slate-400'}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-primary' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8">
          {error && <div className="mb-5 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-ink">Tell us about your business</h2>
                <p className="text-sm text-ink-muted mt-1">This sets up your AI agent and chat widget.</p>
              </div>
              <Input label="Business Name" value={details.name} onChange={updateDetails('name')} placeholder="Glow Clinic" />
              <Input label="Bot Name" value={details.botName} onChange={updateDetails('botName')} placeholder="GlowBot (optional)" />
              <Select
                label="Business Type"
                value={details.type}
                onChange={updateDetails('type')}
                options={[
                  { value: 'clinic', label: 'Clinic' },
                  { value: 'hospital', label: 'Hospital' },
                  { value: 'salon', label: 'Salon' },
                  { value: 'ecommerce', label: 'E-commerce' },
                  { value: 'saas', label: 'SaaS' },
                ]}
              />
              <Input label="Slug (optional)" value={details.slug} onChange={updateDetails('slug')} placeholder="glow-clinic" />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-ink">Connect your channels</h2>
                <p className="text-sm text-ink-muted mt-1">
                  Your website widget is set up automatically. Add WhatsApp &amp; Telegram tokens now or
                  later from the Channels page. WhatsApp/Telegram require a Pro plan to go live.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="font-semibold text-ink flex items-center gap-2">💬 WhatsApp</p>
                <Input label="Phone Number ID" value={channels.whatsappPhoneNumberId} onChange={updateChannel('whatsappPhoneNumberId')} placeholder="From Meta → WhatsApp → API Setup" />
                <Input label="Access Token" type="password" value={channels.whatsappAccessToken} onChange={updateChannel('whatsappAccessToken')} placeholder="Permanent token from Meta" />
                <Input label="Verify Token" value={channels.whatsappVerifyToken} onChange={updateChannel('whatsappVerifyToken')} placeholder="Matches backend WHATSAPP_VERIFY_TOKEN" />
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="font-semibold text-ink flex items-center gap-2">✈️ Telegram</p>
                <Input label="Bot Token" type="password" value={channels.telegramBotToken} onChange={updateChannel('telegramBotToken')} placeholder="From @BotFather" />
                <Input label="Bot Username" value={channels.telegramBotUsername} onChange={updateChannel('telegramBotUsername')} placeholder="MyClinicBot" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-ink">Choose your plan</h2>
                <p className="text-sm text-ink-muted mt-1">Start free, or pay for WhatsApp &amp; Telegram and more.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {Object.values(PLANS).map((plan) => {
                  const active = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`text-left rounded-xl border p-4 transition-all ${
                        active ? 'border-primary ring-2 ring-primary/20 bg-primary-50/40' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-bold text-ink">{plan.name}</p>
                      <p className="text-lg font-bold mt-1">{plan.priceLabel.split(' ')[0]}</p>
                      <p className="text-[11px] text-ink-muted">{plan.price > 0 ? '/ month' : 'forever'}</p>
                      <ul className="mt-3 space-y-1">
                        {plan.features.slice(0, 4).map((f) => (
                          <li key={f} className="text-[11px] text-ink-soft flex gap-1">
                            <span className="text-green-500">✓</span> {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
              {selectedPlan !== 'free' && (
                <p className="text-sm text-ink-muted">
                  You&apos;ll be charged <strong>{PLANS[selectedPlan].priceLabel}</strong>. Click finish to pay
                  securely via UPI or card.
                </p>
              )}
            </div>
          )}

          {statusMsg && <p className="mt-5 text-sm text-primary">{statusMsg}</p>}

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={back} disabled={step === 0 || working}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={working}>
                Continue
              </Button>
            ) : (
              <Button onClick={finish} disabled={working}>
                {working
                  ? 'Setting up...'
                  : selectedPlan === 'free'
                    ? 'Finish & go live'
                    : `Pay ${PLANS[selectedPlan].priceLabel.split(' ')[0]} & finish`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
