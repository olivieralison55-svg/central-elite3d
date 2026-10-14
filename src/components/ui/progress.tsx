const TONES = {
  primary: "bg-primary",
  success: "bg-success-accent",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

export type ProgressTone = keyof typeof TONES;

/**
 * Determinate progress bar (upload, generation, quota). `value` is clamped to
 * 0–100. Distinct from RateBars, which is a labelled chart row.
 */
export default function Progress({
  value,
  tone = "primary",
  label,
  className = "",
}: {
  value: number;
  tone?: ProgressTone;
  /** Accessible name; required when there is no visible label nearby. */
  label?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-selected ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-regular ease-out-quart ${TONES[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
