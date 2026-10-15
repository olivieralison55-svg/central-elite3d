"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/button";

/**
 * Copies `text` to the clipboard and flips to a check for 1.5 s. Replaces the
 * six hand-rolled `navigator.clipboard.writeText` + icon + state copies.
 * Without `children` it renders as an icon button.
 */
export default function CopyButton({
  text,
  label = "Texto",
  variant = "ghost",
  children,
  className = "",
}: {
  text: string;
  /** What is being copied — used in the toast ("Token copiado"). */
  label?: string;
  variant?: "ghost" | "outline";
  children?: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copiado`);
    } catch (err) {
      console.error("[copy-button] clipboard write failed", err);
      toast.error("Não foi possível copiar — selecione e copie manualmente");
    }
  }

  const Icon = copied ? Check : Copy;
  return (
    <Button
      variant={variant}
      size={children ? "sm" : "icon"}
      onClick={copy}
      aria-label={children ? undefined : `Copiar ${label.toLowerCase()}`}
      className={className}
    >
      <Icon size={14} className={copied ? "text-success" : ""} />
      {children}
    </Button>
  );
}
