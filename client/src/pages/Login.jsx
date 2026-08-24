import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { BrandLockup } from '../components/ui/BrandMark.jsx';
import { navigateAfterAuth } from '../lib/partnerPostAuth.js';

export default function Login() {
  const { user, loading, login, loginDemo, configured, getIdToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  if (!loading && user) {
    return <Navigate to={location.state?.from || '/'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const signedIn = await login(email.trim(), password);
      await navigateAfterAuth({
        getIdToken,
        userId: signedIn.uid,
        navigate,
        location,
      });
    } catch (err) {
      setError(err.message || 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemo() {
    setDemoLoading(true);
    setError('');
    try {
      await loginDemo();
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err.message ||
          'Demo account unavailable. Run `npm run seed` in server/ first.',
      );
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="welcome-ambient flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Link to="/welcome" className="mb-8 flex min-h-[44px] items-center">
        <BrandLockup markClassName="h-11 w-11" textClassName="text-3xl" />
      </Link>

      <div className="auth-glass w-full max-w-md p-7 sm:p-9">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Welcome back
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-moss">
          Sign in to continue your check-ins.
        </p>

        {!configured ? (
          <p className="mt-6 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
            Firebase client config is missing in <code>client/.env</code>.
          </p>
        ) : null}

        <button
          type="button"
          disabled={demoLoading || !configured}
          onClick={handleDemo}
          className="btn-demo mt-7 min-h-[52px] w-full px-4 py-3 text-sm"
        >
          {demoLoading ? 'Opening demo…' : 'Continue with Demo'}
        </button>
        <p className="mt-2.5 text-center text-xs text-moss">
          Maya · 28 days of seeded PMDD symptom data
        </p>

        <div className="my-7 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          <span className="h-px flex-1 bg-line/70" />
          or with email
          <span className="h-px flex-1 bg-line/70" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {submitting ? 'Signing in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-moss">
          New here?{' '}
          <Link to="/signup" state={location.state} className="link-accent">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
