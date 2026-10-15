"use client";

import { forwardRef } from "react";

/**
 * Text field — replaces the raw inline <input> copies across the views.
 * Sizing/tuning reverse-engineered from Linear (compact, hairline border,
 * focus ring on the accent). See docs/design-system-audit.md.
 */
const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className = "", invalid = false, ...props }, ref) {
  const border = invalid
    ? "border-danger/60 focus:border-danger"
    : "border-line focus:border-primary/70";
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`h-9 w-full rounded-6 border bg-background px-3 text-sm text-ink outline-none transition-colors duration-quick ease-out-quart placeholder:text-muted disabled:pointer-events-none disabled:opacity-60 ${border} ${className}`}
      {...props}
    />
  );
});

export default Input;
