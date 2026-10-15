"use client";

import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-primary text-white hover:bg-primary-dark active:scale-[0.98]",
  // high-contrast: text uses the page bg so it inverts correctly in dark mode
  dark: "bg-ink text-background hover:opacity-90 active:scale-[0.98]",
  outline:
    "border border-line bg-background text-ink hover:bg-selected active:scale-[0.98]",
  ghost: "text-muted hover:bg-selected hover:text-ink",
  /** Inline text action inside running copy; no box, no padding. */
  link: "!h-auto !px-0 font-semibold text-primary underline-offset-2 hover:underline",
} as const;

// Compact sizing (Linear): buttons are short and dense, not chunky.
const SIZES = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3.5 text-[13px]",
  icon: "h-8 w-8",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  href,
  target,
  rel,
  loading = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
  /**
   * Renderiza um `<a>` com a mesma pele, para ação que é navegação de verdade
   * (abrir link externo). Opt-in: sem `href`, nada muda para quem já usa.
   */
  href?: string;
  target?: string;
  rel?: string;
  /** Shows a spinner before the label and disables the button. */
  loading?: boolean;
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-8 font-semibold transition duration-quick ease-out-quart disabled:pointer-events-none disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  // Os atributos de <button> não são espalhados no <a> de propósito: `disabled`
  // e `onClick` não têm o mesmo significado num link, e herdá-los calado daria
  // um botão que parece desabilitado e continua navegando.
  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  );
}
