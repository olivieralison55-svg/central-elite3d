const VARIANTS = {
  success:
    "bg-success-soft text-success dark:bg-success-accent/15 dark:text-success-accent",
  danger:
    "bg-danger-soft text-danger dark:bg-danger-accent/15 dark:text-danger-accent",
  warning:
    "bg-warning-soft text-warning dark:bg-warning-accent/15 dark:text-warning-accent",
  info: "bg-info-soft text-info dark:bg-info-accent/15 dark:text-info-accent",
  purple:
    "bg-purple-soft text-purple dark:bg-purple-accent/15 dark:text-purple-accent",
  neutral: "bg-selected text-ink",
  primary: "bg-primary text-white",
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

export default function Badge({
  variant = "neutral",
  dot = false,
  children,
  className = "",
}: {
  variant?: BadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold ${VARIANTS[variant]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-md bg-current" />}
      {children}
    </span>
  );
}
