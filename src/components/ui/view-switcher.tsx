"use client";

import { VIEW_NAMES, type ChartView } from "@/components/ui/chart-types";

/** Compact segmented control to switch a chart's visualization (Linear density). */
export default function ViewSwitcher({
  views,
  value,
  onChange,
}: {
  views: readonly ChartView[];
  value: ChartView;
  onChange: (next: ChartView) => void;
}) {
  return (
    <div role="tablist" className="inline-flex gap-0.5 rounded-8 bg-selected p-0.5">
      {views.map((view) => {
        const active = view === value;
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(view)}
            className={`h-6 rounded-[5px] px-2.5 text-[11px] font-medium transition-colors duration-quick ease-out-quart ${
              active ? "bg-background text-ink shadow-low" : "text-muted hover:text-ink"
            }`}
          >
            {VIEW_NAMES[view]}
          </button>
        );
      })}
    </div>
  );
}
