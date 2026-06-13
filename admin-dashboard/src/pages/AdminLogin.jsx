import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginWithEmail, loginWithGoogle, logout } from '../firebase/auth';
import { doc, getDoc, db } from '../firebase/firestore';
import { auth } from '../firebase/auth';
import { Input } from '../components/shared/Input';
import { Button } from '../components/shared/Button';
import Icon from '../components/shared/Icon';

async function assertAdminOrSignOut() {
  const current = auth.currentUser;
  if (!current) throw new Error('Sign in failed.');
  const snap = await getDoc(doc(db, 'users', current.uid));
  const role = snap.exists() ? snap.data().role : 'business';
  if (role !== 'admin') {
    await logout();
    throw new Error('This account is not a platform admin. Use the business sign-in instead.');
  }
}

export default function AdminLogin() {
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
      await loginWithEmail(email.trim(), password);
      await assertAdminOrSignOut();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      await assertAdminOrSignOut();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink p-6">
      <div className="bg-white rounded-2xl shadow-card border border-slate-200/70 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-ink flex items-center justify-center">
            <Icon name="bot" className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Admin Console</h1>
          <p className="text-ink-muted mt-1">Platform administrator sign in</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In as Admin'}
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

        <p className="text-center text-xs text-ink-muted mt-6">
          Are you a business?{' '}
          <Link to="/" className="text-primary font-medium hover:underline">
            Go to business sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
