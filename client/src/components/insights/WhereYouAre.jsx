import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  PHASE_LABELS,
} from '../../../../shared/constants.js';
import { calculateCyclePhase } from '../../../../shared/cycle.js';
import { CycleArc } from '../dashboard/CycleArc.jsx';

const PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal'];

const PHASE_DOT = {
  menstrual: 'bg-phase-menstrual',
  follicular: 'bg-phase-follicular',
  ovulatory: 'bg-phase-ovulatory',
  luteal: 'bg-phase-luteal',
};

export function WhereYouAre({ cycleDay, cycleLength, periodLength }) {
  if (cycleDay == null) return null;

  const length = cycleLength || DEFAULT_CYCLE_LENGTH;
  const period = periodLength || DEFAULT_PERIOD_LENGTH;
  const phase = calculateCyclePhase(cycleDay, length, period);

  return (
    <section className="border-t border-line pt-6">
      <p className="eyebrow mb-2">Right now</p>
      <h3 className="font-display text-xl font-semibold text-ink sm:text-2xl">
        Where you are
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-moss">
        Your current cycle day and phase — the same timing used on Home.
      </p>
      <div className="card mt-4 flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
        <CycleArc
          cycleDay={cycleDay}
          cycleLength={length}
          periodLength={period}
          phase={phase}
          compact
          variant="light"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold text-ink">
            Cycle day {cycleDay}
            <span className="text-moss"> · {PHASE_LABELS[phase]}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PHASES.map((id) => {
              const current = id === phase;
              return (
                <span
                  key={id}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em]',
                    current
                      ? 'bg-clay-soft text-clay-deep'
                      : 'bg-sand text-moss',
                  ].join(' ')}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${PHASE_DOT[id]}`}
                    aria-hidden="true"
                  />
                  {PHASE_LABELS[id]}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
