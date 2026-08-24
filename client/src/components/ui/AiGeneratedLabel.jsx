export function AiGeneratedLabel({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-moss ${className}`.trim()}
    >
      AI-generated
    </span>
  );
}
