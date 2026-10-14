"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import Button from "./button";

/**
 * "Página X de Y" between a previous and a next icon button. The caller owns
 * the page (and keeps it within 1…pageCount); this only asks for page ± 1.
 */
export default function Pagination({
  page,
  pageCount,
  onChange,
  label,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** Accessible name of the navigation, e.g. "Paginação das respostas". */
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex items-center justify-end gap-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={16} aria-hidden />
      </Button>
      <span className="text-xs tabular-nums text-muted">{`Página ${page} de ${pageCount}`}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Próxima página"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={16} aria-hidden />
      </Button>
    </nav>
  );
}
