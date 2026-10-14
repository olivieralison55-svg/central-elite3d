"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useFloatingPanel } from "@/components/ui/use-floating-panel";

export interface DropdownItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

const TRIGGER =
  "flex items-center gap-2 rounded-md bg-selected px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sub-bg";

/** Floating select-view menu (dash-ref-02). */
export default function DropdownMenu({
  label,
  groupLabel,
  items,
  value,
  onChange,
  footer,
  triggerClassName,
  panelWidthClassName = "w-64",
}: {
  label: React.ReactNode;
  groupLabel?: string;
  items: DropdownItem[];
  value?: string;
  onChange: (key: string) => void;
  footer?: React.ReactNode;
  /** Replaces the default trigger chrome — lets the nav render it as a tab. */
  triggerClassName?: string;
  panelWidthClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { panelRef, dropUp } = useFloatingPanel<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    // isolate: contains the panel's z-40 so it can't leak past the AppShell
    // header/sidebar stacking context when the trigger scrolls near the top.
    <div ref={ref} className="relative inline-block isolate">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName ?? TRIGGER}
      >
        {label}
        <ChevronDown size={15} className="text-muted" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`absolute left-0 z-40 rounded-lg border border-line bg-background p-2 shadow-card ${panelWidthClassName} ${
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {groupLabel && (
            <p className="px-3 pb-1 pt-2 text-sm text-muted">{groupLabel}</p>
          )}
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onChange(item.key);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition ${
                item.key === value
                  ? "bg-selected text-ink"
                  : "text-ink hover:bg-selected"
              }`}
            >
              {item.icon && <span className="text-muted">{item.icon}</span>}
              {item.label}
            </button>
          ))}
          {footer && (
            <div className="mt-1 border-t border-line pt-1">{footer}</div>
          )}
        </div>
      )}
    </div>
  );
}
