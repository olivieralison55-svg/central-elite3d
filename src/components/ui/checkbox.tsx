"use client";

import { Check } from "lucide-react";

/**
 * Checkbox — native input for a11y/keyboard, custom box for the look.
 * Checked state uses the brand accent (ref-01 delivery table).
 */
export default function Checkbox({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 text-sm text-ink ${props.disabled ? "pointer-events-none opacity-60" : ""} ${className}`}
    >
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" {...props} />
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-4 border border-line-strong bg-background transition-colors duration-quick ease-out-quart peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
          <Check
            size={13}
            strokeWidth={3}
            className="text-white opacity-0 transition-opacity duration-quick peer-checked:opacity-100"
          />
        </span>
      </span>
      {label}
    </label>
  );
}
