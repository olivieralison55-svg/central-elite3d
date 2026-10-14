/**
 * Empty state — icon + title + optional description and action. Replaces the
 * inline "Nenhum item" text scattered across lists.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-8 border border-dashed border-line bg-sub-bg px-6 py-12 text-center ${className}`}
    >
      {icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-background text-muted shadow-low">
          {icon}
        </span>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
