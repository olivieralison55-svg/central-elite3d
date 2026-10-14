"use client";

/**
 * Toggle switch (Linear "Create more" pattern). Controlled via `checked`.
 * Renders a real button[role=switch] for a11y + keyboard.
 */
export default function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink ${disabled ? "pointer-events-none opacity-60" : ""} ${className}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-regular ease-out-quart ${checked ? "bg-primary" : "bg-line-strong"}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-low transition-transform duration-regular ease-out-quart ${checked ? "translate-x-[12px]" : "translate-x-0"}`}
        />
      </button>
      {label}
    </label>
  );
}
