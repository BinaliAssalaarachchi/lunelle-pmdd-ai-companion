import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState } from '../components/ui/states.jsx';
import { usePartnerConnect } from '../hooks/usePartnerConnect.js';

function ConnectCard({ children }) {
  return (
    <section className="card space-y-4 p-5 sm:p-6">{children}</section>
  );
}

function PrivacyNote() {
  return (
    <div className="rounded-2xl border border-white/60 bg-cream/45 px-4 py-3 text-sm leading-relaxed text-moss">
      <p className="font-semibold text-ink">
        Doctor Coach conversations are always private.
      </p>
      <p className="mt-1">
        Nothing from Doctor Coach is shared with a partner — there is no setting
        to change that.
      </p>
    </div>
  );
}

function OwnerManageRedirect() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="eyebrow mb-3">Partner sharing</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">
          Connect
        </h1>
      </header>
      <ConnectCard>
        <p className="text-base leading-relaxed text-moss">
          You manage partner sharing from your Profile settings.
        </p>
        <Link
          to="/profile"
          className="btn-accent inline-flex min-h-[48px] px-6 py-3 text-sm"
        >
          Go to Profile
        </Link>
      </ConnectCard>
      <PrivacyNote />
    </div>
  );
}

function DeclinedState({ onReset }) {
  return (
    <ConnectCard>
      <p className="text-base font-semibold text-ink">Invitation declined</p>
      <p className="text-base leading-relaxed text-moss">
        This connection code can no longer be used. If they invite you again,
        you can enter a new code here.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="btn-login-soft min-h-[44px] px-5 py-2.5 text-sm"
      >
        Enter a connection code
      </button>
    </ConnectCard>
  );
}

function ConnectForm({ onAccept, onDecline, busy, error, initialCode = '' }) {
  const [code, setCode] = useState(initialCode);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  function clearCode() {
    setCode('');
  }

  async function handleAccept(event) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    try {
      await onAccept(trimmed);
    } finally {
      clearCode();
    }
  }

  async function handleDecline() {
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    try {
      await onDecline(trimmed);
    } finally {
      clearCode();
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleAccept}>
      <label className="block">
        <span className="mb-1.5 block text-base font-semibold text-ink">
          Private connection code
        </span>
        <input
          type="text"
          name="connectionCode"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={busy}
          placeholder="Paste the code they shared with you"
          className="input-field min-h-[44px] w-full px-3 py-3 text-base"
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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="btn-accent min-h-[48px] px-6 py-3 text-sm"
        >
          {busy ? 'Connecting…' : 'Accept invitation'}
        </button>
        <button
          type="button"
          disabled={busy || !code.trim()}
          onClick={handleDecline}
          className="btn-login-soft min-h-[48px] px-6 py-3 text-sm"
        >
          Decline
        </button>
      </div>
    </form>
  );
}

export default function PartnerConnect() {
  const {
    loading,
    busy,
    error,
    outcome,
    pageMode,
    inviteCodeFromUrl,
    accept,
    decline,
    clearOutcome,
  } = usePartnerConnect();

  if (loading || pageMode === 'already_active') {
    return (
      <div className="mx-auto max-w-xl">
        <LoadingState message="Loading…" />
      </div>
    );
  }

  if (pageMode === 'owner_manage') {
    return <OwnerManageRedirect />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-10">
      <header>
        <p className="eyebrow mb-3">Partner sharing</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">
          Connect to someone you care about
        </h1>
        <p className="mt-3 text-base leading-relaxed text-moss">
          {inviteCodeFromUrl
            ? 'Connecting you to their shared space…'
            : 'Enter the private connection code they shared with you. What you can see depends on what they\u2019ve chosen to share.'}
        </p>
      </header>

      {outcome === 'declined' ? (
        <DeclinedState onReset={clearOutcome} />
      ) : (
        <ConnectCard>
          <ConnectForm
            onAccept={accept}
            onDecline={decline}
            busy={busy}
            error={error}
            initialCode={inviteCodeFromUrl}
          />
        </ConnectCard>
      )}

      <PrivacyNote />
    </div>
  );
}
