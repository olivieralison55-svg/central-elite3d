import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import Badge, { type BadgeVariant } from "@/components/ui/badge";
import type { Mentorado } from "@/lib/data/esquemas";
import { type Aba, caminhoDaFicha } from "@/lib/endereco";
import { linkSeguro } from "@/lib/links";
import { situacaoDe } from "@/lib/mentorados";
import NomeMentorado from "./nome-mentorado";

// Células que várias tabelas repetem (index.html:847–877).

// A primeira célula da linha leva à ficha por um <Link>, alcançável por teclado (design,
// componente 6). Sem mentorado, só o texto.
export function LinkFicha({ id, aba, children }: { id: string | null; aba?: Aba; children: ReactNode }) {
  const conteudo = typeof children === "string" ? <NomeMentorado nome={children} /> : children;
  if (id === null) return <>{conteudo}</>;
  return (
    <Link href={caminhoDaFicha(id, aba)} className="font-medium text-ink hover:text-primary hover:underline">
      {conteudo}
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
  ["Não compareceu", "neutral"],
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

// Link vindo do banco (linkOr, index.html:965–969): `href` só para http(s), em aba nova e com
// rel="noopener noreferrer"; outro valor aparece como texto, com o valor no title (SEC-05).
export function LinkExterno({ url, rotulo }: { url: string; rotulo: string }) {
  const href = linkSeguro(url);
  if (!href) {
    return (
      <span className="text-muted" title={url}>
        {`${rotulo}*`}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
      {rotulo}
    </a>
  );
}

type ComLinks = { link_meet: string | null; link_gravacao: string | null; link_anotacoes: string | null };

// Os links de uma sessão ou de um encontro: meet, gravação e anotações; sem nenhum, "—".
export function LinksSessao({ links }: { links: ComLinks }) {
  const presentes = (
    [
      [links.link_meet, "meet"],
      [links.link_gravacao, "gravação"],
      [links.link_anotacoes, "anotações"],
    ] as const
  ).flatMap(([url, rotulo]) => (url ? [{ url, rotulo }] : []));
  if (!presentes.length) return <>—</>;
  return (
    <span className="whitespace-nowrap">
      {presentes.map(({ url, rotulo }, i) => (
        <Fragment key={rotulo}>
          {i > 0 && " · "}
          <LinkExterno url={url} rotulo={rotulo} />
        </Fragment>
      ))}
    </span>
  );
}
