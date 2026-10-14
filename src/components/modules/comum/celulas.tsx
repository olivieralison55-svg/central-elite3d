import Link from "next/link";
import type { ReactNode } from "react";

import Badge, { type BadgeVariant } from "@/components/ui/badge";
import { type Aba, caminhoDaFicha } from "@/lib/endereco";

// Células que várias tabelas repetem (index.html:847–877).

// A primeira célula da linha leva à ficha por um <Link>, alcançável por teclado (design,
// componente 6). Sem mentorado, só o texto.
export function LinkFicha({ id, aba, children }: { id: string | null; aba?: Aba; children: ReactNode }) {
  if (id === null) return <>{children}</>;
  return (
    <Link href={caminhoDaFicha(id, aba)} className="font-medium text-ink hover:text-primary hover:underline">
      {children}
    </Link>
  );
}

// O dia e o mês em destaque, a hora abaixo; sem data, "sem data".
export function DataHora({ data, hora }: { data: string | null; hora: string | null }) {
  if (!data) return <span className="text-muted">sem data</span>;
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="font-semibold text-ink">{`${data.slice(8, 10)}/${data.slice(5, 7)}`}</span>
      {hora && <span className="text-xs text-muted">{hora.slice(0, 5)}</span>}
    </span>
  );
}

const TOM_STATUS: ReadonlyMap<string, BadgeVariant> = new Map([
  ["Concluída", "success"],
  ["Agendada", "info"],
  ["Aguardando confirmação", "warning"],
  ["Bloqueada", "danger"],
]);

// O status da sessão. Fora de S_STATUS, o texto cru, que o React escapa (EDGE-05).
export function StatusSessao({ status }: { status: string | null }) {
  return <Badge variant={TOM_STATUS.get(status ?? "") ?? "neutral"}>{status || "—"}</Badge>;
}
