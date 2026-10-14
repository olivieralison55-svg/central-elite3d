"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Multiline field with NO resize handle — auto-grows to fit content (Linear/
 * Notion behaviour). The drag-to-resize corner is intentionally removed: it's a
 * poor UX pattern almost no product ships anymore.
 */
export default function Textarea({
  className = "",
  invalid = false,
  minRows = 3,
  onInput,
  value,
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & {
  invalid?: boolean;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // fit on mount and whenever the controlled value changes
  useLayoutEffect(resize, [resize, value]);

  const border = invalid
    ? "border-danger/60 focus:border-danger"
    : "border-line focus:border-primary/70";

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      aria-invalid={invalid || undefined}
      onInput={(e) => {
        resize();
        onInput?.(e);
      }}
      className={`w-full resize-none overflow-hidden rounded-6 border bg-background px-3 py-2 text-sm leading-relaxed text-ink outline-none transition-colors duration-quick ease-out-quart placeholder:text-muted disabled:pointer-events-none disabled:opacity-60 ${border} ${className}`}
      {...props}
    />
  );
}
