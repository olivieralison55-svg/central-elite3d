"use client";

import type { LucideIcon } from "lucide-react";

export type OptionCardItem<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: LucideIcon;
  disabled?: boolean;
};

/**
 * Single-choice group rendered as cards (the radio-card role). Replaces the
 * `aria-pressed` card grids hand-rolled in the growth and chamados modals.
 */
export default function OptionCards<T extends string>({
  items,
  value,
  onChange,
  label,
  columns = 3,
  className = "",
}: {
  items: OptionCardItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Accessible name of the group. */
  label: string;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const cols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[columns];
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2 ${cols} ${className}`}>
      {items.map(({ value: v, label: l, description, icon: Icon, disabled }) => {
        const selected = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`flex flex-col items-start gap-1 rounded-8 border px-4 py-3 text-left transition-colors duration-quick ease-out-quart disabled:pointer-events-none disabled:opacity-60 ${
              selected
                ? "border-primary bg-info-soft text-ink"
                : "border-line bg-background text-ink hover:bg-selected"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              {Icon && <Icon size={16} className={selected ? "text-primary" : "text-muted"} />}
              {l}
            </span>
            {description && <span className="text-xs text-muted">{description}</span>}
          </button>
        );
      })}
    </div>
  );
}
