"use client";

import { X } from "lucide-react";

/** One active filter. `group` is the muted prefix (the dimension it came from). */
export interface FilterChip {
  key: string;
  group: string;
  label: React.ReactNode;
}

/** Active-filter summary bar — every selection as a removable chip. */
export default function FilterChips({
  chips,
  onRemove,
  onClearAll,
  emptyLabel = "Nenhum filtro ativo.",
  clearAllLabel = "limpar tudo",
}: {
  chips: FilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  emptyLabel?: React.ReactNode;
  clearAllLabel?: string;
}) {
  if (chips.length === 0) {
    return <p className="text-xs text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onRemove(c.key)}
          // Solid `bg-ink`, not `bg-ink/70`: the neutrals are CSS vars holding
          // hex, so Tailwind's alpha modifier compiles to an invalid color and
          // the chip renders transparent (invisible text on the page).
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[11.5px] text-background transition-colors duration-quick hover:bg-danger hover:text-white"
        >
          <span className="opacity-60">{c.group}</span>
          {c.label}
          <X size={11} />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="rounded-full border border-line px-3 py-1 text-[11.5px] text-muted transition-colors duration-quick hover:border-danger hover:text-danger"
      >
        {clearAllLabel}
      </button>
    </div>
  );
}
