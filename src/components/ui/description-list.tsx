/**
 * Key–value pairs (metadata panels, config summaries). Terms use the
 * SectionLabel skin so the four hand-rolled `dl` grids stop drifting.
 */
export default function DescriptionList({
  items,
  className = "",
}: {
  items: { term: React.ReactNode; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={`grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 text-xs ${className}`}>
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="pt-px text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            {it.term}
          </dt>
          <dd className="min-w-0 break-words text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
