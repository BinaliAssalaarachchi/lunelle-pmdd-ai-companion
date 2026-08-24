const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function SymptomIcon({ id, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {id === 'depressed_mood' ? (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <path d="M8.5 10h.01M15.5 10h.01M8.5 15.5c1.1-1.2 2.4-1.8 3.5-1.8s2.4.6 3.5 1.8" {...common} />
        </>
      ) : null}
      {id === 'anxiety' ? (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <path d="M8.5 10h.01M15.5 10h.01M9 15.5h6" {...common} />
          <path d="M12 4.5 13 7" {...common} />
        </>
      ) : null}
      {id === 'mood_swings' ? (
        <path d="M4 14c2.2-4 4.2-6 8-6s5.8 2 8 6M4 10c2.2 4 4.2 6 8 6s5.8-2 8-6" {...common} />
      ) : null}
      {id === 'anger' ? (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <path d="M8 9.2 10 10.5M16 9.2 14 10.5M9 15.5h6" {...common} />
        </>
      ) : null}
      {id === 'reduced_interest' ? (
        <>
          <path d="M12 4 13.2 8.2 17.5 9.5 13.2 10.8 12 15 10.8 10.8 6.5 9.5 10.8 8.2Z" {...common} />
          <path d="M7 18h10" {...common} />
        </>
      ) : null}
      {id === 'concentration' ? (
        <>
          <circle cx="12" cy="12" r="7" {...common} />
          <circle cx="12" cy="12" r="2.2" {...common} />
        </>
      ) : null}
      {id === 'fatigue' ? (
        <path d="M13 3 6 13h6l-1 8 7-10h-6l1-8Z" {...common} />
      ) : null}
      {id === 'appetite' ? (
        <>
          <path d="M5 11c0 5 3 9 7 9s7-4 7-9H5Z" {...common} />
          <path d="M8 11V7M12 11V5M16 11V7" {...common} />
        </>
      ) : null}
      {id === 'sleep' ? (
        <path d="M15 6.5A7 7 0 1 0 18 16 5.5 5.5 0 0 1 15 6.5Z" {...common} />
      ) : null}
      {id === 'overwhelmed' ? (
        <path d="M7 8c2-3 4-3 5 0s3 3 5 0M7 13c2-3 4-3 5 0s3 3 5 0M8 18c1.4-2 2.6-2 4 0" {...common} />
      ) : null}
      {id === 'physical_symptoms' ? (
        <>
          <circle cx="12" cy="6" r="2.2" {...common} />
          <path d="M8 21v-7l-2.5-4.5M16 21v-7l2.5-4.5M9.5 11h5" {...common} />
        </>
      ) : null}
      {id === 'productivity' ? (
        <>
          <rect x="4" y="7" width="16" height="12" rx="2" {...common} />
          <path d="M8 7V6a4 4 0 0 1 8 0v1" {...common} />
        </>
      ) : null}
      {id === 'activities' ? (
        <>
          <circle cx="12" cy="7" r="2.2" {...common} />
          <path d="M6 20l3-7 3 3 3-3 3 7" {...common} />
        </>
      ) : null}
      {id === 'relationships' ? (
        <>
          <circle cx="9" cy="8" r="2.4" {...common} />
          <circle cx="16" cy="9" r="2" {...common} />
          <path d="M4 19c.8-3.2 3-5 5.2-5s4.2 1.6 5 4.2M14.5 19c.5-2.2 2-3.4 3.8-3.4 1.6 0 2.8 1 3.2 2.8" {...common} />
        </>
      ) : null}
    </svg>
  );
}
