const TONES = {
  success: "bg-success-accent",
  primary: "bg-primary",
  warning: "bg-warning",
  danger: "bg-danger",
  // Translucent, so a step not reached stays visible on any surface, hovered rows included.
  neutral: "bg-line-strong",
} as const;

export type SegmentedProgressTone = keyof typeof TONES;

/**
 * Step-by-step progress: one short bar per step, each in its own tone (a
 * 12-step track, for instance). Same skin as Progress. Each segment shows its
 * label as a tooltip; the set is announced once, by `label`.
 */
export default function SegmentedProgress({
  segments,
  label,
}: {
  segments: { tone: SegmentedProgressTone; label: string }[];
  /** Accessible name of the whole set, e.g. "3 of 12 steps done". */
  label: string;
}) {
  return (
    <div role="img" aria-label={label} className="inline-flex items-center gap-0.5">
      {segments.map((segment, i) => (
        <span key={i} title={segment.label} className={`h-1.5 w-3 rounded-full ${TONES[segment.tone]}`} />
      ))}
    </div>
  );
}
