/** Keyboard hint chip — Linear command palette style (mono, hairline border). */
export default function Kbd({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={`inline-flex h-[21px] min-w-[20px] items-center justify-center rounded-4 border border-line bg-background px-1.5 font-mono text-[11px] font-medium text-muted ${className}`}
    >
      {children}
    </kbd>
  );
}
