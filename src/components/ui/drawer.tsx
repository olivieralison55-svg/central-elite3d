"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Right side panel — Dialog's sibling for detail/inspector surfaces
 * (portal + backdrop + ESC + scroll-lock + focus). Slots for header,
 * body and a pinned footer bar. Same chrome rules as Dialog: hairline
 * border, shadow-dialog, token-only colors.
 */
export default function Drawer({
  open,
  onClose,
  header,
  children,
  footer,
  widthClassName = "max-w-4xl",
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClassName?: string;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Same focus-stability rule as Dialog: key the effect on `open` only.
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
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/25 animate-[overlay-in_.15s_ease] motion-reduce:animate-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`flex h-full w-full flex-col border-l border-line bg-background shadow-dialog outline-none ${widthClassName} ${className}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-6 p-1 text-muted transition-colors duration-quick hover:bg-selected hover:text-ink"
            aria-label="Fechar"
          >
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
