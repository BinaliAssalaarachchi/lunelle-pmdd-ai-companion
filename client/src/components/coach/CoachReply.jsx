import { useState } from 'react';
import { Link } from 'react-router-dom';
import { COACH_DISCLAIMER } from '../../lib/coachApi.js';
import { AiGeneratedLabel } from '../ui/AiGeneratedLabel.jsx';

function Layer({ eyebrow, title, children }) {
  if (!children) return null;
  return (
    <section className="space-y-2">
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="font-display text-lg font-semibold text-ink sm:text-xl">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

export function CoachReply({ reply, onFollowUp }) {
  const [copied, setCopied] = useState(false);
  if (!reply) return null;

  const userReported = Array.isArray(reply.reflection?.userReported)
    ? reply.reflection.userReported
    : [];
  const facts = Array.isArray(reply.evidence?.facts) ? reply.evidence.facts : [];
  const disclaimer = reply.safety?.disclaimer || COACH_DISCLAIMER;
  const crisisNote = reply.safety?.crisisNote || '';

  async function copyScript() {
    if (!reply.doctorScript) return;
    try {
      await navigator.clipboard.writeText(reply.doctorScript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="card space-y-6 px-5 py-6 sm:px-6">
      {reply.usedGemini ? <AiGeneratedLabel /> : null}
      {reply.redirect ? (
        <p className="text-base leading-relaxed text-ink">{reply.redirect}</p>
      ) : null}

      {reply.offer ? (
        <p className="text-base leading-relaxed text-moss">{reply.offer}</p>
      ) : null}

      <Layer
        eyebrow="What you said"
        title="Your words — not a measurement"
      >
        {userReported.length ? (
          <ul className="space-y-2">
            {userReported.map((item, index) => (
              <li
                key={`${item.text}-${index}`}
                className="rounded-2xl bg-cream/80 px-4 py-3 text-base leading-relaxed text-ink"
              >
                {item.text}
                {item.conflictsWithEvidence ? (
                  <span className="mt-1 block text-sm text-moss">
                    This is how you described it. Your tracking may show a
                    different number.
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Layer>

      <Layer
        eyebrow="What your tracking shows"
        title="Verified from your logs"
      >
        {facts.length ? (
          <ul className="space-y-2">
            {facts.map((fact, index) => (
              <li
                key={`${fact.id || 'fact'}-${fact.display || index}`}
                className="rounded-2xl border border-fern/25 bg-fern-soft px-4 py-3 text-base leading-relaxed text-fern-deep"
              >
                {fact.text || fact.display}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base leading-relaxed text-moss">
            No verified statistic is being claimed for this reply.
          </p>
        )}
      </Layer>

      {reply.doctorScript ? (
        <Layer
          eyebrow="A way you could say this"
          title="Suggested wording — not a diagnosis"
        >
          <blockquote className="rounded-2xl border border-clay/25 bg-clay-soft px-5 py-4">
            <p className="text-base leading-relaxed text-ink">
              {reply.doctorScript}
            </p>
          </blockquote>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyScript}
              className="btn-secondary min-h-[44px] px-4 py-2 text-sm"
            >
              {copied ? 'Copied' : 'Copy for my appointment'}
            </button>
            <Link
              to="/reports"
              className="btn-secondary min-h-[44px] px-4 py-2 text-sm"
            >
              Open clinician report
            </Link>
          </div>
        </Layer>
      ) : null}

      {reply.followUp ? (
        <div className="border-t border-line pt-4">
          <p className="text-base leading-relaxed text-moss">{reply.followUp}</p>
          {onFollowUp ? (
            <button
              type="button"
              onClick={() => onFollowUp(reply.followUp)}
              className="btn-accent mt-3 min-h-[44px] px-4 py-2 text-sm"
            >
              Use this as my next message
            </button>
          ) : null}
        </div>
      ) : null}

      {reply.usedFallback ? (
        <p className="text-sm text-moss">
          We used a careful fallback so nothing unverified was shown.
        </p>
      ) : null}

      <p className="text-sm leading-relaxed text-faint">{disclaimer}</p>
      {crisisNote ? (
        <p className="text-sm font-semibold leading-relaxed text-moss">
          {crisisNote}
        </p>
      ) : null}
    </article>
  );
}
