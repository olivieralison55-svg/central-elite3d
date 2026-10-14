"use client";

import {
  NO_SELECTION,
  selectionState,
  type ChartEntry,
  type ChartSelection,
} from "@/components/ui/chart-types";

/**
 * Horizontal bar rows. The pale "ghost" fill is `entry.total` (distribution
 * ignoring this chart's own filter); the solid fill is `entry.current`.
 * Entries render in the order given — slicing/sorting belongs to the caller.
 */
export default function BarChart({
  entries,
  basis,
  selected = NO_SELECTION,
  onToggle,
  emptyLabel = "Sem dados no filtro atual.",
}: ChartSelection & {
  entries: ChartEntry[];
  /** Denominator of the percentage column. Defaults to the sum of `current`. */
  basis?: number;
  emptyLabel?: string;
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...entries.map((e) => e.total));
  const denom = (basis ?? entries.reduce((acc, e) => acc + e.current, 0)) || 1;

  const rows = entries.map((e) => ({
    entry: e,
    pct: Math.round((e.current / denom) * 100),
  }));

  // The value column is sized from the widest label it will actually hold, in
  // `ch` (digits are one `ch` wide under tabular-nums). A fixed width wrapped
  // "156 · 37%" onto two lines while "98 · 23%" stayed on one; an `auto` column
  // would fit each row separately and the numbers would stop lining up, since
  // every row is its own grid.
  // +1ch of slack: `ch` is the width of a digit, and `%` is wider than a digit
  // in this face — sizing to the exact character count would cut it fine.
  const valueCh = Math.max(...rows.map((r) => `${r.entry.current} · ${r.pct}%`.length)) + 1;

  return (
    <div className="flex flex-col gap-0.5">
      {rows.map(({ entry: e, pct }) => {
        const state = selectionState(selected, e.value);
        return (
          <button
            key={e.value}
            type="button"
            onClick={() => onToggle?.(e.value)}
            title={e.label}
            style={{ gridTemplateColumns: `minmax(96px,42%) 1fr ${valueCh}ch` }}
            className={`grid items-center gap-2 rounded-6 px-1.5 py-1 text-left transition-colors duration-quick hover:bg-selected ${
              state === "sel" ? "bg-selected ring-1 ring-primary/40" : ""
            } ${state === "dim" ? "opacity-40" : ""}`}
          >
            <span className="truncate text-[12.5px] text-ink">{e.label}</span>
            <span className="relative h-4 overflow-hidden rounded-4 bg-selected">
              <span
                className="absolute inset-y-0 left-0 rounded-4 bg-primary/25"
                style={{ width: `${(e.total / max) * 100}%` }}
              />
              <span
                className="absolute inset-y-0 left-0 rounded-4 bg-primary transition-[width] duration-regular ease-out-quart"
                style={{ width: `${(e.current / max) * 100}%` }}
              />
            </span>
            <span className="whitespace-nowrap text-right text-xs tabular-nums text-ink">
              {e.current}
              <span className="text-muted"> · {pct}%</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
