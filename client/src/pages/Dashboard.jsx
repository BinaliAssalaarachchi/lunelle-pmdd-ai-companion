import { Link } from 'react-router-dom';
import {
  DEFAULT_CYCLE_LENGTH,
  isSeverityPresent,
  PHASE_LABELS,
  SEVERITY_MIN,
} from '../../../shared/constants.js';
import {
  addDays,
  calculateCycleDay,
  calculateCyclePhase,
  formatDate,
  getDaysUntilPeriod,
} from '../../../shared/cycle.js';
import { SYMPTOMS } from '../../../shared/symptoms.js';
import mayaAvatar from '../assets/maya-avatar.png';
import { CycleArc } from '../components/dashboard/CycleArc.jsx';
import { SeverityHeatmap } from '../components/dashboard/SeverityHeatmap.jsx';
import { StatCards } from '../components/dashboard/StatCards.jsx';
import {
  EmptyState,
  LoadingState,
} from '../components/ui/states.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import {
  averageSeverity,
  buildPhaseAverages,
  computeStatCards,
} from '../lib/dashboardStats.js';

const QUICK_CHIPS = [
  { id: 'fatigue', label: 'Tired / low energy' },
  { id: 'anxiety', label: 'Anxious / tense' },
  { id: 'anger', label: 'Angry / irritable' },
  { id: 'concentration', label: 'Hard to concentrate' },
  { id: 'sleep', label: 'Sleep changes' },
  { id: 'overwhelmed', label: 'Overwhelmed' },
];

const PHASE_SWATCHES = {
  menstrual: 'bg-phase-menstrual',
  follicular: 'bg-phase-follicular',
  ovulatory: 'bg-phase-ovulatory',
  luteal: 'bg-phase-luteal',
};

function greetingForNow(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayEyebrow(date = new Date()) {
  return date
    .toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    .toUpperCase();
}

function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'L';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function shortDate(isoDate) {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function LogIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

function Avatar({ name }) {
  const isDemo = name === 'Maya';

  return (
    <Link
      to="/profile"
      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pine font-display text-base font-semibold text-cream transition hover:bg-pine-deep"
      aria-label="Open profile"
    >
      {isDemo ? (
        <img
          src={mayaAvatar}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        initialsFromName(name)
      )}
    </Link>
  );
}

export default function Dashboard() {
  const { loading, profile, logs } = useDashboardData();

  if (loading) {
    return <LoadingState message="Loading your dashboard…" />;
  }

  const displayName = profile?.displayName ?? 'there';
  const greeting = greetingForNow();

  if (!logs.length) {
    return (
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-3">{todayEyebrow()}</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {greeting}, {displayName}
            </h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-moss">
              Let&apos;s check in with your body today.
            </p>
          </div>
          <Avatar name={displayName} />
        </header>
        <EmptyState
          icon={<LogIcon />}
          title="Nothing logged yet"
          description="Take a moment to check in with yourself. Your patterns will appear here once you start tracking."
          action={
            <Link to="/track" className="btn-accent min-h-[48px] px-6 py-3 text-sm">
              Log today&apos;s symptoms
            </Link>
          }
        />
      </div>
    );
  }

  const cycleLength = profile?.cycleLength ?? DEFAULT_CYCLE_LENGTH;
  const periodLength = profile?.periodLength ?? 5;
  const lastPeriodStart = profile?.lastPeriodStart;
  const today = formatDate(new Date());
  const cycleDay = lastPeriodStart
    ? calculateCycleDay(lastPeriodStart, today, cycleLength)
    : logs.at(-1)?.cycleDay ?? 1;
  const cyclePhase = calculateCyclePhase(cycleDay, cycleLength, periodLength);
  const daysUntil = getDaysUntilPeriod(cycleDay, cycleLength);
  const phaseAverages = buildPhaseAverages(logs);
  const stats = computeStatCards(logs);
  const lutealAvg =
    phaseAverages.find((phase) => phase.phase === 'luteal')?.average ?? 0;

  const recentLogs = Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(today, -offset);
    const log = logs.find((entry) => entry.date === date);
    return { date, log };
  });

  const todayLog = logs.find((entry) => entry.date === today);
  const todaysTopSymptoms = todayLog
    ? SYMPTOMS.map((s) => ({
        ...s,
        value: todayLog.symptoms?.[s.id] ?? SEVERITY_MIN,
      }))
        .filter((s) => isSeverityPresent(s.value))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
    : [];

  const insightSummary = stats.mostAffectedPhase
    ? `From your ${logs.length} logged days, ${stats.mostAffectedPhase.label.toLowerCase()} shows the highest average severity (${stats.mostAffectedPhase.average.toFixed(1)}). Luteal average is ${lutealAvg.toFixed(1)}.`
    : `You have ${logs.length} logged days. Keep tracking so Lunelle can surface clearer cycle patterns.`;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">{todayEyebrow()}</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {greeting}, {displayName}
          </h1>
        </div>
        <Avatar name={displayName} />
      </header>

      {/* Cycle hero */}
      <section className="card-dark relative overflow-hidden p-7 sm:p-9">
        <div className="flex flex-col items-center gap-8 md:flex-row md:gap-12">
          <div className="order-2 flex-1 md:order-1">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
              Your cycle
            </p>
            <h2 className="display-italic mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl [text-shadow:0_2px_8px_rgba(0,0,0,0.35)]">
              {PHASE_LABELS[cyclePhase]} phase
            </h2>
            <div className="mt-5 inline-flex items-center gap-4 rounded-2xl border border-white/50 bg-white/25 px-4 py-3 shadow-md backdrop-blur-sm">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="2.75"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(0, Math.min(1, 1 - daysUntil / Math.max(cycleLength, 1))) * 97.4}, 97.4`}
                  />
                </svg>
                <span className="font-display text-2xl font-bold leading-none text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]">
                  {daysUntil}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">
                  {daysUntil === 1 ? 'Day left' : 'Days left'}
                </p>
                <p className="mt-0.5 text-base font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">
                  until expected period
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-6 border-t border-white/40 pt-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">
                  Luteal average
                </p>
                <p className="font-display text-3xl font-bold text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.35)]">
                  {lutealAvg.toFixed(1)}
                </p>
              </div>
              <p className="max-w-[14rem] text-xs font-semibold leading-relaxed text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">
                Typical severity in the
                <br />
                week before your period
              </p>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <CycleArc
              cycleDay={cycleDay}
              cycleLength={cycleLength}
              periodLength={periodLength}
              phase={cyclePhase}
            />
          </div>
        </div>
      </section>

      {/* Today + latest reflection */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Today</p>
              <h2 className="font-display text-2xl font-semibold text-ink sm:text-[1.7rem]">
                How are you feeling?
              </h2>
            </div>
            <Link
              to="/track"
              className="btn-accent min-h-[44px] px-5 py-2.5 text-sm"
            >
              Log today&apos;s symptoms
            </Link>
          </div>

          {todaysTopSymptoms.length ? (
            <div className="mt-5">
              <p className="mb-3 text-sm text-moss">
                Today you logged — strongest first:
              </p>
              <div className="flex flex-wrap gap-2">
                {todaysTopSymptoms.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-clay/30 bg-clay-soft px-3 py-1.5 text-sm font-medium text-clay-deep"
                  >
                    {s.shortLabel || s.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 max-w-md text-base leading-relaxed text-moss">
              Nothing logged yet today. A quick check-in helps you see patterns
              over time.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {QUICK_CHIPS.map((chip) => {
              const severity = todayLog?.symptoms?.[chip.id] ?? SEVERITY_MIN;
              const active = isSeverityPresent(severity);
              return (
                <Link
                  key={chip.id}
                  to="/track"
                  className={[
                    'min-h-[44px] rounded-full px-4 py-2 text-sm font-medium',
                    active ? 'chip-active' : 'chip',
                  ].join(' ')}
                >
                  {chip.label}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="border-t border-line pt-6 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <p className="eyebrow mb-3">Latest reflection</p>
          <blockquote className="border-l-2 border-clay pl-4">
            <p className="text-base leading-relaxed text-ink">
              {insightSummary}
            </p>
          </blockquote>
          <Link
            to="/insights"
            className="link-accent mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm"
          >
            Read your insight
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>

      {/* Trends + recent activity */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <section className="card p-6 sm:p-7 lg:col-span-7">
          <p className="eyebrow mb-2">Patterns</p>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Your recent pattern
          </h2>
          <p className="mt-1 text-base leading-relaxed text-moss">
            Daily severity over the last 30 days. Darker cells mean a tougher day.
          </p>
          <div className="mt-5">
            <SeverityHeatmap logs={logs} days={30} />
          </div>
        </section>

        <section className="lg:col-span-5">
          <p className="eyebrow mb-2">Recent activity</p>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Last 7 days
          </h2>
          <div className="mt-4">
            {recentLogs.slice(0, 5).map(({ date, log }) => {
              const avg = log ? averageSeverity(log.symptoms) : null;
              return (
                <Link
                  key={date}
                  to={`/track?date=${date}`}
                  className="group flex min-h-[44px] items-center gap-3.5 border-b border-line py-3.5 transition-colors first:pt-0 hover:bg-cream/60"
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'h-2.5 w-2.5 shrink-0 rounded-[4px]',
                      log
                        ? PHASE_SWATCHES[log.cyclePhase] || 'bg-phase-follicular'
                        : 'bg-sand',
                    ].join(' ')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">
                      {log ? 'Logged' : 'Not logged yet'}
                    </span>
                    <span className="mt-0.5 block text-sm text-moss">
                      {shortDate(date)}
                      {log
                        ? ` · Day ${log.cycleDay} · ${PHASE_LABELS[log.cyclePhase]}`
                        : ''}
                    </span>
                  </span>
                  {log ? (
                    <span className="shrink-0 text-sm font-medium text-moss">
                      Avg {avg.toFixed(1)}
                    </span>
                  ) : (
                    <span className="shrink-0 text-sm font-semibold text-clay-deep group-hover:underline">
                      Log →
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <Link
            to="/track"
            className="link-accent mt-4 inline-flex min-h-[44px] items-center text-sm"
          >
            View all history
          </Link>
        </section>
      </div>

      {/* Secondary stats — expanded by default, collapsible if desired */}
      <details open className="border-t border-line pt-6">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 font-display text-xl font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
          Your stats at a glance
          <span
            aria-hidden="true"
            className="details-caret text-sm text-moss"
          >
            ›
          </span>
        </summary>
        <p className="mt-1 text-base text-moss">
          Quick summaries from your existing logs — nothing new is calculated.
        </p>
        <div className="mt-6">
          <StatCards stats={stats} />
        </div>
      </details>
    </div>
  );
}
