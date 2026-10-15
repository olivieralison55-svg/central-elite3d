/**
 * Loading placeholder with a shimmer sheen (the `.skeleton` utility in
 * globals.css). Global rule: every loading state uses this — never "—",
 * a bare spinner, or an empty screen. Honors prefers-reduced-motion.
 */
export default function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return <span aria-hidden className={`skeleton block rounded-6 ${className}`} />;
}
