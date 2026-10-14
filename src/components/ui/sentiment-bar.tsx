export interface SentimentSegment {
  label: string;
  value: number;
  /** Token-based color class (e.g. "bg-success-accent") or raw CSS color via `color`. */
  colorClassName?: string;
  color?: string;
  /** Optional precomputed percentage for the legend (else rounded from value/total). */
  pct?: number;
}

/**
 * Horizontal stacked distribution bar with a dot legend — generic for
 * any 2+-segment split (sentiment, status mix, quota usage). Segment
 * widths are proportional to values; a zero total renders an empty
 * track with the legend at 0.
 */
export default function SentimentBar({
  segments,
  className = "",
}: {
  segments: SentimentSegment[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className={className}>
      <div
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
        className="flex h-2.5 overflow-hidden rounded-full bg-selected"
      >
        {total > 0 &&
          segments.map((s) => (
            <div
              key={s.label}
              className={`h-full ${s.colorClassName ?? ""}`}
              style={{
                width: `${(s.value / total) * 100}%`,
                ...(s.color ? { backgroundColor: s.color } : {}),
              }}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => {
          const pct = s.pct ?? (total > 0 ? Math.round((s.value / total) * 100) : 0);
          return (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span
                className={`h-1.5 w-1.5 rounded-full ${s.colorClassName ?? ""}`}
                style={s.color ? { backgroundColor: s.color } : undefined}
              />
              {s.label} <strong className="font-semibold text-ink">{s.value}</strong> ({pct}%)
            </span>
          );
        })}
      </div>
    </div>
  );
}
