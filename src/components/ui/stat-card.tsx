import { Card } from "./card";
import IconChip from "./icon-chip";
import Sparkline from "./sparkline";

/** Metric card with semantic delta and trend line (dash-ref-01).
 *  `compact` = denser variant for secondary/sidebar contexts. */
export default function StatCard({
  label,
  icon,
  value,
  delta,
  deltaLabel = "vs mês anterior",
  caption,
  trend,
  compact = false,
}: {
  label: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  caption?: string;
  trend?: number[];
  compact?: boolean;
}) {
  const positive = (delta ?? 0) >= 0;

  if (compact) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          {icon && <IconChip className="h-7 w-7 rounded-6">{icon}</IconChip>}
          <span className="text-xs font-medium text-muted">{label}</span>
          {delta !== undefined && (
            <span
              className={`ml-auto text-[11px] font-bold ${positive ? "text-success-accent" : "text-danger"}`}
            >
              {positive ? "+" : ""}
              {delta}%
            </span>
          )}
        </div>
        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-ink">
              {value}
            </p>
            {caption && (
              <p className="mt-1 truncate text-[11px] text-muted">{caption}</p>
            )}
          </div>
          {trend && <Sparkline data={trend} width={72} height={22} positive={positive} />}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 border-b border-dashed border-line pb-4">
        {icon && <IconChip>{icon}</IconChip>}
        <span className="text-sm font-semibold text-ink">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-3 pt-4">
        <div>
          <p className="text-[34px] font-extrabold leading-none tracking-[-0.02em] text-ink">
            {value}
          </p>
          {delta !== undefined && (
            <p className="mt-2.5 flex items-center gap-1 text-xs text-muted">
              <span
                className={`font-bold ${positive ? "text-success-accent" : "text-danger"}`}
              >
                {positive ? "+" : ""}
                {delta}%
              </span>
              {deltaLabel}
            </p>
          )}
          {caption && delta === undefined && (
            <p className="mt-2.5 text-xs text-muted">{caption}</p>
          )}
        </div>
        {trend && <Sparkline data={trend} positive={positive} />}
      </div>
    </Card>
  );
}
