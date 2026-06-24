import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginWithEmail, registerWithEmail, loginWithGoogle } from '../firebase/auth';
import { Input } from '../components/shared/Input';
import { Button } from '../components/shared/Button';
import Icon from '../components/shared/Icon';
import ThemeToggle from '../components/shared/ThemeToggle';
import { PLANS } from '../constants/plans';

export default function BusinessLanding() {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        await registerWithEmail(form.email.trim(), form.password, form.name.trim());
        navigate('/onboarding');
      } else {
        await loginWithEmail(form.email.trim(), form.password);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      navigate(mode === 'register' ? '/onboarding' : '/dashboard');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface-subtle dark:bg-slate-950 relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {/* Marketing / hero */}
      <div className="hidden lg:flex flex-col justify-between bg-brand-gradient text-white p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="bot" className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold">Noru</span>
        </div>

        <div>
          <h2 className="text-4xl font-bold leading-tight">
            Launch your own AI agent in minutes.
          </h2>
          <p className="mt-4 text-white/80 max-w-md">
            Register your business, connect Website, WhatsApp &amp; Telegram, pick a plan, and your
            AI starts chatting, booking, and reminding customers — automatically.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {Object.values(PLANS).map((p) => (
              <div key={p.id} className="rounded-xl bg-white/10 p-3">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-lg font-bold mt-1">{p.priceLabel.split(' ')[0]}</p>
                <p className="text-[11px] text-white/70">/ month</p>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            {['Self-serve onboarding', 'Connect all your channels', 'Pay with UPI or Card'].map((f) => (
              <div key={f} className="flex items-center gap-3 text-white/90">
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Icon name="check" className="w-3.5 h-3.5" />
                </span>
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/60">© {new Date().getFullYear()} Noru. All rights reserved.</p>
      </div>

      {/* Auth card */}
      <div className="flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-200/70 dark:border-slate-700 p-6 sm:p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="lg:hidden w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-gradient flex items-center justify-center">
              <Icon name="bot" className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink dark:text-slate-100">
              {mode === 'register' ? 'Create your business account' : 'Welcome back'}
            </h1>
            <p className="text-ink-muted dark:text-slate-400 mt-1">
              {mode === 'register'
                ? 'Onboard your business and go live with your AI agent.'
                : 'Sign in to manage your AI chatbot.'}
            </p>
          </div>

          <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl mb-6">
            {[
              { id: 'register', label: 'Register' },
              { id: 'login', label: 'Sign In' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setMode(t.id);
                  setError('');
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === t.id ? 'bg-white dark:bg-slate-600 shadow text-ink dark:text-slate-100' : 'text-ink-muted dark:text-slate-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && <div className="mb-4 alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <Input label="Your Name" value={form.name} onChange={update('name')} placeholder="Enter your name" required />
            )}
            <Input label="Email" type="email" value={form.email} onChange={update('email')} required />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder={mode === 'register' ? 'At least 6 characters' : ''}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Please wait...'
                : mode === 'register'
                  ? 'Create account & continue'
                  : 'Sign In'}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-600" />
            <span className="text-xs text-gray-400 dark:text-slate-500">OR</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-600" />
          </div>

          <Button variant="secondary" className="w-full" onClick={handleGoogle} disabled={loading}>
            Continue with Google
          </Button>

          <p className="text-center text-xs text-ink-muted dark:text-slate-400 mt-6">
            Platform administrator?{' '}
            <Link to="/admin/login" className="text-primary font-medium hover:underline">
              Admin sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
