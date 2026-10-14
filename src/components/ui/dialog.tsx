"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Modal dialog — the real thing (portal + backdrop + ESC + scroll-lock + focus).
 * Replaces the ad-hoc `fixed inset-0` modal. Chrome reverse-engineered from
 * Linear's "New issue" dialog: radius 22, hairline border, shadow-dialog.
 */
export default function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Roomy layout for content that needs the width (e.g. a chart preview). */
  wide?: boolean;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Emitting the default alongside a caller's `max-w-*` puts two same-specificity
  // rules on the element, and which one wins depends on their order in the
  // generated stylesheet — not on the order they appear here. Every caller that
  // asked for a wider panel was silently getting max-w-lg. Only emit the default
  // when the caller did not supply a width.
  const width = /(?:^|\s)(max-w-|w-)/.test(className)
    ? ""
    : wide
      ? "max-w-[min(1320px,96vw)]"
      : "max-w-lg";

  // Keep the effect keyed on `open` only: re-running it on every inline
  // onClose identity would re-focus the panel mid-typing and steal focus
  // from form fields inside the dialog.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // move focus into the panel
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/25 p-4 animate-[overlay-in_.15s_ease] motion-reduce:animate-none ${
        wide ? "pt-[5vh]" : "pt-[12vh]"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`w-full ${width} rounded-[22px] border border-line bg-background shadow-dialog outline-none animate-[dialog-in_.2s_var(--ease-out-quart)] motion-reduce:animate-none ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-6 p-1 text-muted transition-colors duration-quick hover:bg-selected hover:text-ink"
              aria-label="Fechar"
            >
              <X size={17} />
            </button>
          </div>
        )}
        <div className="px-5 py-2">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-5 pb-4 pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
