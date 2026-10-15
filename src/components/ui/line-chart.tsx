"use client";

import {
  colorAt,
  NO_SELECTION,
  selectionState,
  type ChartSelection,
  type ChartSeries,
  type ChartTick,
} from "@/components/ui/chart-types";
import { useMeasure } from "@/components/ui/use-measure";

/** Multi-series line over a shared tick axis — one line per category. */
export default function LineChart({
  ticks,
  series,
  selected = NO_SELECTION,
  onToggle,
}: ChartSelection & {
  ticks: ChartTick[];
  series: ChartSeries[];
}) {
  const [ref, measured] = useMeasure<HTMLDivElement>();
  const W = measured || 520;
  const H = 150;
  const pad = 24;

  const bw = (W - pad * 2) / Math.max(ticks.length, 1);
  const maxN = Math.max(1, ...series.flatMap((s) => s.points));

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[150px] w-full">
        <line x1={pad} y1={H - 22} x2={W - pad} y2={H - 22} stroke="var(--line)" />
        {series.map((s, si) => {
          const color = colorAt(si, s.color);
          let path = "";
          const dots: React.ReactNode[] = [];
          ticks.forEach((t, i) => {
            const n = s.points[i] ?? 0;
            const x = pad + i * bw + bw / 2;
            const y = H - 22 - (n / maxN) * (H - 38);
            path += (i ? "L" : "M") + x + " " + y + " ";
            if (n) {
              dots.push(
                <circle key={t.key} cx={x} cy={y} r={3} fill={color}>
                  <title>
                    {s.label} — {t.key}: {n}
                  </title>
                </circle>,
              );
            }
          });
          const op = selectionState(selected, s.value) === "dim" ? 0.25 : 1;
          return (
            <g key={s.value} opacity={op}>
              <path d={path} fill="none" stroke={color} strokeWidth={1.8} />
              {dots}
            </g>
          );
        })}
        {ticks.map((t, i) => {
          if (bw < 18 && i % 2) return null;
          return (
            <text
              key={t.key}
              x={pad + i * bw + bw / 2}
              y={H - 8}
              fontSize={9}
              textAnchor="middle"
              fill="var(--muted)"
            >
              {t.label}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
        {series.map((s, si) => {
          const state = selectionState(selected, s.value);
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onToggle?.(s.value)}
              className={`flex items-center gap-1.5 rounded-6 px-1.5 py-0.5 text-xs transition-colors duration-quick hover:bg-selected ${
                state === "sel" ? "bg-selected ring-1 ring-primary/40" : ""
              } ${state === "dim" ? "opacity-40" : ""}`}
            >
              <span
                className="h-2.5 w-2.5 flex-none rounded-[3px]"
                style={{ backgroundColor: colorAt(si, s.color) }}
              />
              <span className="max-w-[160px] truncate text-ink" title={s.label}>
                {s.label}
              </span>
              <span className="tabular-nums text-muted">{s.current}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
