import { forwardRef } from "react";

/** White surface on top of the page or of a Section (dash-ref-03 mapping:
    page/cards = background, grouping columns = sub-bg).

    Card and Section forward their ref and pass through native props so surfaces
    can carry pointer handlers and be measured — a drag-and-drop board needs
    both. */
export const Card = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function Card({ className = "", children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={`rounded-lg border border-line bg-background ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

/** Card title row separated by the dashed rule used across dash-ref-01. */
export function CardHeader({
  title,
  actions,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-dashed border-line px-5 py-4">
      <span className="text-[15px] font-bold text-ink">{title}</span>
      {actions}
    </header>
  );
}

/** Grouping container (columns/sections) in sub-bg. */
export const Section = forwardRef<
  HTMLElement,
  Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
    title?: string;
    count?: number;
    dot?: string;
    actions?: React.ReactNode;
    /** false = flat surface (bg only, no hairline) — e.g. kanban columns. */
    bordered?: boolean;
  }
>(function Section(
  { title, count, dot, actions, bordered = true, className = "", children, ...props },
  ref,
) {
  return (
    <section
      ref={ref}
      className={`rounded-lg ${bordered ? "border border-line" : ""} bg-sub-bg p-3 ${className}`}
      {...props}
    >
      {(title !== undefined || actions) && (
        <header className="flex items-center justify-between px-2 pb-3 pt-1">
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            {dot && (
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: dot }}
              />
            )}
            {title}
            {count !== undefined && (
              <span className="rounded-md bg-selected px-1.5 py-0.5 text-[11px] font-bold text-muted">
                {count}
              </span>
            )}
          </span>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
});
