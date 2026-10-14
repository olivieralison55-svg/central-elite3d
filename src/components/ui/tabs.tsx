"use client";

export interface TabItem {
  /** Stable identity emitted by onChange — not the visible text. */
  value: string;
  label: string;
  icon?: React.ReactNode;
  /** Rendered as a pill after the label. `0` shows; omit to hide. */
  count?: number;
}

/**
 * View switcher tabs (dash-ref-03: Board / List / Timeline).
 *
 * Items accept either a bare string (label doubles as the value) or a TabItem
 * carrying an icon and a count pill — a list that switches views usually has to
 * say how much sits behind each one.
 */
export default function Tabs({
  items,
  value,
  onChange,
  className = "",
}: {
  items: (string | TabItem)[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const tabs: TabItem[] = items.map((item) =>
    typeof item === "string" ? { value: item, label: item } : item,
  );

  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 rounded-md bg-sub-bg p-1 ${className}`}
    >
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-semibold transition duration-quick ease-out-quart ${
              active ? "bg-background text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                  active ? "bg-selected text-muted" : "text-muted"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
