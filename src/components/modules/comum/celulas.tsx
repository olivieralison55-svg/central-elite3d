import Link from "next/link";
import type { ReactNode } from "react";

import Badge, { type BadgeVariant } from "@/components/ui/badge";
import type { Mentorado } from "@/lib/data/esquemas";
import { type Aba, caminhoDaFicha } from "@/lib/endereco";
import { situacaoDe } from "@/lib/mentorados";

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

// O contrato (pillContrato, index.html:860–865): os três conhecidos com rótulo fixo; o resto cru,
// ou "Pendente" quando vazio.
const TOM_CONTRATO: ReadonlyMap<string, [BadgeVariant, string]> = new Map([
  ["Assinado", ["success", "Assinado"]],
  ["Aguardando assinatura", ["warning", "Aguardando"]],
  ["Cancelou", ["danger", "Cancelou"]],
]);

export function StatusContrato({ status }: { status: string | null | undefined }) {
  const [tom, rotulo] = TOM_CONTRATO.get(status ?? "") ?? ["neutral", status || "Pendente"];
  return <Badge variant={tom}>{rotulo}</Badge>;
}

// A situação que não é ativo (pillSituacao, index.html:939–944): cancelado ou pausado.
export function SituacaoMentorado({ mentorado }: { mentorado: Pick<Mentorado, "situacao" | "cancelado"> }) {
  const situacao = situacaoDe(mentorado);
  if (situacao === "cancelado") return <Badge variant="danger">cancelado</Badge>;
  if (situacao === "pausado") return <Badge variant="warning">pausado</Badge>;
  return null;
}
