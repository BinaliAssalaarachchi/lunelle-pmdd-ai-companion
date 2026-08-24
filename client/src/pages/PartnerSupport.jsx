import { Link } from 'react-router-dom';
import { LoadingState, ErrorState } from '../components/ui/states.jsx';
import {
  formatCyclePhaseLabel,
  formatPartnerDate,
  partnerViewSectionKeys,
} from '../lib/partnerViewUi.js';
import { usePartnerView } from '../hooks/usePartnerView.js';
import { LeaveSharedSpaceButton } from '../components/partner/LeaveSharedSpaceButton.jsx';

function SupportCard({ children, className = '' }) {
  return (
    <section
      className={`card space-y-3 p-5 sm:p-6 ${className}`.trim()}
    >
      {children}
    </section>
  );
}

function SectionEyebrow({ children }) {
  return <p className="eyebrow text-moss">{children}</p>;
}

function PrivacyFooter() {
  return (
    <footer className="rounded-2xl border border-white/60 bg-cream/45 px-4 py-4 text-sm leading-relaxed text-moss">
      Her private information stays private. Doctor Coach conversations are
      never shared.
    </footer>
  );
}

function CycleSection({ cycle }) {
  if (!cycle) return null;
  const phaseLabel = formatCyclePhaseLabel(cycle.cyclePhase);

  return (
    <SupportCard>
      <SectionEyebrow>Cycle context</SectionEyebrow>
      <h2 className="font-display text-2xl font-semibold text-ink">
        {cycle.cycleDay != null
          ? `Cycle day ${cycle.cycleDay}`
          : 'Cycle timing'}
      </h2>
      {phaseLabel ? (
        <p className="text-base text-moss">{phaseLabel} phase</p>
      ) : null}
      {cycle.reminder ? (
        <p className="text-base leading-relaxed text-ink">{cycle.reminder}</p>
      ) : null}
    </SupportCard>
  );
}

function SupportGuidanceSection({ support }) {
  if (!support?.items?.length) return null;
  return (
    <SupportCard>
      <SectionEyebrow>Support ideas</SectionEyebrow>
      <h2 className="font-display text-2xl font-semibold text-ink">
        Ways to be there for her
      </h2>
      <ul className="space-y-4">
        {support.items.map((item) => (
          <li key={item.id} className="rounded-2xl bg-cream/55 px-4 py-3">
            <p className="text-base font-semibold text-ink">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-moss">{item.body}</p>
          </li>
        ))}
      </ul>
    </SupportCard>
  );
}

function SymptomRow({ label, severity, scaleMax }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-white/50 py-2.5 first:border-t-0">
      <span className="text-base text-ink">{label}</span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-pine-deep">
        {severity}/{scaleMax}
      </span>
    </li>
  );
}

function SymptomsSection({ symptoms }) {
  if (!symptoms) return null;
  const scaleMax = symptoms.scale?.max ?? 6;

  return (
    <SupportCard>
      <SectionEyebrow>Shared with you</SectionEyebrow>
      <h2 className="font-display text-2xl font-semibold text-ink">
        What she tracked recently
      </h2>
      <p className="text-sm text-moss">She chose to share this with you.</p>
      {symptoms.asOfDate ? (
        <p className="text-sm text-moss">
          From {formatPartnerDate(symptoms.asOfDate)}
          {symptoms.cycleDay != null ? ` · cycle day ${symptoms.cycleDay}` : ''}
        </p>
      ) : null}
      {symptoms.items?.length ? (
        <div>
          <p className="mb-1 text-sm font-semibold text-ink">Symptoms</p>
          <ul>
            {symptoms.items.map((item) => (
              <SymptomRow
                key={item.id}
                label={item.shortLabel}
                severity={item.severity}
                scaleMax={scaleMax}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {symptoms.impact?.length ? (
        <div className="mt-3">
          <p className="mb-1 text-sm font-semibold text-ink">Daily life impact</p>
          <ul>
            {symptoms.impact.map((item) => (
              <SymptomRow
                key={item.id}
                label={item.shortLabel}
                severity={item.severity}
                scaleMax={scaleMax}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </SupportCard>
  );
}

function NotesSection({ notes }) {
  if (!notes) return null;
  return (
    <SupportCard>
      <SectionEyebrow>Shared with you</SectionEyebrow>
      <h2 className="font-display text-2xl font-semibold text-ink">
        Notes she&apos;s chosen to share
      </h2>
      {notes.length === 0 ? (
        <p className="text-base text-moss">No notes in this period yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={`${note.date}-${note.text.slice(0, 24)}`}
              className="rounded-2xl bg-cream/55 px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-moss">
                {formatPartnerDate(note.date)}
              </p>
              <p className="mt-1 text-base leading-relaxed text-ink whitespace-pre-wrap">
                {note.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SupportCard>
  );
}

function InsightsSection({ insights }) {
  if (!insights) return null;
  return (
    <SupportCard>
      <SectionEyebrow>Shared with you</SectionEyebrow>
      <h2 className="font-display text-2xl font-semibold text-ink">
        An insight she chose to share
      </h2>
      <p className="text-sm text-moss">
        This is a reflection from her tracking — not a diagnosis.
      </p>
      {insights.length === 0 ? (
        <p className="text-base text-moss">No insight available right now.</p>
      ) : (
        <ul className="space-y-4">
          {insights.map((item, index) => (
            <li
              key={`${item.generatedAt || 'insight'}-${index}`}
              className="rounded-2xl bg-cream/55 px-4 py-3"
            >
              {item.generatedAt ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-moss">
                  {formatPartnerDate(item.generatedAt)}
                </p>
              ) : null}
              {item.summary ? (
                <p className="mt-1 text-base leading-relaxed text-ink">
                  {item.summary}
                </p>
              ) : null}
              {item.patterns?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-moss">
                  {item.patterns.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SupportCard>
  );
}

function EmptySharedSpace() {
  return (
    <SupportCard>
      <p className="text-base leading-relaxed text-moss">
        Nothing extra is shared right now beyond what she has enabled. Check
        back later — she controls what appears here.
      </p>
    </SupportCard>
  );
}

function OwnerRedirect() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="eyebrow mb-3">Partner sharing</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">
          Support view
        </h1>
      </header>
      <SupportCard>
        <p className="text-base leading-relaxed text-moss">
          This page is for partners who have been invited to support someone.
          You manage sharing from your Profile settings.
        </p>
        <Link to="/profile" className="btn-accent inline-flex min-h-[48px] px-6 py-3 text-sm">
          Go to Profile
        </Link>
      </SupportCard>
      <PrivacyFooter />
    </div>
  );
}

function DisconnectedState({ variant }) {
  const messages = {
    disconnected: {
      title: 'No shared space yet',
      body: 'When someone invites you to support them on Lunelle, what they choose to share will appear here.',
    },
    pending: {
      title: 'Connection pending',
      body: 'Your connection is not active yet. Once they finish setting things up, this space will open.',
    },
    revoked: {
      title: 'Access has ended',
      body: 'This shared space is no longer available. If she invites you again, you can reconnect here.',
    },
  };
  const copy = messages[variant] || messages.disconnected;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="eyebrow mb-3">Support</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">
          {copy.title}
        </h1>
      </header>
      <SupportCard>
        <p className="text-base leading-relaxed text-moss">{copy.body}</p>
        {variant === 'disconnected' || variant === 'revoked' ? (
          <Link
            to="/partner/connect"
            className="btn-accent inline-flex min-h-[48px] px-6 py-3 text-sm"
          >
            Enter connection code
          </Link>
        ) : null}
      </SupportCard>
      <PrivacyFooter />
    </div>
  );
}

export default function PartnerSupport() {
  const {
    loading,
    refreshing,
    error,
    view,
    pageMode,
    retry,
    refresh,
    revokeBusy,
    leaveSharedSpace,
  } = usePartnerView();

  if (loading && !error?.kind) {
    return (
      <div className="mx-auto max-w-xl">
        <LoadingState message="Loading your shared space…" />
      </div>
    );
  }

  if (pageMode === 'owner_not_partner_view') {
    return <OwnerRedirect />;
  }

  if (pageMode === 'partner_pending') {
    return <DisconnectedState variant="pending" />;
  }

  if (pageMode === 'partner_revoked' || error?.kind === 'access_ended') {
    return <DisconnectedState variant="revoked" />;
  }

  if (pageMode === 'disconnected') {
    return <DisconnectedState variant="disconnected" />;
  }

  if (error?.kind === 'temporary') {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <ErrorState message={error.message} />
        <button
          type="button"
          onClick={retry}
          className="btn-accent min-h-[48px] px-6 py-3 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!view) {
    return <DisconnectedState variant="disconnected" />;
  }

  const sections = partnerViewSectionKeys(view);
  const hasContent = sections.some((key) => key !== 'relationship');

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-10">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow mb-3">Support</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">
              How can I support her?
            </h1>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || revokeBusy}
            className="btn-login-soft min-h-[44px] shrink-0 px-4 py-2.5 text-sm"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <p className="mt-3 text-base leading-relaxed text-moss">
          Here&apos;s a little context that may help you support her — only what
          she has chosen to share.
        </p>
      </header>

      <CycleSection cycle={view.cycle} />
      <SupportGuidanceSection support={view.support} />
      <SymptomsSection symptoms={view.symptoms} />
      <NotesSection notes={view.notes} />
      <InsightsSection insights={view.insights} />

      {!hasContent ? <EmptySharedSpace /> : null}

      <LeaveSharedSpaceButton onLeave={leaveSharedSpace} busy={revokeBusy} />

      <PrivacyFooter />
    </div>
  );
}
