import { Link } from 'react-router-dom';
import coachAvatar from '../../assets/lunelle-doctor-coach.png';

export function CoachLauncher() {
  return (
    <div className="fixed right-5 bottom-[calc(6.75rem+env(safe-area-inset-bottom,0px))] z-40 md:bottom-8 md:right-8">
      <Link
        to="/insights/coach"
        aria-label="Ask Doctor Coach"
        className="flex flex-col items-end gap-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-deep"
      >
        <span className="relative whitespace-nowrap rounded-2xl border border-line bg-clay-soft px-3.5 py-2 text-sm font-semibold leading-snug text-ink shadow-lift">
          Ask Doctor Coach
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-line bg-clay-soft"
          />
        </span>
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white shadow-lift transition duration-150 hover:-translate-y-0.5 active:translate-y-0">
          <img
            src={coachAvatar}
            alt=""
            width={56}
            height={56}
            className="h-[3.35rem] w-[3.35rem] object-contain"
          />
        </span>
      </Link>
    </div>
  );
}
