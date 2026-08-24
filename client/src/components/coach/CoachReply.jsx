import { useState } from 'react';
import { COACH_DISCLAIMER } from '../../lib/coachApi.js';
import { AiGeneratedLabel } from '../ui/AiGeneratedLabel.jsx';

const WARM_LEADS = [
  "That's a hard thing to put into words.",
  'It makes sense that this feels difficult to explain.',
  "You're not alone in finding this tricky to describe.",
  'Putting this into language for an appointment can feel overwhelming.',
];

const FOLLOW_UP_LABELS = [
  'Try this next',
  'Say this instead',
  'Continue with this',
  'Use this wording',
  'Build on this',
];

function warmLead(userReported, hasScript) {
  if (!hasScript) return null;
  const seed = userReported[0]?.text?.length ?? 0;
  return `${WARM_LEADS[seed % WARM_LEADS.length]} Here's a way you could say it to your doctor:`;
}

function followUpLabel(followUp) {
  if (!followUp) return 'Try this next';
  return FOLLOW_UP_LABELS[followUp.length % FOLLOW_UP_LABELS.length];
}

function pickPrimaryAction({ doctorScript, followUp, onFollowUp }) {
  if (doctorScript) {
    return { kind: 'copy', label: 'Copy for my appointment' };
  }
  if (followUp && onFollowUp) {
    return {
      kind: 'followUp',
      label: followUpLabel(followUp),
      text: followUp,
    };
  }
  return null;
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
  const hasScript = Boolean(reply.doctorScript);
  const lead = warmLead(userReported, hasScript);
  const primaryAction = pickPrimaryAction({
    doctorScript: reply.doctorScript,
    followUp: reply.followUp,
    onFollowUp,
  });

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

  function handlePrimaryAction() {
    if (primaryAction?.kind === 'copy') {
      copyScript();
      return;
    }
    if (primaryAction?.kind === 'followUp' && onFollowUp) {
      onFollowUp(primaryAction.text);
    }
  }

  const primaryLabel =
    primaryAction?.kind === 'copy' && copied
      ? 'Copied'
      : primaryAction?.label;

  const showConversation =
    !reply.redirect && !reply.offer && (userReported.length || hasScript || facts.length);

  return (
    <article className="max-w-[36rem] space-y-2">
      <div className="rounded-3xl rounded-tl-md border border-white/60 bg-cream/90 px-5 py-5 shadow-sm">
        {reply.usedGemini ? (
          <div className="mb-3">
            <AiGeneratedLabel />
          </div>
        ) : null}

        {reply.redirect ? (
          <p className="text-base leading-relaxed text-ink">{reply.redirect}</p>
        ) : null}

        {reply.offer ? (
          <p className="text-base leading-relaxed text-moss">{reply.offer}</p>
        ) : null}

        {showConversation ? (
          <div className="space-y-4 text-base leading-relaxed text-ink">
            {lead ? <p className="text-moss">{lead}</p> : null}

            {userReported
              .filter((item) => item.conflictsWithEvidence)
              .map((item, index) => (
                <p key={`conflict-${index}`} className="text-sm text-moss">
                  You described it one way; your tracking may show a different
                  number than you remembered.
                </p>
              ))}

            {!hasScript
              ? userReported.map((item, index) => (
                  <p key={`${item.text}-${index}`}>{item.text}</p>
                ))
              : null}

            {hasScript ? (
              <figure className="rounded-2xl border border-clay/20 bg-white/70 px-4 py-4">
                <blockquote className="text-base leading-relaxed text-ink">
                  <span aria-hidden="true" className="mr-1 text-clay-deep">
                    "
                  </span>
                  {reply.doctorScript}
                  <span aria-hidden="true" className="ml-0.5 text-clay-deep">
                    "
                  </span>
                </blockquote>
              </figure>
            ) : null}

            {facts.length ? (
              <details className="group rounded-xl border border-fern/15 bg-fern-soft/30 px-3 py-2">
                <summary className="cursor-pointer list-none text-sm font-medium text-moss marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block text-xs text-fern transition group-open:rotate-90"
                    >
                      ▸
                    </span>
                    Where this comes from
                    <span className="font-normal text-faint">
                      ({facts.length}{' '}
                      {facts.length === 1 ? 'entry' : 'entries'} from your logs)
                    </span>
                  </span>
                </summary>
                <ul className="mt-3 space-y-2 border-t border-fern/10 pt-3">
                  {facts.map((fact, index) => (
                    <li
                      key={`${fact.id || 'fact'}-${fact.display || index}`}
                      className="text-sm leading-relaxed text-fern-deep"
                    >
                      {fact.text || fact.display}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {!facts.length && !hasScript && !userReported.length ? (
              <p className="text-moss">
                No verified statistic is being claimed for this reply.
              </p>
            ) : null}

            {reply.followUp && !hasScript ? (
              <p className="text-moss">{reply.followUp}</p>
            ) : null}
          </div>
        ) : null}

        {reply.usedFallback ? (
          <p className="mt-3 text-sm text-moss">
            We used a careful fallback so nothing unverified was shown.
          </p>
        ) : null}

        {primaryAction ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="btn-accent min-h-[44px] px-4 py-2 text-sm"
            >
              {primaryLabel}
            </button>
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-relaxed text-faint">{disclaimer}</p>
        {crisisNote ? (
          <p className="mt-2 text-sm font-semibold leading-relaxed text-moss">
            {crisisNote}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** Static preview — typical anxiety turn for design review. */
export function CoachReplyPreview() {
  return (
    <CoachReply
      reply={{
        usedGemini: true,
        reflection: {
          userReported: [
            {
              text: "I don't know how to explain how bad my anxiety gets before my period.",
              source: 'message',
              conflictsWithEvidence: false,
            },
          ],
        },
        evidence: {
          facts: [
            {
              id: 'anxiety_premenstrual_week_vs_earlier',
              display: '4.9/6 vs 1.4/6',
              text: 'Anxious / tense: about 4.9/6 in the last 7 days of your cycle vs 1.4/6 earlier in your cycle (from your logs).',
              source: 'tracked',
            },
          ],
        },
        doctorScript:
          "I've noticed that my anxious / tense feelings become significantly stronger about a week before my period. In my tracking, it usually increases from around 1.4/6 earlier in my cycle to around 4.9/6 during that window.",
        followUp:
          'Would it help to mention how this affects work or relationships?',
        safety: {
          disclaimer:
            'This is not medical advice, a diagnosis, or a treatment recommendation.',
        },
      }}
      onFollowUp={() => {}}
    />
  );
}
