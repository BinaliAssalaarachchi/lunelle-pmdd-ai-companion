import { useState } from 'react';

/**
 * Partner-side leave control — uses existing POST /api/partner/revoke.
 */
export function LeaveSharedSpaceButton({ onLeave, busy }) {
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    try {
      await onLeave();
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
        Leave shared space
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-danger/25 bg-danger-soft/40 px-4 py-4">
      <p className="text-base leading-relaxed text-ink">
        You will immediately lose access to everything shared with you here.
        She can invite you again later if she chooses.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleConfirm}
          className="min-h-[44px] rounded-full bg-danger px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
        >
          {busy ? 'Leaving…' : 'Yes, leave shared space'}
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
