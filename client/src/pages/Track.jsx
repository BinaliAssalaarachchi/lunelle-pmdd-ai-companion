import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PHASE_LABELS } from '../../../shared/constants.js';
import { computeCheckInProgress } from '../../../shared/checkInProgress.js';
import { formatDate } from '../../../shared/cycle.js';
import {
  groupSymptomsByCategory,
  IMPACT_ITEMS,
} from '../../../shared/symptoms.js';
import { SeveritySlider } from '../components/tracking/SeveritySlider.jsx';
import { SymptomIcon } from '../components/tracking/SymptomIcon.jsx';
import { SymptomStepper } from '../components/tracking/SymptomStepper.jsx';
import { LoadingState } from '../components/ui/states.jsx';
import { useSymptomLog } from '../hooks/useSymptomLog.js';
import moodArt from '../assets/track/mood.png';
import physicalArt from '../assets/track/physical.png';
import cognitiveArt from '../assets/track/cognitive.png';
import dailyArt from '../assets/track/behavioral.png';
import impactArt from '../assets/track/impact.png';
import journalArt from '../assets/suggestions/reflection.png';

const CATEGORY_LABELS = {
  mood: 'Mood',
  physical: 'Physical',
  cognitive: 'Cognitive',
  behavioral: 'Daily life',
};

const CATEGORY_ART = {
  mood: moodArt,
  physical: physicalArt,
  cognitive: cognitiveArt,
  behavioral: dailyArt,
};

const PHASE_TIPS = {
  menstrual:
    'Rest and gentler expectations often help during your period. Note what eases discomfort today.',
  follicular:
    'Energy can build in this phase. Capture how mood and focus feel so patterns stay clear.',
  ovulatory:
    'Mid-cycle days can feel steadier for some. Logging still helps Lunelle read your rhythm.',
  luteal:
    'Symptoms may intensify before your period. Detailed logs make Insights more useful.',
};

const PHASE_DOTS = {
  menstrual: 'bg-phase-menstrual',
  follicular: 'bg-phase-follicular',
  ovulatory: 'bg-phase-ovulatory',
  luteal: 'bg-phase-luteal',
};

function formatDisplayDate(isoDate) {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed
    .toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();
}

function formatShortDate(isoDate) {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function ProgressRing({ progress }) {
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="#eef4f4"
          strokeWidth="3"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="#f472b6"
          strokeWidth="3"
          strokeDasharray={`${progress}, 100`}
        />
      </svg>
      <span className="absolute text-xs font-semibold text-ink">{progress}%</span>
    </div>
  );
}

export default function Track() {
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') || formatDate(new Date());
  const [status, setStatus] = useState('');

  const {
    loading,
    saving,
    error,
    log,
    setLog,
    exists,
    saveLog,
    logPeriodStart,
  } = useSymptomLog(date);

  const progress = useMemo(() => computeCheckInProgress(log), [log]);
  const grouped = useMemo(() => groupSymptomsByCategory(), []);

  function setDate(nextDate) {
    setSearchParams({ date: nextDate });
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!log) return;
    await saveLog(log);
    setStatus('Saved');
    window.setTimeout(() => setStatus(''), 2000);
  }

  async function handlePeriodStart() {
    await logPeriodStart(date);
    setStatus('Period start logged');
    window.setTimeout(() => setStatus(''), 2000);
  }

  if (loading || !log) {
    return <LoadingState message="Loading today’s check-in…" />;
  }

  const tip = PHASE_TIPS[log.cyclePhase] || PHASE_TIPS.follicular;
  const isToday = date === formatDate(new Date());
  const saveLabel = `${exists ? 'Update' : 'Save'} ${
    isToday ? "today's" : `${formatShortDate(date)}`
  } check-in`;

  return (
    <form onSubmit={handleSave} className="relative mx-auto max-w-5xl pb-36 md:pb-24">
      <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-3">{formatDisplayDate(date)}</p>
          <h1 className="mb-4 font-display text-4xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
            How are you feeling today?
          </h1>
          <div className="mb-5 inline-flex items-center gap-2.5 rounded-full border-2 border-clay bg-clay-soft px-4 py-2">
            <span
              aria-hidden="true"
              className={[
                'h-2.5 w-2.5 rounded-full',
                PHASE_DOTS[log.cyclePhase] || 'bg-phase-follicular',
              ].join(' ')}
            />
            <span className="font-display text-lg font-semibold tracking-tight text-clay-deep sm:text-xl">
              Day {log.cycleDay} · {PHASE_LABELS[log.cyclePhase]}
            </span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block sm:max-w-xs sm:flex-1">
              <span className="mb-1.5 block text-sm font-medium text-moss">
                Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="input-field min-h-[44px] px-3 py-3 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={handlePeriodStart}
              className="btn-login-soft min-h-[44px] px-4 py-2.5 text-sm"
            >
              Log period start
            </button>
          </div>
          <p className="mt-2 text-base text-faint">
            {exists ? 'Editing saved entry' : 'New entry'}
          </p>
        </div>

        <div className="card flex items-center gap-4 px-4 py-3 md:px-5">
          <ProgressRing progress={progress} />
          <div>
            <p className="text-sm font-semibold text-ink">Daily check-in</p>
            <p className="text-base text-moss">
              {progress >= 100
                ? 'Complete — ready to save.'
                : 'Rate symptoms and Impact (1–6).'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-10 md:grid-cols-12">
        <section className="md:col-span-7">
          <p className="eyebrow mb-2">DRSP symptoms</p>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Today’s symptoms
          </h2>
          <p className="mt-2 text-sm text-moss">
            Rate how each felt today. Scale: 1 not at all → 6 extreme.
          </p>

          <div className="mt-6 space-y-5">
            {Object.entries(grouped).map(([category, symptoms]) => (
              <div key={category} className="card overflow-hidden px-5 py-5 sm:px-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-display text-xl font-semibold text-ink sm:text-2xl">
                    {CATEGORY_LABELS[category] || category}
                  </p>
                  {CATEGORY_ART[category] ? (
                    <img
                      src={CATEGORY_ART[category]}
                      alt=""
                      className="h-16 w-16 shrink-0 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
                    />
                  ) : null}
                </div>
                <div>
                  {symptoms.map((symptom) => (
                    <SymptomStepper
                      key={symptom.id}
                      id={symptom.id}
                      label={symptom.shortLabel}
                      detail={symptom.label}
                      icon={<SymptomIcon id={symptom.id} />}
                      value={log.symptoms[symptom.id] ?? 1}
                      onChange={(value) =>
                        setLog((current) => ({
                          ...current,
                          symptoms: {
                            ...current.symptoms,
                            [symptom.id]: value,
                          },
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-10 md:col-span-5">
          <section>
            <p className="eyebrow mb-2">Functional impairment</p>
            <h2 className="font-display text-2xl font-semibold text-ink">
              Impact
            </h2>
            <p className="mt-2 text-sm text-moss">
              Separate from symptoms — how much today interfered with life.
              Same 1–6 scale.
            </p>
            <div className="card mt-5 overflow-hidden px-5 py-5 sm:px-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-display text-xl font-semibold text-ink">
                  Today&apos;s impact
                </p>
                <img
                  src={impactArt}
                  alt=""
                  className="h-16 w-16 shrink-0 object-contain"
                />
              </div>
              <div className="space-y-3">
                {IMPACT_ITEMS.map((item) => (
                  <SeveritySlider
                    key={item.id}
                    id={`impact-${item.id}`}
                    label={item.shortLabel}
                    icon={<SymptomIcon id={item.id} />}
                    value={log.impact?.[item.id] ?? 1}
                    onChange={(value) =>
                      setLog((current) => ({
                        ...current,
                        impact: {
                          ...current.impact,
                          [item.id]: value,
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-moss hover:text-ink">
                Full Impact questions
              </summary>
              <ul className="mt-2 space-y-2 text-base leading-relaxed text-moss">
                {IMPACT_ITEMS.map((item) => (
                  <li key={item.id}>
                    <span className="font-semibold text-ink">
                      {item.shortLabel}:
                    </span>{' '}
                    {item.label}
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section>
            <p className="eyebrow mb-2">Reflection</p>
            <h2 className="font-display text-2xl font-semibold text-ink">
              Journal & notes
            </h2>
            <div className="card mt-5 overflow-hidden px-5 py-5 sm:px-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-display text-xl font-semibold text-ink">
                  Private notes
                </p>
                <img
                  src={journalArt}
                  alt=""
                  className="h-16 w-16 shrink-0 object-contain"
                />
              </div>
              <textarea
                value={log.notes ?? ''}
                onChange={(event) =>
                  setLog((current) => ({ ...current, notes: event.target.value }))
                }
                rows={5}
                placeholder="Add any private notes, thoughts, or reflections for today…"
                className="input-field min-h-[120px] w-full resize-none px-4 py-3 text-base leading-relaxed"
              />
            </div>
            <blockquote className="mt-6 border-l-2 border-clay pl-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay-deep">
                Cycle note
              </p>
              <p className="mt-1.5 font-display text-xl font-semibold tracking-tight text-clay-deep sm:text-2xl">
                Day {log.cycleDay} · {PHASE_LABELS[log.cyclePhase]}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-moss">{tip}</p>
            </blockquote>
          </section>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-5 md:bottom-10 md:inset-x-auto md:right-12 md:justify-end">
        <div className="pointer-events-auto flex w-full max-w-sm flex-col items-stretch gap-2 md:w-auto md:items-end">
          {status ? (
            <span className="self-center rounded-full border border-line bg-cream px-4 py-1.5 text-center text-sm font-medium text-pine shadow-lift md:self-end">
              {status}
            </span>
          ) : null}
          {error ? (
            <span className="self-center rounded-full border border-danger/25 bg-danger-soft px-4 py-1.5 text-center text-sm font-medium text-danger shadow-lift md:self-end">
              {error}
            </span>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="btn-accent flex min-h-[52px] w-full items-center justify-center gap-2 px-8 py-4 text-sm shadow-lift md:w-auto"
          >
            {saving ? 'Saving…' : saveLabel}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </form>
  );
}
