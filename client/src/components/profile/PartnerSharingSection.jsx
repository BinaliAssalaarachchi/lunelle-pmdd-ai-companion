import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SettingsRow,
  SettingsSection,
  SettingsToggle,
} from './SettingsSection.jsx';
import { LoadingState } from '../ui/states.jsx';
import { PARTNER_PERMISSION_UI } from '../../lib/partnerApi.js';
import { buildPartnerInviteLink } from '../../lib/partnerInviteLink.js';
import { usePartnerSharing } from '../../hooks/usePartnerSharing.js';
import { LeaveSharedSpaceButton } from '../partner/LeaveSharedSpaceButton.jsx';

function IconPartner() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function DoctorCoachPrivacy() {
  return (
    <div className="rounded-2xl border border-white/60 bg-cream/45 px-4 py-3">
      <p className="text-base font-semibold text-ink">
        Doctor Coach conversations are always private.
      </p>
      <p className="mt-1 text-sm leading-relaxed text-moss">
        Nothing from Doctor Coach is shared with a partner — there is no setting
        to change that.
      </p>
    </div>
  );
}

function StatusBadge({ state }) {
  const labels = {
    none: 'Not connected',
    pending: 'Invitation pending',
    active: 'Connected',
    revoked: 'Disconnected',
  };
  const styles = {
    none: 'bg-oat text-moss',
    pending: 'bg-clay-soft text-clay-deep',
    active: 'bg-fern-soft text-pine-deep',
    revoked: 'bg-oat text-moss',
  };
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[state] || styles.none}`}
    >
      {labels[state] || labels.none}
    </span>
  );
}

function InviteForm({ onInvite, busy }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(false);
    try {
      await onInvite(email.trim() || null);
      setEmail('');
      setSubmitted(true);
    } catch {
      // error surfaced by hook
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-base leading-relaxed text-moss">
        Invite someone you trust to see a curated view of what you choose to
        share — never your full private record.
      </p>
      <label className="block">
        <span className="mb-1.5 block text-base font-semibold text-ink">
          Their email <span className="font-normal text-moss">(optional)</span>
        </span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="partner@example.com"
          className="input-field min-h-[44px] w-full px-3 py-3 text-base"
        />
        <span className="mt-1.5 block text-sm text-moss">
          A label for you — Lunelle does not email them automatically.
        </span>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="btn-accent min-h-[48px] px-6 py-3 text-sm"
      >
        {busy ? 'Sending…' : 'Invite someone you trust'}
      </button>
      {submitted ? (
        <p className="rounded-2xl border-2 border-fern bg-cream px-4 py-3 text-sm text-pine-deep">
          Invitation created. Copy the invite link below and send it to your
          partner — they can tap it to connect.
        </p>
      ) : null}
    </form>
  );
}

function OneTimeShareLink({ inviteCode, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const inviteLink = buildPartnerInviteLink(inviteCode);

  async function handleCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-fern/40 bg-fern-soft/40 px-4 py-4">
      <p className="text-base font-semibold text-ink">Invite link</p>
      <p className="mt-1 text-sm leading-relaxed text-moss">
        Send this link to your partner once (text, WhatsApp, etc.). It will not
        appear again after you leave this page.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="max-w-full rounded-xl bg-cream px-3 py-2 text-sm font-medium text-ink break-all">
          {inviteLink || inviteCode}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!inviteLink}
          className="btn-login-soft min-h-[40px] px-4 py-2 text-sm disabled:opacity-50"
        >
          {copied ? 'Copied' : 'Copy invite link'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[40px] px-3 py-2 text-sm font-medium text-moss hover:text-ink"
        >
          Hide
        </button>
      </div>
    </div>
  );
}

function PermissionList({ permissions, onToggle, busyKey }) {
  return (
    <div className="space-y-1">
      <p className="text-base font-semibold text-ink">What they can see</p>
      <p className="mb-2 text-sm text-moss">
        You choose each item. Nothing else is shared.
      </p>
      {PARTNER_PERMISSION_UI.map((item) => (
        <SettingsRow
          key={item.key}
          label={item.title}
          hint={item.description}
        >
          <SettingsToggle
            label={item.title}
            checked={Boolean(permissions[item.key])}
            onChange={(value) => {
              if (busyKey) return;
              onToggle(item.key, value);
            }}
          />
        </SettingsRow>
      ))}
      {busyKey ? (
        <p className="text-sm text-moss" aria-live="polite">
          Updating…
        </p>
      ) : null}
    </div>
  );
}

function RevokeButton({ onRevoke, busy }) {
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    try {
      await onRevoke();
      setConfirming(false);
    } catch {
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirming(true)}
        className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-danger/35 px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger-soft disabled:opacity-50"
      >
        Revoke access
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-danger/25 bg-danger-soft/40 px-4 py-4">
      <p className="text-base leading-relaxed text-ink">
        Your partner will immediately lose access to everything you&apos;ve
        shared through Lunelle.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleConfirm}
          className="min-h-[44px] rounded-full bg-danger px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
        >
          {busy ? 'Revoking…' : 'Yes, revoke access'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(false)}
          className="btn-login-soft min-h-[44px] px-5 py-2.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PartnerRoleNotice({ onLeave, leaveBusy }) {
  return (
    <div className="space-y-4 rounded-2xl bg-cream/55 px-4 py-4">
      <p className="text-base font-semibold text-ink">
        You&apos;re connected as a partner
      </p>
      <p className="text-sm leading-relaxed text-moss">
        Partner view settings are managed by the person who invited you.
      </p>
      <Link
        to="/partner/support"
        className="btn-accent inline-flex min-h-[48px] px-6 py-3 text-sm"
      >
        Open support view
      </Link>
      <LeaveSharedSpaceButton onLeave={onLeave} busy={leaveBusy} />
    </div>
  );
}

export function PartnerSharingSection() {
  const {
    loading,
    error,
    busy,
    permissionBusyKey,
    connection,
    permissions,
    partnerRoleOnly,
    canInvite,
    pendingShareCode,
    dismissShareCode,
    invite,
    setPermission,
    revoke,
    leaveSharedSpace,
  } = usePartnerSharing();

  if (loading) {
    return (
      <SettingsSection
        title="Partner sharing"
        description="Choose what a trusted partner can see."
        icon={<IconPartner />}
      >
        <LoadingState message="Loading partner settings…" />
      </SettingsSection>
    );
  }

  if (partnerRoleOnly) {
    return (
      <SettingsSection
        title="Partner sharing"
        icon={<IconPartner />}
      >
        <PartnerRoleNotice onLeave={leaveSharedSpace} leaveBusy={busy} />
      </SettingsSection>
    );
  }

  const { state, link } = connection;

  return (
    <SettingsSection
      title="Partner sharing"
      description="You're in control of what your partner sees."
      icon={<IconPartner />}
    >
      <div className="space-y-4">
        <StatusBadge state={state} />

        <p className="text-base leading-relaxed text-moss">
          Your private information stays private unless you choose to share it.
        </p>

        {error ? (
          <p
            className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-ink"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {pendingShareCode ? (
          <OneTimeShareLink inviteCode={pendingShareCode} onDismiss={dismissShareCode} />
        ) : null}

        {state === 'none' || (state === 'revoked' && canInvite) ? (
          <>
            {state === 'revoked' ? (
              <p className="text-sm text-moss">
                Your previous partner connection was removed. You can invite
                someone new when you&apos;re ready.
              </p>
            ) : null}
            <InviteForm onInvite={invite} busy={busy} />
            <DoctorCoachPrivacy />
          </>
        ) : null}

        {state === 'pending' && link ? (
          <>
            <div className="rounded-2xl bg-cream/55 px-4 py-4">
              <p className="text-base font-semibold text-ink">
                Waiting for your partner to connect
              </p>
              <p className="mt-1 text-sm leading-relaxed text-moss">
                {link.partnerEmail
                  ? `Invitation for ${link.partnerEmail} is pending.`
                  : 'Your invitation is waiting. Copy the invite link and send it to them.'}
              </p>
            </div>
            {!pendingShareCode ? (
              <p className="text-sm text-moss">
                If you did not copy the invite link yet, revoke this invitation
                and send a new one.
              </p>
            ) : null}
            <DoctorCoachPrivacy />
            <RevokeButton onRevoke={revoke} busy={busy} />
          </>
        ) : null}

        {state === 'active' && link ? (
          <>
            <div className="rounded-2xl bg-fern-soft/35 px-4 py-4">
              <p className="text-base font-semibold text-ink">
                You&apos;re connected with your partner
              </p>
              <p className="mt-1 text-sm text-moss">
                {link.partnerEmail
                  ? `Connected with ${link.partnerEmail}.`
                  : 'Your partner can see only what you enable below.'}
              </p>
            </div>

            <PermissionList
              permissions={permissions}
              onToggle={setPermission}
              busyKey={permissionBusyKey}
            />

            <DoctorCoachPrivacy />

            <RevokeButton onRevoke={revoke} busy={busy} />
          </>
        ) : null}
      </div>
    </SettingsSection>
  );
}
