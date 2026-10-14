/**
 * Shared vocabulary of the chart primitives.
 *
 * The primitives are deliberately domain-agnostic: they never count, label or
 * filter anything. The caller reduces its own rows into `ChartEntry`/`ChartSeries`
 * and owns the meaning of `value`; the chart only renders and reports clicks.
 */
import { chartPalette } from "@/design-system/tokens";

const CHART_PALETTE = chartPalette;

export type ChartView = "bar" | "pie" | "line" | "pills";

export const VIEW_NAMES: Record<ChartView, string> = {
  bar: "Barras",
  pie: "Pizza",
  line: "Linha",
  pills: "Pílulas",
};

/**
 * One category of a categorical chart.
 *
 * `total` and `current` model cross-filtering: `total` is the count ignoring the
 * chart's own filter (rendered as the pale "ghost" fill, so unselected options
 * stay visible) and `current` is the count under the full filter. Charts with no
 * cross-filtering just pass the same number to both.
 */
export interface ChartEntry {
  value: string;
  label: string;
  total: number;
  current: number;
  /** Overrides the palette color for this category (pie/line only). */
  color?: string;
}

/** One line of a multi-series chart — `points` is aligned with `ticks`. */
export interface ChartSeries {
  value: string;
  label: string;
  points: number[];
  /** Count shown in the legend. */
  current: number;
  color?: string;
}

/** X axis entry of the time-based charts. */
export interface ChartTick {
  /** Stable key — what `onToggle` reports and `selected` holds. */
  key: string;
  /** Short axis label (e.g. day of month). */
  label: string;
}

/** One column of the trend chart: a primary count plus an optional ratio line. */
export interface TrendPoint extends ChartTick {
  value: number;
  /** Secondary series, already in percent (0–100). `null` hides the point. */
  ratio: number | null;
  tooltip?: string;
  /** Label of the removable chip rendered for a selected point. */
  chipLabel?: string;
}

export const colorAt = (index: number, override?: string): string =>
  override ?? CHART_PALETTE[index % CHART_PALETTE.length];

/** Selection state of an interactive chart — omit both for a static chart. */
export interface ChartSelection {
  selected?: ReadonlySet<string>;
  onToggle?: (value: string) => void;
}

/** Shared default so a static chart never allocates a Set per render. */
export const NO_SELECTION: ReadonlySet<string> = new Set<string>();

/** `""` when nothing is selected, `"sel"`/`"dim"` once a selection exists. */
export function selectionState(
  selected: ReadonlySet<string>,
  value: string,
): "" | "sel" | "dim" {
  if (selected.size === 0) return "";
  return selected.has(value) ? "sel" : "dim";
}
