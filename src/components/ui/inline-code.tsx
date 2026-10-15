/** Inline monospace snippet (command, path, identifier) inside running text. */
export default function InlineCode({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <code
      className={`rounded-4 border border-line bg-sub-bg px-1.5 py-px font-mono text-[0.92em] text-ink ${className}`}
    >
      {children}
    </code>
  );
}
