import { casaBusca } from "./busca";
import type { Dataset, Mentorado } from "./data/esquemas";

// Mentorados do index.html (:811, :937–962, :1803–1812, :3691–3700).

// A situação: ativo, pausado ou cancelado. Registro sem `situacao` cai no booleano antigo; sem
// registro, "ativo", como hoje (uma parcela de mentorado que não veio na carga conta como ativa).
export const situacaoDe = (m: Pick<Mentorado, "situacao" | "cancelado"> | undefined): string =>
  m?.situacao || (m?.cancelado ? "cancelado" : "ativo");

export const ehAtivo = (m: Pick<Mentorado, "situacao" | "cancelado"> | undefined): boolean => situacaoDe(m) === "ativo";

// O nome do mentorado de uma linha; sem cadastro (ou sem nome), "—".
export const nomeDe = (mentorados: readonly Mentorado[], id: string | null): string => mentorados.find((m) => m.id === id)?.nome || "—";

// Os filtros da tela Mentorados (`filtro.statusFin`). "Todos" e "incompletos" incluem os
// cancelados, como hoje. O mentor lê a view sem `contrato_status` nem `cadastro_incompleto`: para
// ele "incompletos" sai vazio.
const FILTROS: ReadonlyMap<string, (m: Mentorado) => boolean> = new Map([
  ["ativos", ehAtivo],
  ["pausados", (m: Mentorado) => situacaoDe(m) === "pausado"],
  ["incompletos", (m: Mentorado) => !!m.cadastro_incompleto],
  ["contrato", (m: Mentorado) => ehAtivo(m) && m.contrato_status !== "Assinado"],
]);

// A busca por nome vem por último; `antesDaBusca` é o que o filtro deixou, a base do selo.
export function filtrarMentorados(mentorados: readonly Mentorado[], filtro: string, busca: string): { lista: Mentorado[]; antesDaBusca: number } {
  const filtrar = FILTROS.get(filtro);
  const recorte = filtrar ? mentorados.filter(filtrar) : [...mentorados];
  return { lista: recorte.filter((m) => casaBusca(busca, m.nome)), antesDaBusca: recorte.length };
}

// O que some junto com a ficha (as filhas são ON DELETE CASCADE): os 4 tipos que a tela conta
// hoje, e as concluídas, que saem do fechamento dos mentores (OPS-11).
export function resumoExclusao(
  dados: Pick<Dataset, "sessoes" | "parcelas" | "mentoradoMarcos" | "faturamento">,
  id: string,
): { partes: string[]; concluidas: number } {
  const sessoes = dados.sessoes.filter((s) => s.mentorado_id === id);
  const contagens: [number, string, string][] = [
    [sessoes.length, "sessão", "sessões"],
    [dados.parcelas.filter((p) => p.mentorado_id === id).length, "parcela", "parcelas"],
    [dados.mentoradoMarcos.filter((x) => x.mentorado_id === id).length, "marco de rota", "marcos de rota"],
    [dados.faturamento.filter((f) => f.mentorado_id === id).length, "registro de faturamento", "registros de faturamento"],
  ];
  return {
    partes: contagens.filter(([n]) => n > 0).map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`),
    concluidas: sessoes.filter((s) => s.status === "Concluída").length,
  };
}

// O sync compara o e-mail com o do convidado do evento, em minúsculas e sem espaço: gravado de
// outro jeito, passaria no único do banco e não casaria com o convite (OPS-13).
export const normalizaEmail = (valor: string | null | undefined): string | null => (valor ?? "").trim().toLowerCase() || null;

// O único em lower(email) devolve a mensagem crua do Postgres, que não explica nada a quem cadastra.
export const msgErroMentorado = (erro: string): string =>
  erro.includes("mentorados_email_unico")
    ? "Esse e-mail já está em outro mentorado. Dois cadastros com o mesmo e-mail fariam o sync descartar o evento em vez de escolher um."
    : erro;
