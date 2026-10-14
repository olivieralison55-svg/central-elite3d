import { Card } from "@/components/ui/card";
import ViewSwitcher from "@/components/ui/view-switcher";
import type { ChartView } from "@/components/ui/chart-types";

/** Card shell for a chart: title, optional view switcher, body and description. */
export default function ChartCard({
  title,
  count,
  views,
  view,
  onViewChange,
  headerExtra,
  description,
  children,
}: {
  title: React.ReactNode;
  count?: React.ReactNode;
  views?: readonly ChartView[];
  view?: ChartView;
  onViewChange?: (next: ChartView) => void;
  headerExtra?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col p-5 shadow-card">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-bold text-ink">{title}</h3>
        {count !== undefined && (
          <span className="text-xs font-medium tabular-nums text-primary">{count}</span>
        )}
        {headerExtra}
        {views && views.length > 1 && view && onViewChange && (
          <div className="ml-auto">
            <ViewSwitcher views={views} value={view} onChange={onViewChange} />
          </div>
        )}
      </header>
      <div className="flex-1">{children}</div>
      {description && (
        <p className="mt-4 border-t border-dashed border-line pt-3 text-xs leading-relaxed text-muted [&_b]:font-semibold [&_b]:text-ink">
          {description}
        </p>
      )}
    </Card>
  );
}
