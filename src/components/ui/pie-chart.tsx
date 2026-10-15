"use client";

import {
  colorAt,
  NO_SELECTION,
  selectionState,
  type ChartEntry,
  type ChartSelection,
} from "@/components/ui/chart-types";

/** Donut chart + interactive legend. Slice size uses `entry.current`. */
export default function PieChart({
  entries,
  selected = NO_SELECTION,
  onToggle,
  emptyLabel = "Sem dados no filtro atual.",
}: ChartSelection & {
  entries: ChartEntry[];
  emptyLabel?: string;
}) {
  const slices = entries.map((e, i) => ({ ...e, color: colorAt(i, e.color) }));
  const sum = slices.reduce((acc, s) => acc + s.current, 0);

  if (!sum) {
    return <p className="text-xs text-muted">{emptyLabel}</p>;
  }

  const cx = 80;
  const cy = 80;
  const R = 72;
  const r = 44;
  const arc = (a0: number, a1: number) => {
    a1 = Math.min(a1, a0 + 2 * Math.PI * 0.9999);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return (
      `M${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)}` +
      `A${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}` +
      `L${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}` +
      `A${r} ${r} 0 ${large} 0 ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}Z`
    );
  };

  let a0 = -Math.PI / 2;
  const paths = slices
    .filter((s) => s.current)
    .map((s) => {
      const a1 = a0 + (s.current / sum) * 2 * Math.PI;
      const dimmed = selectionState(selected, s.value) === "dim";
      const d = arc(a0, a1);
      a0 = a1;
      return (
        <path
          key={s.value}
          d={d}
          fill={s.color}
          stroke="var(--background)"
          strokeWidth={1.5}
          className={`cursor-pointer transition-opacity duration-quick ${dimmed ? "opacity-30" : ""}`}
          onClick={() => onToggle?.(s.value)}
        >
          <title>
            {s.label} — {s.current} ({Math.round((s.current / sum) * 100)}%)
          </title>
        </path>
      );
    });

  return (
    <div className="flex flex-wrap items-center gap-3.5">
      <svg viewBox="0 0 160 160" className="h-40 w-40 flex-none">
        {paths}
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize={20}
          fontWeight={680}
          fill="var(--ink)"
        >
          {sum}
        </text>
      </svg>
      <div className="flex min-w-[150px] flex-1 flex-col gap-0.5">
        {slices.map((s) => {
          const state = selectionState(selected, s.value);
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onToggle?.(s.value)}
              className={`flex items-center gap-2 rounded-6 px-1.5 py-0.5 text-left text-xs transition-colors duration-quick hover:bg-selected ${
                state === "sel" ? "bg-selected ring-1 ring-primary/40" : ""
              } ${state === "dim" ? "opacity-40" : ""}`}
            >
              <span
                className="h-2.5 w-2.5 flex-none rounded-[3px]"
                style={{ backgroundColor: s.color }}
              />
              <span className="min-w-0 flex-1 truncate text-ink" title={s.label}>
                {s.label}
              </span>
              <span className="tabular-nums text-muted">
                {s.current} · {Math.round((s.current / sum) * 100)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
