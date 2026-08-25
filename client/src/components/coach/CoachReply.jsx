import { useState } from 'react';
import { COACH_DISCLAIMER } from '../../lib/coachApi.js';
import { AiGeneratedLabel } from '../ui/AiGeneratedLabel.jsx';

const FOLLOW_UP_LABELS = [
  'Try this next',
  'Say this instead',
  'Continue with this',
  'Use this wording',
  'Build on this',
];

function followUpLabel(followUp) {
  if (!followUp) return 'Try this next';
  return FOLLOW_UP_LABELS[followUp.length % FOLLOW_UP_LABELS.length];
}

function asList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function formatCoachBriefing(reply) {
  if (!reply) return '';
  const parts = [];
  if (reply.doctorScript) {
    parts.push(`What you could say\n"${reply.doctorScript}"`);
  }
  const mentions = asList(reply.mentionPoints);
  if (mentions.length) {
    parts.push(
      `You may want to mention\n${mentions.map((item) => `• ${item}`).join('\n')}`,
    );
  }
  if (reply.detailExplanation) {
    parts.push(`If your doctor asks for more detail\n"${reply.detailExplanation}"`);
  }
  const questions = asList(reply.doctorQuestions);
  if (questions.length) {
    parts.push(
      `Questions you could ask\n${questions.map((item) => `• ${item}`).join('\n')}`,
    );
  }
  return parts.join('\n\n');
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

function SectionHeading({ children }) {
  return (
    <p className="text-sm font-semibold text-ink">{children}</p>
  );
}

export function CoachReply({ reply, onFollowUp }) {
  const [copied, setCopied] = useState(false);
  if (!reply) return null;

  const userReported = Array.isArray(reply.reflection?.userReported)
    ? reply.reflection.userReported
    : [];
  const facts = Array.isArray(reply.evidence?.facts) ? reply.evidence.facts : [];
  const mentionPoints = asList(reply.mentionPoints);
  const doctorQuestions = asList(reply.doctorQuestions);
  const disclaimer = reply.safety?.disclaimer || COACH_DISCLAIMER;
  const crisisNote = reply.safety?.crisisNote || '';
  const hasScript = Boolean(reply.doctorScript);
  const hasBriefing =
    hasScript ||
    mentionPoints.length ||
    reply.detailExplanation ||
    doctorQuestions.length;
  const primaryAction = pickPrimaryAction({
    doctorScript: reply.doctorScript,
    followUp: reply.followUp,
    onFollowUp,
  });

  async function copyScript() {
    const text = formatCoachBriefing(reply) || reply.doctorScript;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
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
    hasBriefing ||
    (!reply.redirect && !reply.offer && (userReported.length || facts.length));

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
          <p className="mt-2 text-base leading-relaxed text-moss">{reply.offer}</p>
        ) : null}

        {showConversation ? (
          <div className="space-y-5 text-base leading-relaxed text-ink">
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
              <section className="space-y-2">
                <SectionHeading>What you could say</SectionHeading>
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
              </section>
            ) : null}

            {mentionPoints.length ? (
              <section className="space-y-2">
                <SectionHeading>You may want to mention</SectionHeading>
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-moss marker:text-clay">
                  {mentionPoints.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {reply.detailExplanation || facts.length ? (
              <section className="space-y-2">
                <SectionHeading>If your doctor asks for more detail</SectionHeading>
                {reply.detailExplanation ? (
                  <p className="text-sm leading-relaxed text-ink">
                    {reply.detailExplanation}
                  </p>
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
                        Supporting tracking detail
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
              </section>
            ) : null}

            {doctorQuestions.length ? (
              <section className="space-y-2">
                <SectionHeading>Questions you could ask</SectionHeading>
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-moss marker:text-pine">
                  {doctorQuestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {!facts.length && !hasBriefing && !userReported.length ? (
              <p className="text-moss">
                No verified statistic is being claimed for this reply.
              </p>
            ) : null}

            {reply.followUp && !hasScript ? (
              <p className="text-moss">{reply.followUp}</p>
            ) : null}
          </div>
        ) : null}

        {reply.redirect && doctorQuestions.length ? (
          <section className="mt-4 space-y-2">
            <SectionHeading>Questions you could ask</SectionHeading>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-moss marker:text-pine">
              {doctorQuestions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
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
              text: 'How should I explain my symptoms to my doctor?',
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
          "Doctor, I've noticed that I start feeling much more anxious and tense about a week before my period. I've been tracking my symptoms, and this seems to happen around the same part of my cycle. I'd like to talk with you about whether this pattern could be related to my menstrual cycle.",
        mentionPoints: [
          'When you first noticed this in the days you have been tracking',
          'That it tends to begin about a week before your period',
          'Whether it eases after your period begins',
          'How it affects daily activities, sleep, work, or relationships',
          'You can also show your clinician your Lunelle report, which contains the detailed symptom tracking',
        ],
        detailExplanation:
          'My tracking shows this tends to be much lower earlier in my cycle and considerably stronger during the week before my period. The logged averages were about 1.4/6 earlier and 4.9/6 during that later window.',
        doctorQuestions: [
          'Could this pattern be related to my menstrual cycle?',
          'What would be useful for me to track going forward?',
          'Are there other possible causes we should consider?',
        ],
        followUp: 'Would it help to mention how this affects work or relationships?',
        safety: {
          disclaimer:
            'This is not medical advice, a diagnosis, or a treatment recommendation.',
        },
      }}
      onFollowUp={() => {}}
    />
  );
}
