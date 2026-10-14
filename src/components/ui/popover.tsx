"use client";

import { useEffect, useRef, useState } from "react";
import { useFloatingPanel } from "@/components/ui/use-floating-panel";

/**
 * Anchored panel opened by a trigger (report options, date filter, quick
 * forms). Closes on outside click and Escape; flips up when there is no room
 * below (useFloatingPanel). For a list of actions use DropdownMenu instead.
 */
export default function Popover({
  trigger,
  children,
  align = "start",
  label,
  panelClassName = "w-72",
  className = "",
}: {
  /** Receives the open state so the trigger can reflect it. */
  trigger: (open: boolean) => React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  /** Accessible name of the panel. */
  label: string;
  panelClassName?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { panelRef, dropUp } = useFloatingPanel<HTMLDivElement>(open);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={rootRef} className={`relative inline-block isolate ${className}`}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          className={`absolute z-[60] rounded-12 border border-line bg-background p-3 shadow-card ${
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${align === "end" ? "right-0" : "left-0"} ${panelClassName}`}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}
