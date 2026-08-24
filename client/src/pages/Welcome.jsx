import { useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { BrandLockup } from '../components/ui/BrandMark.jsx';
import trackArt from '../assets/welcome/track.png';
import insightsArt from '../assets/welcome/insights.png';
import reportsArt from '../assets/welcome/reports.png';
import partnerArt from '../assets/welcome/partner.png';
import coachArt from '../assets/welcome/coach.png';

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

function HeroSparkles() {
  return (
    <>
      <span
        aria-hidden="true"
        className="hero-twinkle absolute right-[15%] top-[9%] h-1.5 w-1.5 rounded-full bg-cream/90"
      />
      <span
        aria-hidden="true"
        className="hero-twinkle absolute right-[7%] top-[33%] h-1 w-1 rounded-full bg-[#99f6e4]/85"
        style={{ animationDelay: '1.4s' }}
      />
      <span
        aria-hidden="true"
        className="hero-twinkle absolute right-[27%] top-[5%] h-1 w-1 rounded-full bg-[#fce7f3]/80"
        style={{ animationDelay: '2.6s' }}
      />
    </>
  );
}

/* Swipeable preview of Lunelle's core features, with pill-style dot pagination */
function FeatureCarousel() {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const dragStartX = useRef(null);

  const slides = [
    {
      key: 'track',
      label: 'Track',
      art: trackArt,
      heading: 'Track in two minutes',
      text: 'A quick daily check-in — symptoms, mood, and energy, without the clinical feel.',
    },
    {
      key: 'insights',
      label: 'AI Insights',
      art: insightsArt,
      heading: 'Understand your patterns',
      text: 'Gemini-powered insights that connect your symptoms to your cycle — never a diagnosis, always supportive.',
    },
    {
      key: 'reports',
      label: 'Reports',
      art: reportsArt,
      heading: 'Bring it to your doctor',
      text: 'A clean, clinician-ready report — or a gentle personal summary, whichever you need.',
    },
    {
      key: 'partner',
      label: 'Partner sharing',
      art: partnerArt,
      heading: 'Share on your terms',
      text: 'Invite someone you trust to see only what you choose — never your full private record.',
      artClassName: 'scale-[1.05]',
    },
    {
      key: 'coach',
      label: 'Doctor Coach',
      art: coachArt,
      heading: 'Find the words',
      text: 'Doctor Coach turns what you’ve logged into a clear, calm script for your appointment — never a diagnosis.',
      artClassName: 'scale-[1.06]',
    },
  ];

  const last = slides.length - 1;
  const clamp = (i) => Math.min(Math.max(i, 0), last);

  const handlePointerDown = (event) => {
    dragStartX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (dragStartX.current === null) return;
    let dx = event.clientX - dragStartX.current;
    // Rubber-band past the first/last slide
    if ((index === 0 && dx > 0) || (index === last && dx < 0)) dx *= 0.35;
    setDragX(dx);
  };

  const endDrag = (event) => {
    if (dragStartX.current === null) return;
    const dx = event.clientX - dragStartX.current;
    const threshold = event.currentTarget.clientWidth * 0.18;
    if (dx < -threshold) setIndex((i) => clamp(i + 1));
    else if (dx > threshold) setIndex((i) => clamp(i - 1));
    dragStartX.current = null;
    setDragX(0);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') setIndex((i) => clamp(i - 1));
    if (event.key === 'ArrowRight') setIndex((i) => clamp(i + 1));
  };

  const dragging = dragStartX.current !== null;

  return (
    <div>
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Lunelle feature preview"
        tabIndex={0}
        className="cursor-grab overflow-hidden rounded-xl focus-visible:outline-clay-deep active:cursor-grabbing"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(calc(${-index * 100}% + ${dragX}px))`,
            transition: dragging ? 'none' : 'transform 0.35s ease',
          }}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.key}
              className="w-full shrink-0 select-none"
              aria-hidden={i !== index}
            >
              <div className="flex flex-col items-center px-2 text-center">
                <span className="inline-flex h-36 w-36 rounded-full border-2 border-ink sm:h-40 sm:w-40">
                  <span className="h-full w-full overflow-hidden rounded-full">
                    <img
                      src={slide.art}
                      alt=""
                      aria-hidden="true"
                      draggable="false"
                      className={`h-full w-full object-cover ${slide.artClassName ?? ''}`}
                    />
                  </span>
                </span>
                <p className="display-italic mt-4 text-xl leading-snug text-ink sm:text-2xl">
                  {slide.heading}
                </p>
                <p className="mt-2 min-h-[3.75rem] max-w-xs text-sm font-medium leading-relaxed text-ink/80">
                  {slide.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slide.key}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show slide: ${slide.label}`}
            aria-current={i === index ? 'true' : undefined}
            className="rounded-full p-1"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === index
                  ? 'w-6 bg-pine'
                  : 'w-1.5 bg-pine/30 hover:bg-pine/50'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Welcome() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const authState = location.state?.from ? { from: location.state.from } : undefined;

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="welcome-ambient flex min-h-screen flex-col px-5 py-8 md:px-16 lg:px-24">
      <header className="flex items-center justify-between">
        <BrandLockup markClassName="h-12 w-12" textClassName="text-4xl" />
        <Link
          to="/login"
          state={authState}
          className="btn-login-soft min-h-[44px] px-5 py-2 text-sm"
        >
          Log in
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 py-14 md:grid-cols-2 md:gap-16">
        <div>
          <p className="eyebrow mb-4 text-clay-deep">Cycle & PMDD companion</p>
          <h1 className="font-display text-[2.75rem] font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
            Understand your rhythm.
            <span className="display-italic mt-1 block text-clay-deep">
              Feel more prepared.
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-moss">
            Lunelle helps you understand your cycle and the patterns in how you
            feel — in a way that feels calm, personal, and private.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/signup"
              state={authState}
              className="btn-accent min-h-[52px] w-full px-8 py-3.5 text-sm sm:w-auto"
            >
              Get started
            </Link>
            <Link
              to="/login"
              state={authState}
              className="btn-primary min-h-[52px] w-full px-8 py-3.5 text-sm sm:w-auto"
            >
              Log in
            </Link>
          </div>

          <p className="mt-8 flex items-center gap-2 text-sm text-moss">
            <LockIcon />
            <span>Your cycle and symptom data stays private.</span>
          </p>
        </div>

        <div className="card-hero relative overflow-hidden p-5 sm:p-8">
          <HeroSparkles />

          <div className="glass-panel p-5 sm:p-6">
            <FeatureCarousel />
          </div>
        </div>
      </main>
    </div>
  );
}
