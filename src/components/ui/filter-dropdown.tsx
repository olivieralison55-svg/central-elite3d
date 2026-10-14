"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import Checkbox from "@/components/ui/checkbox";
import { useFloatingPanel } from "@/components/ui/use-floating-panel";

export interface FilterDropdownOption {
  value: string;
  label: string;
  /** Shown muted at the right of the row (e.g. how many rows carry the value). */
  count?: number;
}

/**
 * Multi-select filter — a labelled trigger that opens a checkbox list.
 *
 * Sister of `DropdownMenu`, not a replacement: that one picks ONE view and
 * closes; this one toggles a `Set` and stays open, because refining a filter
 * is a sequence of clicks, not a single choice. The trigger always carries the
 * dimension name (a row of five "Todos" was measured to be indistinguishable),
 * and the selection count rides in a badge instead of replacing the label.
 */
export default function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  clearLabel = "limpar",
  className = "",
  panelWidthClassName = "w-60",
}: {
  label: string;
  options: FilterDropdownOption[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  clearLabel?: string;
  className?: string;
  panelWidthClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { panelRef, dropUp } = useFloatingPanel<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  const active = selected.size > 0;

  return (
    // isolate: contains the panel's z-40 so it can't leak past the AppShell
    // header/sidebar stacking context when the trigger scrolls near the top.
    <div ref={rootRef} className={`relative inline-block isolate ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition ${
          active
            ? "border-primary/40 bg-primary/5 text-ink"
            : "border-line bg-background text-ink hover:bg-selected"
        }`}
      >
        {label}
        {active && (
          <span className="rounded-md bg-primary px-1.5 text-[11px] font-bold leading-4 text-white">
            {selected.size}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`text-muted transition-transform duration-quick ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`absolute left-0 z-40 rounded-lg border border-line bg-background p-1.5 ${panelWidthClassName} ${
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {options.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-muted">Sem opções.</p>
            )}
            {options.map((o) => (
              <Checkbox
                key={o.value}
                checked={selected.has(o.value)}
                onChange={() => toggle(o.value)}
                className="w-full rounded-md px-2.5 py-2 transition hover:bg-selected"
                label={
                  <span className="flex w-full min-w-0 items-center gap-2">
                    <span className="truncate">{o.label}</span>
                    {o.count !== undefined && (
                      <span className="ml-auto text-xs tabular-nums text-muted">{o.count}</span>
                    )}
                  </span>
                }
              />
            ))}
          </div>
          {active && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="mt-1 w-full rounded-md border-t border-dashed border-line px-2.5 pb-1.5 pt-2 text-left text-xs font-semibold text-muted transition hover:text-ink"
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
