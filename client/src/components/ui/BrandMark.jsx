import logoMark from '../../assets/lunelle-logo-mark.png';

export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <img
      src={logoMark}
      alt=""
      aria-hidden="true"
      className={`${className} shrink-0 rounded-full object-cover`}
    />
  );
}

export function BrandLockup({
  markClassName = 'h-9 w-9',
  textClassName = 'text-2xl',
  className = '',
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      <span
        className={`brand-wordmark font-display font-semibold tracking-tight ${textClassName}`}
      >
        Lunelle
        <span aria-hidden="true" className="brand-wordmark-dot">
          .
        </span>
      </span>
    </span>
  );
}
