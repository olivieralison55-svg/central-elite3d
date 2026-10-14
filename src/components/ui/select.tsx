"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  /**
   * Offered but not choosable. The option stays visible on purpose: hiding it
   * would make the menu shrink and grow as neighbouring state changes, and the
   * reader would never learn that the choice exists. Pair it with `hint`.
   */
  disabled?: boolean;
  /** Second line under the label, for the reason a disabled option is refused. */
  hint?: string;
}

/**
 * The next choosable index in `direction`, wrapping around, skipping every
 * disabled option. Returns `from` when nothing else is choosable — including
 * the case where every option is disabled, so arrow keys are a no-op instead
 * of an infinite search.
 *
 * Exported because it is the only part of this component the test runner can
 * reach: `vitest.config.ts` collects `src/**\/*.test.ts`, never `.tsx`.
 */
export function nextEnabledIndex(
  options: readonly SelectOption[],
  from: number,
  direction: 1 | -1,
): number {
  const total = options.length;
  if (total === 0) return from;
  for (let step = 1; step <= total; step += 1) {
    const index = (((from + direction * step) % total) + total) % total;
    if (!options[index]?.disabled) return index;
  }
  return from;
}

// Panel geometry, mirroring DateFilter.
const GAP = 6;
const MARGIN = 8;
const FALLBACK_H = 264;
/** The panel is never narrower than its trigger, but it is free to outgrow it
 *  up to this — a filter sitting in a 170px grid column must not turn "Todas as
 *  campanhas de captação" into "Todas as campanl". */
const MAX_PANEL_W = 420;

/**
 * Form select built on the design-system dropdown — NOT a native <select>.
 * Keyboard: ↑/↓ move, Enter select, Esc close. Emits a hidden input so it still
 * submits inside a <form>.
 *
 * The panel is portaled to <body> with fixed positioning (same as DateFilter),
 * so no ancestor `overflow` can clip it and no sticky table header can paint
 * over it; it flips above the trigger when there isn't room below.
 */
export default function Select({
  options,
  value,
  defaultValue,
  onChange,
  placeholder = "Selecione...",
  name,
  id,
  invalid = false,
  disabled = false,
  className = "",
}: {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  name?: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue ?? "");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = value ?? internal;
  const current = options.find((o) => o.value === selected);

  const place = useCallback(() => {
    const trigger = ref.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const r = trigger.getBoundingClientRect();
    const panelH = panel.offsetHeight || FALLBACK_H;
    // The panel sizes itself to its longest option, so the clamp has to use
    // what it measures — not the trigger's width — or a panel wider than its
    // trigger would hang off the right edge.
    const panelW = Math.max(panel.offsetWidth, r.width);
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    // Open downward if it fits, else upward if there's more room above.
    const openUp = spaceBelow < panelH + GAP + MARGIN && spaceAbove > spaceBelow;
    const top = openUp
      ? Math.max(MARGIN, r.top - panelH - GAP)
      : Math.min(r.bottom + GAP, window.innerHeight - panelH - MARGIN);
    const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - panelW - MARGIN));
    setPos({ top, left, width: r.width });
  }, []);

  // Position (and reposition) while open. Capture-phase scroll catches every
  // scrollable ancestor — a dialog body, a frozen table — not just the window.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // The panel now lives outside the wrapper, so it needs its own hit test —
    // otherwise mousedown would unmount an option before its click lands.
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function pick(option: SelectOption) {
    // A disabled option is a dead end by design: no selection, and the panel
    // stays open so the reader can pick something else without reopening it.
    if (option.disabled) return;
    if (value === undefined) setInternal(option.value);
    onChange?.(option.value);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((a) => nextEnabledIndex(options, a, e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      pick(options[active]);
    }
  }

  const border = invalid
    ? "border-danger/60"
    : open
      ? "border-primary/70"
      : "border-line";

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
        className={`flex h-9 w-full items-center gap-2 rounded-6 border bg-background px-3 text-sm text-ink outline-none transition-colors duration-quick ease-out-quart disabled:pointer-events-none disabled:opacity-60 ${border}`}
      >
        {/* The trigger is as wide as its column, so a long label still has to
            be cut here — but the full text is one hover (and one click) away. */}
        <span
          title={current?.label ?? placeholder}
          className={`flex-1 truncate text-left ${current ? "" : "text-muted"}`}
        >
          {current ? (
            <span className="flex items-center gap-2">
              {current.icon && <span className="shrink-0 text-muted">{current.icon}</span>}
              <span className="truncate">{current.label}</span>
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-muted transition-transform duration-quick ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        typeof document !== "undefined" &&
        // z-[60] sits above the dialog layer (z-50): a select opened inside a
        // modal must render over it, whatever the portal order is.
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              // Width is the *option's* to decide, not the trigger's: the panel
              // starts at the trigger's width and grows with the longest label.
              // Choosing between abbreviations is not choosing.
              minWidth: pos?.width,
              maxWidth: `min(${MAX_PANEL_W}px, calc(100vw - ${MARGIN * 2}px))`,
              maxHeight: "min(16rem, calc(100vh - 16px))",
            }}
            className="z-[60] overflow-y-auto rounded-8 border border-line bg-background p-1 shadow-card"
          >
            {options.map((o, i) => {
              const isSel = o.value === selected;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={o.disabled}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onClick={() => pick(o)}
                  className={`flex w-full items-start gap-2.5 rounded-6 px-2.5 py-2 text-left text-sm transition-colors duration-quick ${
                    o.disabled ? "cursor-not-allowed text-muted" : "text-ink"
                  } ${i === active && !o.disabled ? "bg-selected" : ""}`}
                >
                  {o.icon && <span className="shrink-0 text-muted">{o.icon}</span>}
                  {/* Wraps instead of truncating: a label that reaches the
                      panel's max width breaks onto a second line, readable. */}
                  <span className="flex-1 break-words">
                    {o.label}
                    {o.hint && (
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                        {o.hint}
                      </span>
                    )}
                  </span>
                  {isSel && <Check size={15} className="mt-0.5 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
