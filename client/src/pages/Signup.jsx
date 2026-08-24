import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { BrandLockup } from '../components/ui/BrandMark.jsx';
import { navigateAfterAuth } from '../lib/partnerPostAuth.js';

export default function Signup() {
  const { user, loading, signup, configured, getIdToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={location.state?.from || '/'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const signedIn = await signup(email.trim(), password, displayName.trim());
      await navigateAfterAuth({
        getIdToken,
        userId: signedIn.uid,
        navigate,
        location,
      });
    } catch (err) {
      setError(err.message || 'Could not create account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="welcome-ambient flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Link to="/welcome" className="mb-8 flex min-h-[44px] items-center">
        <BrandLockup markClassName="h-11 w-11" textClassName="text-3xl" />
      </Link>

      <div className="auth-glass w-full max-w-md p-7 sm:p-9">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Create your account
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-moss">
          Your personal cycle and symptom information stays private to your
          account.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block">
            <span className="eyebrow mb-2 block">Name</span>
            <input
              type="text"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="input-field min-h-[48px] px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="eyebrow mb-2 block">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-field min-h-[48px] px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="eyebrow mb-2 block">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field min-h-[48px] px-4 py-3 text-sm"
            />
          </label>
          {error ? (
            <p
              className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-ink"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting || !configured}
            className="btn-brand-mix min-h-[48px] w-full px-4 py-3.5 text-sm"
          >
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-moss">
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="link-accent">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
