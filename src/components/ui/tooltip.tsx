"use client";

/**
 * Tooltip — shows on hover AND keyboard focus. CSS-driven via group so there's
 * no JS timer to leak. Wrap any focusable trigger.
 *
 * `wide` swaps the one-line chip for a card-shaped panel that wraps: for a label
 * a chip is right, but an explanation needs paragraphs, and `whitespace-nowrap`
 * would push it off screen.
 */
export default function Tooltip({
  content,
  children,
  side = "top",
  wide = false,
  className = "",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  wide?: boolean;
  className?: string;
}) {
  const pos =
    side === "top"
      ? "bottom-full mb-1.5 left-1/2 -translate-x-1/2"
      : "top-full mt-1.5 left-1/2 -translate-x-1/2";
  // The chip inverts against the text colour, so its label must be the page
  // background — `text-white` would vanish on the near-white ink of dark mode.
  const skin = wide
    ? "w-72 rounded-8 border border-line bg-background px-3 py-2.5 text-left font-normal leading-relaxed text-ink shadow-high"
    : "whitespace-nowrap rounded-6 bg-ink px-2 py-1 font-medium text-background shadow-medium";
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 text-xs opacity-0 transition-opacity duration-quick ease-out-quart group-hover:opacity-100 group-focus-within:opacity-100 ${skin} ${pos}`}
      >
        {content}
      </span>
    </span>
  );
}
