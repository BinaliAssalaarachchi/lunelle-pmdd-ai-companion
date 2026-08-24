import { useId } from 'react';
import { calculateCyclePhase } from '../../../../shared/cycle.js';

/* Pink + teal only — lighter/brighter than the card glass so they stay distinct */
const DIAL_PHASE_COLORS = {
  menstrual: { highlight: '#fff5fb', mid: '#ffc4e4', edge: '#f472b6' },
  follicular: { highlight: '#f0fffc', mid: '#7af0e0', edge: '#14b8a6' },
  ovulatory: { highlight: '#fff0f7', mid: '#ff9bcc', edge: '#ec4899' },
  luteal: { highlight: '#f4fffd', mid: '#c4fff5', edge: '#2dd4bf' },
};

export function CycleArc({
  cycleDay,
  cycleLength,
  periodLength,
  phase,
  compact = false,
  variant = 'dark',
}) {
  const uid = useId().replace(/:/g, '');
  const size = compact ? 140 : 220;
  const center = size / 2;
  const radius = compact ? 56 : 92;
  const todayR = compact ? 6.5 : 8.5;
  const dotR = compact ? 3.8 : 5;
  const light = variant === 'light';
  const dots = Array.from({ length: cycleLength }, (_, index) => {
    const day = index + 1;
    const angle = (index / cycleLength) * 2 * Math.PI - Math.PI / 2;
    return {
      day,
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      phase: calculateCyclePhase(day, cycleLength, periodLength),
      isToday: day === cycleDay,
    };
  });

  return (
    <div
      className={
        compact
          ? 'relative h-32 w-32 shrink-0'
          : 'relative h-56 w-56 shrink-0 sm:h-64 sm:w-64'
      }
      role="img"
      aria-label={`Cycle day ${cycleDay} of ${cycleLength}, ${phase} phase`}
    >
      <svg className="h-full w-full" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          {Object.entries(DIAL_PHASE_COLORS).map(([key, colors]) => (
            <radialGradient
              key={key}
              id={`${uid}-${key}`}
              cx="32%"
              cy="28%"
              r="72%"
            >
              <stop offset="0%" stopColor={colors.highlight} />
              <stop offset="45%" stopColor={colors.mid} />
              <stop offset="100%" stopColor={colors.edge} />
            </radialGradient>
          ))}
          <filter id={`${uid}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0.35" dy="0.9" stdDeviation="0.7" floodOpacity="0.28" />
          </filter>
        </defs>
        {dots.map((dot) => (
          <circle
            key={dot.day}
            cx={dot.x}
            cy={dot.y}
            r={dot.isToday ? todayR : dotR}
            fill={`url(#${uid}-${dot.phase})`}
            stroke={dot.isToday ? (light ? 'rgba(255,255,255,0.9)' : '#ffffff') : 'rgba(255,255,255,0.45)'}
            strokeWidth={dot.isToday ? (compact ? 1.6 : 2) : 0.6}
            filter={`url(#${uid}-shadow)`}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={[
            'font-bold uppercase tracking-[0.22em]',
            compact ? 'text-xs' : 'text-sm',
            light
              ? 'text-moss'
              : 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]',
          ].join(' ')}
        >
          Day
        </span>
        <span
          className={[
            'font-display font-bold leading-none',
            compact ? 'text-3xl' : 'text-6xl',
            light
              ? 'text-ink'
              : 'text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]',
          ].join(' ')}
        >
          {cycleDay}
        </span>
        <span
          className={[
            'font-bold',
            compact ? 'mt-0.5 text-xs' : 'mt-1.5 text-sm',
            light
              ? 'text-moss'
              : 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]',
          ].join(' ')}
        >
          of {cycleLength}
        </span>
      </div>
    </div>
  );
}
