/** Hairline separator. `dashed` mirrors the sidebar dividers in AppShell. */
export default function Divider({
  dashed = false,
  className = "",
}: {
  dashed?: boolean;
  className?: string;
}) {
  return (
    <hr
      className={`border-0 border-t border-line ${dashed ? "border-dashed" : ""} ${className}`}
    />
  );
}
