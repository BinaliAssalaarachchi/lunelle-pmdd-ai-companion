import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CoachReply, CoachReplyPreview } from '../components/coach/CoachReply.jsx';
import { EmptyState, LoadingDots } from '../components/ui/states.jsx';
import { AiGeneratedLabel } from '../components/ui/AiGeneratedLabel.jsx';
import { useDoctorCoach } from '../hooks/useDoctorCoach.js';
import { COACH_DISCLAIMER, COACH_STARTERS } from '../lib/coachApi.js';

function CoachIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H13l-4 3.2V16H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" />
    </svg>
  );
}

export default function DoctorCoach() {
  const { turns, sending, slowHint, error, send, reset } = useDoctorCoach();
  const [draft, setDraft] = useState('');

  async function submit(text) {
    const message = String(text || draft).trim();
    if (!message) return;
    setDraft('');
    await send(message);
  }

  return (
    <div className="space-y-8 pb-8">
      <header>
        <Link
          to="/insights"
          className="btn-secondary mb-5 min-h-[44px] px-4 py-2 text-sm"
        >
          Back to Insights
        </Link>
        <p className="eyebrow mb-3">Appointment prep</p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
          Talk to your doctor
        </h1>
        <div className="mt-3">
          <AiGeneratedLabel />
        </div>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-moss">
          This helps you turn what you’ve logged into a clear description you
          can share with a healthcare professional. It does not diagnose or
          recommend treatment.
        </p>
      </header>

      <section
        className="rounded-2xl border-2 border-clay bg-cream px-5 py-4"
        style={{
          boxShadow:
            '0 3px 0 0 var(--color-clay), 0 14px 28px -12px rgba(219, 39, 119, 0.28)',
        }}
      >
        <p className="eyebrow mb-1">Always in view</p>
        <p className="text-sm leading-relaxed text-moss">{COACH_DISCLAIMER}</p>
      </section>

      <section
        className="rounded-2xl border-2 border-fern bg-cream px-5 py-4"
        style={{
          boxShadow:
            '0 3px 0 0 var(--color-fern), 0 14px 28px -12px rgba(13, 148, 136, 0.28)',
        }}
      >
        <p className="eyebrow mb-1">If you feel unsafe</p>
        <p className="text-sm leading-relaxed text-moss">
          Contact local emergency services or find localized resources at{' '}
          <a
            href="https://www.iasp.info/suicidalthoughts/"
            target="_blank"
            rel="noreferrer"
            className="link-accent"
          >
            iasp.info/suicidalthoughts
          </a>
          .
        </p>
      </section>

      {error ? (
        <section
          role="alert"
          className="rounded-2xl border border-danger/25 bg-danger-soft px-5 py-4 text-base text-ink"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => submit(turns.at(-1)?.role === 'user' ? turns.at(-1).text : draft)}
              disabled={sending}
              className="btn-secondary min-h-[44px] px-4 py-2 text-sm"
            >
              Try again
            </button>
          </div>
        </section>
      ) : null}

      {turns.length === 0 && !sending ? (
        <>
          <EmptyState
            icon={<CoachIcon />}
            title="Start with what is hard to say"
            description="Pick a prompt, or write the thing you wish you could explain in the appointment room."
          />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">
              Preview — redesigned reply
            </p>
            <CoachReplyPreview />
          </div>
        </>
      ) : null}

      <div className="space-y-4">
        {turns.map((turn) =>
          turn.role === 'user' ? (
            <p
              key={turn.id}
              className="ml-auto max-w-[36rem] rounded-3xl bg-pine px-5 py-3 text-base leading-relaxed text-cream"
            >
              {turn.text}
            </p>
          ) : (
            <CoachReply
              key={turn.id}
              reply={turn.reply}
              onFollowUp={(text) => submit(text)}
            />
          ),
        )}
      </div>

      {sending ? (
        <section aria-live="polite" aria-busy="true" className="card px-6 py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <LoadingDots />
            <p className="text-sm font-medium text-ink">
              Grounding this in your tracking…
            </p>
            <p className="max-w-md text-sm leading-relaxed text-moss">
              We only use verified numbers from your saved logs.
            </p>
            {slowHint ? (
              <p className="text-sm text-faint">
                Still working — a few more seconds to stay careful with your
                data.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
      >
        <div className="flex flex-wrap gap-2">
          {COACH_STARTERS.map((starter) => (
            <button
              key={starter.id}
              type="button"
              disabled={sending}
              onClick={() => submit(starter.message)}
              className="btn-secondary min-h-[44px] px-4 py-2 text-sm"
            >
              {starter.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">
            What do you want help saying?
          </span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            disabled={sending}
            className="input-field min-h-[96px] w-full resize-y px-4 py-3 text-base"
            placeholder="I don’t know how to explain…"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="btn-accent min-h-[48px] px-6 py-3 text-sm"
          >
            {sending ? 'Preparing…' : 'Help me say this'}
          </button>
          {turns.length > 0 ? (
            <button
              type="button"
              disabled={sending}
              onClick={reset}
              className="btn-secondary min-h-[48px] px-6 py-3 text-sm"
            >
              Start over
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
