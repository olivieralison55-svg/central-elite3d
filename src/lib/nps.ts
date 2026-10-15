import { casaBusca } from "./busca";
import { diaSP, segundaDe } from "./datas";
import type { ExpResposta, Mentorado, NpsResposta } from "./data/esquemas";
import { aplicarOrdem, type Ordem, type ValorDeOrdem } from "./ordem";

// NPS do index.html (:2748–2763, :2895–3008; mapeamento §3.9). As notas são as que o mentorado dá
// à sessão (0 a 10), por mentor, e a origem é a planilha do formulário: a tela só lê. Nota nula
// conta como 0, como o `Number(r.nota)` de hoje (a coluna não é NOT NULL no que o repo prova).

type ComNota = { nota: number | null };
const notaDe = (r: ComNota): number => Number(r.nota);

export const mediaNps = (respostas: readonly ComNota[]): number | null =>
  respostas.length ? respostas.reduce((soma, r) => soma + notaDe(r), 0) / respostas.length : null;

// O NPS clássico: % de promotores (9 e 10) menos % de detratores (0 a 6), de -100 a +100 (GER-02).
export const scoreNps = (respostas: readonly ComNota[]): number | null =>
  respostas.length
    ? Math.round((100 * (respostas.filter((r) => notaDe(r) >= 9).length - respostas.filter((r) => notaDe(r) <= 6).length)) / respostas.length)
    : null;

export const fmtNps = (valor: number | null): string => (valor === null ? "—" : `${valor > 0 ? "+" : ""}${valor}`);

export const fmtMedia = (valor: number | null): string =>
  valor === null ? "—" : valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// A cor da nota (pillNota): 9 e 10 verde, 7 e 8 âmbar, o resto vermelho.
export const tomDaNota = (nota: number | null): "success" | "warning" | "danger" => {
  const n = Number(nota);
  return n >= 9 ? "success" : n >= 7 ? "warning" : "danger";
};

// As perguntas da Pesquisa de Satisfação desde 13/10/2026 (`perguntasNps`): "Sim" é verde, "Parcial…"
// âmbar e o resto vermelho. Nulas nas respostas anteriores.
export const tomDaResposta = (valor: string): "success" | "warning" | "danger" => (/^sim/i.test(valor) ? "success" : /^parcial/i.test(valor) ? "warning" : "danger");

export type PeriodoNps = "semana" | "mes";

// Os mentores que aparecem nas respostas, em ordem alfabética do português. Mentor nulo não é coluna.
export const mentoresDoNps = (nps: readonly NpsResposta[]): string[] =>
  [...new Set(nps.flatMap((r) => (r.mentor ? [r.mentor] : [])))].sort((a, b) => a.localeCompare(b, "pt-BR"));

// O período de uma resposta: o mês "AAAA-MM" ou a segunda-feira da semana, sempre sobre o dia de
// Brasília (GER-02). Resposta sem data não tem período.
export function chavePeriodo(resposta: Pick<NpsResposta, "respondido_em">, periodo: PeriodoNps): string | null {
  if (!resposta.respondido_em) return null;
  const dia = diaSP(resposta.respondido_em);
  return periodo === "mes" ? dia.slice(0, 7) : segundaDe(dia);
}

// Os períodos com resposta, do mais recente para o mais antigo.
export const periodosDoNps = (nps: readonly NpsResposta[], periodo: PeriodoNps): string[] =>
  [...new Set(nps.flatMap((r) => chavePeriodo(r, periodo) ?? []))].sort().reverse();

const fmtDiaMes = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

// "setembro de 2026" no mês; "07/09 a 13/09" na semana (da segunda ao domingo).
export function rotuloPeriodoNps(chave: string, periodo: PeriodoNps): string {
  if (periodo === "mes") return new Date(`${chave}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const fim = new Date(`${chave}T12:00:00Z`);
  fim.setUTCDate(fim.getUTCDate() + 6);
  return `${fmtDiaMes(chave)} a ${fmtDiaMes(fim.toISOString().slice(0, 10))}`;
}

export interface LinhaPeriodo {
  chave: string;
  respostas: number;
  media: number | null;
  nps: number | null;
  porMentor: Map<string, { media: number | null; n: number }>;
}

// A linha da tabela por período: o geral e, para cada mentor, a média e quantas respostas a formam.
export function linhaDoPeriodo(nps: readonly NpsResposta[], periodo: PeriodoNps, chave: string, mentores: readonly string[]): LinhaPeriodo {
  const doPeriodo = nps.filter((r) => chavePeriodo(r, periodo) === chave);
  return {
    chave,
    respostas: doPeriodo.length,
    media: mediaNps(doPeriodo),
    nps: scoreNps(doPeriodo),
    porMentor: new Map(
      mentores.map((m) => {
        const dele = doPeriodo.filter((r) => r.mentor === m);
        return [m, { media: mediaNps(dele), n: dele.length }];
      }),
    ),
  };
}

// A página `pedida` da lista, presa ao que existe: um filtro que encolhe a lista não deixa a tela
// numa página vazia (`paginaNps`, index.html:2756). `paginas` é sempre pelo menos 1.
export function paginar<T>(lista: readonly T[], pedida: number, tamanho: number): { itens: T[]; pagina: number; paginas: number } {
  const paginas = Math.max(1, Math.ceil(lista.length / tamanho));
  const pagina = Math.min(Math.max(1, pedida || 1), paginas);
  return { itens: lista.slice((pagina - 1) * tamanho, pagina * tamanho), pagina, paginas };
}

export const TAMANHO_PERIODOS = 10;
export const TAMANHO_RESPOSTAS = 20;

export const ORDEM_RESPOSTAS: Ordem = { campo: "data", direcao: "desc" };
const ORDENS: Readonly<Record<string, (r: NpsResposta) => ValorDeOrdem>> = {
  data: (r) => r.respondido_em,
  nome: (r) => (r.nome_informado || "").toLowerCase(),
  mentor: (r) => r.mentor,
  nota: (r) => Number(r.nota),
};

// As respostas da tela: o filtro de mentor, depois a busca (nome informado, mentor, comentário,
// "quer mais apoio em" e o nome da ficha), depois a ordem. `doMentor` é a base do selo da busca.
export function respostasDoNps(
  nps: readonly NpsResposta[],
  mentores: readonly Mentorado[],
  mentor: string,
  busca: string,
  ordem: Ordem | null,
): { lista: NpsResposta[]; doMentor: number } {
  const doMentor = nps.filter((r) => !mentor || r.mentor === mentor);
  const achadas = doMentor.filter((r) =>
    casaBusca(busca, r.nome_informado, r.mentor, r.comentario, r.apoio, mentores.find((m) => m.id === r.mentorado_id)?.nome),
  );
  return { lista: aplicarOrdem(achadas, ordem ?? ORDEM_RESPOSTAS, ORDENS), doMentor: doMentor.length };
}

// A Pesquisa de Experiência (painelExperiencia). A grade vai de 0 a 100: Muito ruim 0 ... Excelente 100.
export const NIVEL_EXP: ReadonlyMap<string, number> = new Map([
  ["Muito ruim", 0],
  ["Ruim", 25],
  ["Regular", 50],
  ["Bom", 75],
  ["Excelente", 100],
]);

export interface ItemExperiencia {
  item: string;
  indice: number;
  respostas: number;
}

export interface ResumoExperiencia {
  nps: number | null;
  media: number | null;
  respostas: number;
  // A média das médias dos itens, arredondada; null sem item com nível conhecido.
  indice: number | null;
  itens: ItemExperiencia[];
  clareza: { sim: number; parcial: number; nao: number; pctSim: number };
}

// O índice por item é a média dos níveis que chegaram; o texto fora da grade não entra. O pior
// item vem primeiro.
export function resumoExperiencia(experiencia: readonly ExpResposta[]): ResumoExperiencia {
  const niveis = new Map<string, number[]>();
  for (const r of experiencia) {
    for (const [item, texto] of Object.entries(r.itens)) {
      const nivel = NIVEL_EXP.get(texto);
      if (nivel !== undefined) niveis.set(item, [...(niveis.get(item) ?? []), nivel]);
    }
  }
  const itens = [...niveis].map(([item, v]) => ({ item, indice: v.reduce((a, b) => a + b, 0) / v.length, respostas: v.length })).sort((a, b) => a.indice - b.indice);
  const conta = (valor: string) => experiencia.filter((r) => r.clareza === valor).length;
  return {
    nps: scoreNps(experiencia),
    media: mediaNps(experiencia),
    respostas: experiencia.length,
    indice: itens.length ? Math.round(itens.reduce((a, x) => a + x.indice, 0) / itens.length) : null,
    itens,
    clareza: {
      sim: conta("Sim"),
      parcial: conta("Parcialmente"),
      nao: conta("Não"),
      pctSim: experiencia.length ? Math.round((100 * conta("Sim")) / experiencia.length) : 0,
    },
  };
}

// A cor do índice de um item: 75 ou mais verde, 50 ou mais âmbar, o resto vermelho.
export const tomDoIndice = (indice: number): "success" | "warning" | "danger" => (indice >= 75 ? "success" : indice >= 50 ? "warning" : "danger");
