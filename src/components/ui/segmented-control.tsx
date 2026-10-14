"use client";

/**
 * Segmented control (Linear "Active / Backlog / All issues"): item h28, radius 5,
 * active item gets a raised surface + shadow-low. Differs from Tabs (underline).
 */
export default function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className = "",
}: {
  items: readonly T[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex gap-0.5 rounded-8 bg-selected p-0.5 ${className}`}
    >
      {items.map((item) => {
        const active = item === value;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item)}
            className={`h-7 rounded-[5px] px-3 text-sm font-medium transition-colors duration-quick ease-out-quart ${
              active
                ? "bg-background text-ink shadow-low"
                : "text-muted hover:text-ink"
            }`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
