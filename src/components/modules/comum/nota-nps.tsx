import Badge from "@/components/ui/badge";
import type { NpsResposta } from "@/lib/data/esquemas";
import { tomDaNota, tomDaResposta } from "@/lib/nps";

// A nota de uma resposta de NPS (pillNota, index.html:2750): 9 e 10 verde, 7 e 8 âmbar, o resto vermelho.
export const Nota = ({ nota }: { nota: number | null }) => <Badge variant={tomDaNota(nota)}>{String(nota ?? "—")}</Badge>;

// As perguntas da Pesquisa de Satisfação desde 13/10/2026 (perguntasNps, index.html:2800); nulas
// nas respostas anteriores, que não mostram nada.
export function Perguntas({ r }: { r: NpsResposta }) {
  const itens = [
    r.clareza && { rotulo: "Clareza dos próximos passos", valor: r.clareza },
    r.direcionamento && { rotulo: "Direcionamento adequado", valor: r.direcionamento },
  ].filter((i): i is { rotulo: string; valor: string } => !!i);
  if (!itens.length && !r.apoio) return null;
  return (
    <div className="mt-1.5 space-y-1 text-xs text-muted">
      {itens.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5">
          {itens.map((i) => (
            <span key={i.rotulo} className="inline-flex items-center gap-1">
              {i.rotulo} <Badge variant={tomDaResposta(i.valor)}>{i.valor}</Badge>
            </span>
          ))}
        </p>
      )}
      {r.apoio && <p className="whitespace-pre-line">{`Quer mais apoio em: ${r.apoio}`}</p>}
    </div>
  );
}
