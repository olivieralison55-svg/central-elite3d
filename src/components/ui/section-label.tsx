/**
 * Small uppercase label that heads a group of fields or a panel section.
 * Was hand-written as `text-[11px] font-semibold uppercase tracking-wide
 * text-muted` (with drifting tracking/size) in ~25 files.
 */
export default function SectionLabel({
  as: Tag = "p",
  children,
  className = "",
}: {
  as?: "p" | "h2" | "h3" | "h4" | "span" | "label";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={`text-[11px] font-semibold uppercase tracking-[0.06em] text-muted ${className}`}
    >
      {children}
    </Tag>
  );
}
