/** Bordered square icon chip (dash-ref-01 stat cards and list items). */
export default function IconChip({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-background text-ink ${className}`}
    >
      {children}
    </span>
  );
}
