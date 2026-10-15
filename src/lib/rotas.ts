import type { Canal, Faturamento, MarcoDef, MentoradoMarco, Rota } from "./data/esquemas";
import type { EvolucaoRica, EvolucaoSimples } from "./data/escritas";
import { dpLabel, mesDe } from "./datas";

// Rotas e marcos do index.html (:2203–2606; mapeamento §3.7). O que a tela desenha sai daqui:
// a régua de faturamento, o estado do stepper e o payload do W09. "Hoje" vem de quem chama
// (AD-007): o mês corrente de uma aba aberta de um dia para o outro não congela.

const RICO_STATUS = ["NAO_INICIADO", "EM_ANDAMENTO", "BLOQUEADO", "AGUARDANDO_VALIDACAO", "CONCLUIDO", "NAO_APLICAVEL"] as const;
const SIMPLES_STATUS = ["nao_passou", "passou"] as const;

export const RICO_LABEL: Readonly<Record<string, string>> = {
  CONCLUIDO: "Concluído",
  EM_ANDAMENTO: "Em andamento",
  BLOQUEADO: "Bloqueado",
  AGUARDANDO_VALIDACAO: "Aguard. validação",
  NAO_APLICAVEL: "Não aplicável",
  NAO_INICIADO: "Não iniciado",
};
const SIMPLES_LABEL: Readonly<Record<string, string>> = { passou: "Passou", nao_passou: "Não passou" };

export const ehSimples = (rota: Pick<Rota, "modelo">): boolean => rota.modelo === "simples";

// Os status que o select do registro oferece, com o rótulo de cada um.
export const statusDaRota = (rota: Pick<Rota, "modelo">): { value: string; label: string }[] =>
  (ehSimples(rota) ? SIMPLES_STATUS : RICO_STATUS).map((value) => ({ value, label: (ehSimples(rota) ? SIMPLES_LABEL : RICO_LABEL)[value] }));

// O texto do status: o rótulo conhecido, ou o valor cru de um status que o banco guardou fora da lista.
export const rotuloDoStatus = (rota: Pick<Rota, "modelo">, status: string): string => (ehSimples(rota) ? SIMPLES_LABEL : RICO_LABEL)[status] ?? status;

const porOrdem = <T extends { ordem: number | null }>(a: T, b: T) => (a.ordem ?? 0) - (b.ordem ?? 0);

export const marcosDaRota = (marcos: readonly MarcoDef[], rota: Pick<Rota, "id">): MarcoDef[] => marcos.filter((m) => m.rota_id === rota.id).sort(porOrdem);
export const canaisDaRota = (canais: readonly Canal[], rota: Pick<Rota, "id">): Canal[] => canais.filter((c) => c.rota_id === rota.id).sort(porOrdem);

// A rota do endereço de tela; sem escolha, ou com slug que não existe mais, a primeira.
export const rotaEscolhida = (rotas: readonly Rota[], slug: string | null): Rota | null => rotas.find((r) => r.slug === slug) ?? rotas[0] ?? null;

// Os `n` meses até o de `hoje` ("AAAA-MM-DD"), do mais antigo ao corrente, em "AAAA-MM".
export function ultimosMeses(hoje: string, n = 12): string[] {
  const [ano, mes] = hoje.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const indice = ano * 12 + (mes - 1) - (n - 1 - i);
    return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
  });
}

// "Ago/26", o rótulo curto do eixo e da tabela de registros.
export const rotuloDoMes = (mes: string): string => `${dpLabel(mes, "month").split("/")[0]}/${mes.slice(2, 4)}`;

// Régua de valores (OPS-19): a soma dos canais da ROTA inteira, não só do canal aberto. A unidade
// muda por rota, por decisão de projeto: `mes` mede o mês corrente (canal de fluxo contínuo:
// acumular esconderia anúncio morto); qualquer outra, o acumulado.
export function reguaFaturamento(
  rota: Pick<Rota, "unidade">,
  canaisDaRotaAtual: readonly Pick<Canal, "id">[],
  faturamento: readonly Faturamento[],
  mentoradoId: string,
  mesCorrente: string,
): number {
  const canais = new Set(canaisDaRotaAtual.map((c) => c.id));
  return faturamento
    .filter((f) => f.mentorado_id === mentoradoId && f.canal_id !== null && canais.has(f.canal_id))
    .filter((f) => rota.unidade !== "mes" || mesDe(f.mes) === mesCorrente)
    .reduce((soma, f) => soma + Number(f.valor), 0);
}

// A meta do marco contra a régua; sem `meta_valor`, o marco não tem régua.
export function metaDoMarco(marco: Pick<MarcoDef, "meta_valor">, atual: number): { meta: number; falta: number } | null {
  if (marco.meta_valor == null) return null;
  const meta = Number(marco.meta_valor);
  return { meta, falta: Math.max(0, meta - atual) };
}

// Faturamento de um mentorado num canal: o total de cada mês da janela, o do mês corrente e do
// anterior (os dois últimos da janela) e a variação em percentual, null sem base de comparação.
export function resumoFaturamento(registros: readonly Faturamento[], meses: readonly string[]) {
  const porMes = meses.map((mes) => registros.filter((f) => mesDe(f.mes) === mes).reduce((soma, f) => soma + Number(f.valor), 0));
  const atual = porMes[porMes.length - 1] ?? 0;
  const anterior = porMes[porMes.length - 2] ?? 0;
  return { porMes, atual, anterior, variacao: anterior > 0 ? ((atual - anterior) / anterior) * 100 : null };
}

export function textoVariacao(variacao: number | null): string {
  if (variacao === null) return "sem base de comparação";
  return `${variacao >= 0 ? "+" : ""}${variacao.toFixed(0)}% vs mês anterior`;
}

// A série de cada marco no gráfico de linha: quantos mentorados concluíram o marco em cada mês
// da janela. A data de conclusão é a do registro.
export function serieDeMarcos(marcos: readonly MarcoDef[], registros: readonly MentoradoMarco[], rota: Pick<Rota, "modelo">, meses: readonly string[]) {
  const concluido = ehSimples(rota) ? "passou" : "CONCLUIDO";
  return marcos.map((marco) => ({
    marco,
    pontos: meses.map((mes) => registros.filter((r) => r.marco_id === marco.id && r.status === concluido && mesDe(r.data) === mes).length),
  }));
}

// Teste de passagem: `criterios` é uma lista de portões. O que fica salvo em `criterios_ok` é o
// TEXTO do item, não o índice: reescrever o catálogo não pode migrar a marcação de um critério
// para outro sem ninguém perceber (OPS-18).
export function portoesDe(marco: Pick<MarcoDef, "criterios">): { grupo: string | null; itens: string[] }[] {
  return marco.criterios.filter((g) => g.itens.length > 0).map((g) => ({ grupo: g.grupo, itens: g.itens }));
}

export const criteriosDe = (marco: Pick<MarcoDef, "criterios">): string[] => portoesDe(marco).flatMap((g) => g.itens);

export interface Progresso {
  feitos: number;
  total: number;
  pct: number | null;
}

// Quantos critérios do catálogo estão marcados. Texto marcado que saiu do catálogo não conta.
export function progressoDe(criterios: readonly string[], marcados: ReadonlySet<string>): Progresso {
  const total = criterios.length;
  if (!total) return { feitos: 0, total: 0, pct: null };
  const feitos = criterios.filter((c) => marcados.has(c)).length;
  return { feitos, total, pct: Math.round((feitos / total) * 100) };
}

export const progressoMarco = (marco: Pick<MarcoDef, "criterios">, registro: Pick<MentoradoMarco, "criterios_ok"> | undefined): Progresso =>
  progressoDe(criteriosDe(marco), new Set(registro?.criterios_ok));

export type Fase = "feito" | "atual" | "futuro";

// O estado de um marco no stepper (index.html:2422–2425). Sem registro, o marco ainda não
// começou. `NAO_APLICAVEL` fica como futuro, como hoje (§10, item 36).
export function estadoDoMarco(rota: Pick<Rota, "modelo">, registro: Pick<MentoradoMarco, "status"> | undefined): { status: string; fase: Fase } {
  const status = registro?.status || (ehSimples(rota) ? "nao_passou" : "NAO_INICIADO");
  if (status === "passou" || status === "CONCLUIDO") return { status, fase: "feito" };
  if (status === "EM_ANDAMENTO" || status === "AGUARDANDO_VALIDACAO" || status === "BLOQUEADO") return { status, fase: "atual" };
  return { status, fase: "futuro" };
}

// O que o registro do mentor guarda enquanto a pessoa digita: tudo texto, como os campos.
export interface CamposEvolucao {
  status: string;
  data: string;
  marcados: ReadonlySet<string>;
  proximaAcao: string;
  bloqueios: string;
}

export function camposDoMarco(rota: Pick<Rota, "modelo">, registro: MentoradoMarco | undefined): CamposEvolucao {
  return {
    status: estadoDoMarco(rota, registro).status,
    data: registro?.data ?? "",
    marcados: new Set(registro?.criterios_ok),
    proximaAcao: registro?.proxima_acao ?? "",
    bloqueios: (registro?.bloqueios ?? []).join("\n"),
  };
}

// W09: o payload da evolução. Na rota rica, `criterios_ok`, `criterios_pendentes` e `progresso`
// saem do teste de passagem, sem campo manual para discordar do que está marcado (OPS-18).
// O texto marcado que saiu do catálogo se perde ao salvar, como hoje (§10, item 34).
export function montarEvolucao(rota: Pick<Rota, "modelo">, marco: Pick<MarcoDef, "criterios">, campos: CamposEvolucao): EvolucaoSimples | EvolucaoRica {
  const simples: EvolucaoSimples = { status: campos.status, data: campos.data || null };
  if (ehSimples(rota)) return simples;
  const criterios = criteriosDe(marco);
  return {
    ...simples,
    criterios_ok: criterios.filter((c) => campos.marcados.has(c)),
    criterios_pendentes: criterios.filter((c) => !campos.marcados.has(c)),
    progresso: progressoDe(criterios, campos.marcados).pct,
    bloqueios: campos.bloqueios
      .split("\n")
      .map((linha) => linha.trim())
      .filter(Boolean),
    proxima_acao: campos.proximaAcao.trim() || null,
  };
}
