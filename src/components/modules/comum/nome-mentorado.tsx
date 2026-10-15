import { Circle, CircleCheck, type LucideIcon, TriangleAlert } from "lucide-react";

import type { ReactNode } from "react";

import { type Marcador, separarMarcador } from "@/lib/marcador";

// O nome do mentorado com o emoji de situação trocado por um ícone no tom certo. Sem marcador
// (ou com um emoji que a regra não conhece), é só o texto, sem emoji nenhum.

const ICONE: Record<Marcador, { icone: LucideIcon; rotulo: string; classe: string; cheio: boolean }> = {
  ok: { icone: Circle, rotulo: "ok", classe: "text-success-accent", cheio: true },
  atencao: { icone: Circle, rotulo: "atenção", classe: "text-warning", cheio: true },
  risco: { icone: Circle, rotulo: "risco", classe: "text-danger", cheio: true },
  alerta: { icone: TriangleAlert, rotulo: "alerta", classe: "text-warning", cheio: false },
  concluido: { icone: CircleCheck, rotulo: "concluído", classe: "text-success", cheio: false },
};

export default function NomeMentorado({ nome }: { nome: string | null | undefined }) {
  const { marcador, nome: limpo } = separarMarcador(nome);
  if (!marcador) return <>{limpo}</>;
  const { icone: Icone, rotulo, classe, cheio } = ICONE[marcador];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icone role="img" aria-label={rotulo} size={12} className={`shrink-0 ${classe} ${cheio ? "fill-current" : ""}`} />
      {limpo}
    </span>
  );
}

// Para quem recebe o nome como `label` ou filho e compara texto: sem marcador devolve a string pura.
export const nomeComIcone = (nome: string | null | undefined): ReactNode => (separarMarcador(nome).marcador ? <NomeMentorado nome={nome} /> : separarMarcador(nome).nome);
