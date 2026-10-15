import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

const VARIANTS = {
  info: { cls: "border-info/30 bg-info-soft text-info", Icon: Info },
  success: { cls: "border-success/30 bg-success-soft text-success", Icon: CircleCheck },
  warning: { cls: "border-warning/30 bg-warning-soft text-warning", Icon: TriangleAlert },
  danger: { cls: "border-danger/30 bg-danger-soft text-danger", Icon: CircleAlert },
} as const;

export type AlertVariant = keyof typeof VARIANTS;

/**
 * Inline callout for a state the reader must notice (error, missing config,
 * heads-up). Replaces the hand-rolled `rounded-8 border bg-*-soft p-3` banners
 * that were repeated in ~30 views.
 */
export default function Alert({
  variant = "info",
  title,
  action,
  children,
  className = "",
}: {
  variant?: AlertVariant;
  title?: React.ReactNode;
  /** Optional trailing control (button, link). */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const { cls, Icon } = VARIANTS[variant];
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-8 border p-3 text-xs ${cls} ${className}`}
    >
      <Icon size={15} className="mt-px shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
