import { suggestionCardLabel } from '../../../../shared/suggestionCategories.js';
import hydrationArt from '../../assets/suggestions/hydration.png';
import restSleepArt from '../../assets/suggestions/rest_sleep.png';
import movementArt from '../../assets/suggestions/gentle_movement.png';
import warmthArt from '../../assets/suggestions/warmth_comfort.png';
import nourishmentArt from '../../assets/suggestions/nourishment.png';
import mindfulnessArt from '../../assets/suggestions/mindfulness.png';
import reachingOutArt from '../../assets/suggestions/reaching_out.png';
import reflectionArt from '../../assets/suggestions/reflection.png';

const ART = {
  hydration: hydrationArt,
  rest_sleep: restSleepArt,
  gentle_movement: movementArt,
  warmth_comfort: warmthArt,
  nourishment: nourishmentArt,
  mindfulness: mindfulnessArt,
  reaching_out: reachingOutArt,
  reflection: reflectionArt,
};

const TINTS = {
  hydration: {
    card: 'bg-fern-soft',
    icon: 'bg-cream text-pine-deep',
  },
  rest_sleep: {
    card: 'bg-plum-soft',
    icon: 'bg-cream text-plum-deep',
  },
  gentle_movement: {
    card: 'bg-fern-soft',
    icon: 'bg-cream text-pine-deep',
  },
  warmth_comfort: {
    card: 'bg-clay-soft',
    icon: 'bg-cream text-clay-deep',
  },
  nourishment: {
    card: 'bg-ochre-soft',
    icon: 'bg-cream text-ochre-deep',
  },
  mindfulness: {
    card: 'bg-plum-soft',
    icon: 'bg-cream text-plum-deep',
  },
  reaching_out: {
    card: 'bg-clay-soft',
    icon: 'bg-cream text-clay-deep',
  },
  reflection: {
    card: 'bg-ochre-soft',
    icon: 'bg-cream text-ochre-deep',
  },
};

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function SuggestionIcon({ categoryId }) {
  return (
    <svg viewBox="0 0 56 56" className="h-5 w-5" aria-hidden="true">
      {categoryId === 'hydration' ? (
        <>
          <path d="M28 8s-14 15.5-14 26a14 14 0 0 0 28 0C42 23.5 28 8 28 8Z" {...stroke} />
          <path d="M22 32c1.4-4 3.8-7 6-8" {...stroke} />
        </>
      ) : null}
      {categoryId === 'rest_sleep' ? (
        <>
          <path d="M36 12.5A16 16 0 1 0 43 36 13 13 0 0 1 36 12.5Z" {...stroke} />
          <path d="M14 42h22" {...stroke} />
        </>
      ) : null}
      {categoryId === 'gentle_movement' ? (
        <>
          <circle cx="32" cy="12" r="4" {...stroke} />
          <path d="M20 48l6-16 5 7 8 9" {...stroke} />
          <path d="M26 32 18 26 25 18h11l6 8" {...stroke} />
        </>
      ) : null}
      {categoryId === 'warmth_comfort' ? (
        <path d="M28 44s-16-10-16-20.5A9 9 0 0 1 28 18.5 9 9 0 0 1 44 23.5C44 34 28 44 28 44Z" {...stroke} />
      ) : null}
      {categoryId === 'nourishment' ? (
        <>
          <path d="M14 42c16-2.5 27-16 29-29C32 15 18 26 14 42Z" {...stroke} />
          <path d="M16 46h18" {...stroke} />
        </>
      ) : null}
      {categoryId === 'mindfulness' ? (
        <>
          <path d="M10 22c4.5-6 7-6 11 0s7 6 11 0 7-6 11 0 5 4.5 7 0" {...stroke} />
          <path d="M10 32c4.5-6 7-6 11 0s7 6 11 0 7-6 11 0 5 4.5 7 0" {...stroke} />
        </>
      ) : null}
      {categoryId === 'reaching_out' ? (
        <>
          <circle cx="22" cy="18" r="6" {...stroke} />
          <circle cx="36" cy="20" r="5" {...stroke} />
          <path d="M10 44c1.4-6 5.5-9 12-9s10.6 3 12 9" {...stroke} />
        </>
      ) : null}
      {categoryId === 'reflection' ||
      ![
        'hydration',
        'rest_sleep',
        'gentle_movement',
        'warmth_comfort',
        'nourishment',
        'mindfulness',
        'reaching_out',
      ].includes(categoryId) ? (
        <>
          <rect x="14" y="10" width="28" height="36" rx="3" {...stroke} />
          <path d="M21 10v36M28 20h8M28 28h8" {...stroke} />
        </>
      ) : null}
    </svg>
  );
}

export function SuggestionCard({ categoryId, text }) {
  const label = suggestionCardLabel(categoryId);
  const tint = TINTS[categoryId] || TINTS.reflection;
  const art = ART[categoryId] || ART.reflection;

  return (
    <article
      className={`flex min-h-[230px] overflow-hidden rounded-3xl ${tint.card}`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center p-5 sm:p-6">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${tint.icon}`}
        >
          <SuggestionIcon categoryId={categoryId} />
        </span>
        <h4 className="mt-4 font-display text-xl font-semibold leading-snug text-ink">
          {label}
        </h4>
        <p className="mt-2 text-base leading-relaxed text-moss">{text}</p>
      </div>
      <div className="flex w-[42%] shrink-0 items-end justify-center self-stretch p-1 sm:w-[46%] sm:p-2">
        <img
          src={art}
          alt=""
          className="h-full w-full object-contain object-bottom"
        />
      </div>
    </article>
  );
}
