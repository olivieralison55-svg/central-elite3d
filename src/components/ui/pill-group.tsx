"use client";

import {
  NO_SELECTION,
  selectionState,
  type ChartEntry,
  type ChartSelection,
} from "@/components/ui/chart-types";

/** Selectable pills — for low-cardinality dimensions and free tag clouds. */
export default function PillGroup({
  entries,
  selected = NO_SELECTION,
  onToggle,
  emptyLabel = "Sem dados no filtro atual.",
}: ChartSelection & {
  entries: ChartEntry[];
  emptyLabel?: string;
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((e) => {
        const state = selectionState(selected, e.value);
        return (
          <button
            key={e.value}
            type="button"
            onClick={() => onToggle?.(e.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-quick ${
              state === "sel"
                ? "border-primary bg-primary text-white"
                : "border-line bg-background text-ink hover:border-primary"
            } ${state === "dim" ? "opacity-40" : ""}`}
          >
            {e.label}
            <b className="tabular-nums">{e.current}</b>
          </button>
        );
      })}
    </div>
  );
}
