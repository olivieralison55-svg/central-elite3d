const TONES = {
  neutral: "bg-muted",
  primary: "bg-primary",
  success: "bg-success-accent",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  purple: "bg-purple",
} as const;

export type StatusDotTone = keyof typeof TONES;

/** 6px status dot. For data colours (sector hex) pass `color`. */
export default function StatusDot({
  tone = "neutral",
  color,
  label,
  className = "",
}: {
  tone?: StatusDotTone;
  color?: string;
  /** Accessible name when the dot is the only signal. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${color ? "" : TONES[tone]} ${className}`}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}
