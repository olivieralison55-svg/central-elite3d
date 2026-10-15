"use client";

import { useState } from "react";
import {
  NO_SELECTION,
  type ChartSelection,
  type TrendPoint,
} from "@/components/ui/chart-types";
import { useMeasure } from "@/components/ui/use-measure";

interface Tip {
  /** Centre of the hovered column, in viewBox units (= px, the svg is 1:1). */
  x: number;
  text: string;
}

/** Half the tooltip's width — how far from either edge it may still be centred. */
const TIP_HALF = 90;

/**
 * Time trend with two scales: bars/line for `point.value` (primary, brand blue)
 * and a red line for `point.ratio` (secondary, already in percent). Clicking a
 * column toggles it in `selected` — the caller decides what that filters.
 */
export default function TrendChart({
  points,
  view,
  selected = NO_SELECTION,
  onToggle,
  onClear,
  ratioLabel = "%",
  hint = "Clique em qualquer coluna para filtrar; clique de novo para desfazer. Seleção múltipla: clique em vários.",
  clearLabel = "limpar seleção",
}: ChartSelection & {
  points: TrendPoint[];
  view: "bar" | "line";
  onClear?: () => void;
  /** Caption of the right-hand ratio axis. */
  ratioLabel?: string;
  hint?: React.ReactNode;
  clearLabel?: string;
}) {
  const [ref, measured] = useMeasure<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const W = measured || 1000;
  const H = 160;
  const pad = 26;

  const bw = (W - pad * 2) / Math.max(points.length, 1);
  const maxC = Math.max(1, ...points.map((p) => p.value));
  const maxRatio = Math.max(...points.map((p) => p.ratio ?? 0), 1);
  const yRatio = (s: number) => H - 28 - (s / maxRatio) * (H - 50);
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => maxRatio / s <= 4) ?? 100;
  const hasFilter = selected.size > 0;

  const axisTicks: number[] = [];
  for (let t = 0; t <= maxRatio + 1e-6; t += step) axisTicks.push(t);

  let cline = "";
  let ratioLine = "";
  let ratioOpen = false;
  const visuals: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  const hits: React.ReactNode[] = [];

  points.forEach((p, i) => {
    const n = p.value;
    const h = Math.max((n / maxC) * (H - 50), n > 0 ? 2 : 0);
    const x = pad + i * bw;
    const isSel = selected.has(p.key);
    const fill = hasFilter ? (isSel ? "var(--primary)" : "rgba(65,105,225,0.22)") : "var(--primary)";
    const textFill = hasFilter ? (isSel ? "var(--ink)" : "var(--muted)") : "var(--ink)";
    const fw = isSel ? 680 : 400;
    const tooltip = `${p.tooltip ?? `${p.label} — ${n}`}${isSel ? " ✓" : ""}`;

    if (view === "bar") {
      visuals.push(
        <rect key={`b${i}`} x={x + 2} y={H - 28 - h} width={bw - 4} height={h} rx={3} fill={fill} />,
      );
      if (n)
        visuals.push(
          <text
            key={`bt${i}`}
            x={x + bw / 2}
            y={H - 32 - h}
            fontSize={10}
            textAnchor="middle"
            fill={textFill}
            fontWeight={fw}
          >
            {n}
          </text>,
        );
    } else {
      cline += (i ? "L" : "M") + (x + bw / 2) + " " + (H - 28 - h) + " ";
      visuals.push(
        <circle
          key={`c${i}`}
          cx={x + bw / 2}
          cy={H - 28 - h}
          r={isSel ? 6 : 4}
          fill={fill}
          stroke="var(--background)"
          strokeWidth={1}
        />,
      );
      if (n)
        visuals.push(
          <text
            key={`ct${i}`}
            x={x + bw / 2}
            y={H - 38 - h}
            fontSize={10}
            textAnchor="middle"
            fill={textFill}
            fontWeight={fw}
          >
            {n}
          </text>,
        );
    }

    // A missing ratio breaks the line instead of collapsing it to zero.
    if (p.ratio == null) {
      ratioOpen = false;
    } else {
      ratioLine += (ratioOpen ? "L" : "M") + (x + bw / 2) + " " + yRatio(p.ratio) + " ";
      ratioOpen = true;
    }

    labels.push(
      <text
        key={`l${i}`}
        x={x + bw / 2}
        y={H - 10}
        fontSize={9}
        textAnchor="middle"
        fill={isSel ? "var(--primary)" : "var(--muted)"}
        fontWeight={fw}
      >
        {p.label}
      </text>,
    );

    hits.push(
      <rect
        key={`h${i}`}
        x={x}
        y={0}
        width={bw}
        height={H - 20}
        fill="transparent"
        className="cursor-pointer"
        onClick={() => onToggle?.(p.key)}
        onMouseEnter={() => setTip({ x: x + bw / 2, text: tooltip })}
        onMouseLeave={() => setTip(null)}
      />,
    );
  });

  const chipLabelOf = (key: string) =>
    points.find((p) => p.key === key)?.chipLabel ?? key;

  // A 30-day selection used to render 30 removable chips — a wall of noise above
  // the chart. Collapse a multi-point selection into the range it spans; the
  // count is only spelled out when the range has holes in it, since then the two
  // ends alone would overstate what is selected.
  const selectedKeys = [...selected].sort();
  const rangeChip = (() => {
    if (selectedKeys.length < 2) return null;
    const idx = selectedKeys
      .map((k) => points.findIndex((p) => p.key === k))
      .filter((i) => i >= 0);
    const contiguous =
      idx.length === selectedKeys.length &&
      Math.max(...idx) - Math.min(...idx) + 1 === idx.length;
    const span = `${chipLabelOf(selectedKeys[0])} → ${chipLabelOf(selectedKeys[selectedKeys.length - 1])}`;
    return contiguous ? span : `${span} (${selectedKeys.length})`;
  })();

  const clearSelection = () => {
    if (onClear) return onClear();
    for (const key of selectedKeys) onToggle?.(key);
  };

  return (
    <div>
      {/* selection chips */}
      {selected.size === 0 ? (
        <p className="mb-2.5 text-[11.5px] text-muted">{hint}</p>
      ) : (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={rangeChip ? clearSelection : () => onToggle?.(selectedKeys[0])}
            className="inline-flex items-center gap-1.5 rounded-8 border border-info-accent bg-info-soft px-2.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-info transition-colors duration-quick hover:border-danger hover:bg-danger-soft hover:text-danger"
          >
            {rangeChip ?? chipLabelOf(selectedKeys[0])}{" "}
            <span className="text-[10px] opacity-60">✕</span>
          </button>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="px-1.5 py-0.5 text-[11.5px] text-muted transition-colors duration-quick hover:text-ink"
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}

      <div ref={ref} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-40 w-full">
          <text
            x={W - pad + 4}
            y={12}
            fontSize={8}
            textAnchor="start"
            fill="var(--danger)"
            opacity={0.55}
          >
            {ratioLabel}
          </text>
          {axisTicks.map((t) => (
            <g key={t}>
              <line
                x1={pad}
                y1={yRatio(t)}
                x2={W - pad}
                y2={yRatio(t)}
                stroke="var(--danger)"
                strokeWidth={1}
                opacity={0.1}
                strokeDasharray="3 3"
              />
              <text
                x={W - pad + 4}
                y={yRatio(t) + 3}
                fontSize={8.5}
                textAnchor="start"
                fill="var(--danger)"
                opacity={0.65}
              >
                {t}%
              </text>
            </g>
          ))}
          {view === "line" && cline && (
            <path d={cline} fill="none" stroke="var(--primary)" strokeWidth={1.8} />
          )}
          {visuals}
          {ratioLine && (
            <path d={ratioLine} fill="none" stroke="var(--danger)" strokeWidth={1.5} opacity={0.8} />
          )}
          {labels}
          {hits}
        </svg>

        {/* Anchored to the chart and centred on the hovered column, not glued to
            the cursor: clamped to the plot area it can never spill past the right
            edge of the screen. Same behaviour as the mídia-paga charts. */}
        {tip && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-8 border border-line bg-background px-3 py-2 text-xs font-medium tabular-nums text-ink shadow-card"
            style={{ left: Math.min(Math.max(tip.x, TIP_HALF), Math.max(W - TIP_HALF, TIP_HALF)) }}
          >
            {tip.text}
          </div>
        )}
      </div>
    </div>
  );
}
