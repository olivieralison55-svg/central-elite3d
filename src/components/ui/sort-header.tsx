"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc" | null;

const ICONS = { asc: ArrowUp, desc: ArrowDown, none: ArrowUpDown } as const;
const STATES = { asc: "ordem crescente", desc: "ordem decrescente", none: "sem ordenação" } as const;

/**
 * Clickable column header, for a DataTable column `header`: the label and the
 * direction icon. DataTable's own `sortable` only draws an icon; the order
 * itself belongs to the caller.
 */
export default function SortHeader({
  label,
  direction,
  onToggle,
}: {
  label: string;
  direction: SortDirection;
  onToggle: () => void;
}) {
  const state = direction ?? "none";
  const Icon = ICONS[state];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${label}, ${STATES[state]}`}
      className="inline-flex items-center gap-1.5 hover:text-ink"
    >
      {label}
      <Icon size={11} aria-hidden className={direction ? "text-ink" : "opacity-70"} />
    </button>
  );
}
