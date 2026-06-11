import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithEmail, loginWithGoogle } from '../firebase/auth';
import { Input } from '../components/shared/Input';
import { Button } from '../components/shared/Button';
import Icon from '../components/shared/Icon';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await loginWithEmail(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface-subtle">
      <div className="hidden lg:flex flex-col justify-between bg-brand-gradient text-white p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="bot" className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold">Noru</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">Your AI agent that chats, books, and reminds — everywhere.</h2>
          <p className="mt-4 text-white/80 max-w-md">Website, WhatsApp & Telegram. Powered by Gemini with automatic multi-key failover so your agent never goes down.</p>
          <div className="mt-8 space-y-3">
            {['Answers customers 24/7', 'Takes bookings automatically', 'Sends appointment reminders'].map((f) => (
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

      <div className="flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-card border border-slate-200/70 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="lg:hidden w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-gradient flex items-center justify-center">
            <Icon name="bot" className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
          <p className="text-ink-muted mt-1">Sign in to your admin dashboard</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">OR</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <Button variant="secondary" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
          Continue with Google
        </Button>
      </div>
      </div>
    </div>
  );
}
