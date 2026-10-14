"use client";

import {
  NO_SELECTION,
  selectionState,
  type ChartSelection,
} from "@/components/ui/chart-types";

/**
 * Ranking by rate, not by volume. Each row carries its own denominator, so the
 * bar length is `numerator / denominator` — a small category with a high rate
 * outranks a large one with a low rate, which a count-based bar chart hides.
 *
 * Bars are scaled to the highest rate in the set rather than to 100%, otherwise
 * single-digit percentages all collapse into slivers.
 */
export interface RateEntry {
  value: string;
  label: string;
  numerator: number;
  denominator: number;
}

export default function RateBars({
  entries,
  selected = NO_SELECTION,
  onToggle,
  emptyLabel = "Sem dados no filtro atual.",
}: ChartSelection & {
  entries: RateEntry[];
  emptyLabel?: string;
}) {
  const rated = entries
    .filter((e) => e.denominator > 0)
    .map((e) => ({ ...e, rate: (e.numerator / e.denominator) * 100 }))
    .sort((a, b) => b.rate - a.rate);

  if (rated.length === 0) {
    return <p className="text-xs text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(...rated.map((r) => r.rate), 0.01);
  const valueCh =
    Math.max(...rated.map((r) => `${r.rate.toFixed(1).replace(".", ",")}%`.length)) + 1;

  return (
    <div className="flex flex-col gap-0.5">
      {rated.map((e) => {
        const state = selectionState(selected, e.value);
        return (
          <button
            key={e.value}
            type="button"
            onClick={() => onToggle?.(e.value)}
            title={`${e.label}: ${e.numerator} de ${e.denominator}`}
            style={{ gridTemplateColumns: `minmax(96px,42%) 1fr ${valueCh}ch` }}
            className={`grid items-center gap-2 rounded-6 px-1.5 py-1 text-left transition-colors duration-quick hover:bg-selected ${
              state === "sel" ? "bg-selected ring-1 ring-primary/40" : ""
            } ${state === "dim" ? "opacity-40" : ""}`}
          >
            <span className="truncate text-[12.5px] text-ink">{e.label}</span>
            <span className="relative h-4 overflow-hidden rounded-4 bg-selected">
              <span
                className="absolute inset-y-0 left-0 rounded-4 bg-danger transition-[width] duration-regular ease-out-quart"
                style={{ width: `${(e.rate / max) * 100}%` }}
              />
            </span>
            <span className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-ink">
              {e.rate.toFixed(1).replace(".", ",")}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
