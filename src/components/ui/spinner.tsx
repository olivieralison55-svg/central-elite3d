import { Loader2 } from "lucide-react";

/** Indeterminate spinner for async actions. */
export default function Spinner({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-muted motion-reduce:animate-none ${className}`}
      aria-label="Carregando"
    />
  );
}
