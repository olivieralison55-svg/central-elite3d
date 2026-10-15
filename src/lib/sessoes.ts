import { alvoBuscaData, casaBusca } from "./busca";
import { ETAPAS_GRUPO } from "./constantes";
import type { Sessao } from "./data/esquemas";

// Sessões 1:1 e em grupo do index.html (:601–602, :804–811, :971–1003, :877–884, :1856–1960). A
// trilha de 12 etapas e os encontros coletivos vivem na mesma tabela, mas nunca se somam: separe
// sempre pelo tipo antes de contar (OPS-05).

type ComEtapa = { etapa: string | null } | null | undefined;

export const ehGrupo = (s: ComEtapa): boolean => !!s && s.etapa !== null && ETAPAS_GRUPO.includes(s.etapa);
// Etapa fora do catálogo (registro antigo) é 1:1, como hoje.
export const eh1a1 = (s: ComEtapa): boolean => !ehGrupo(s);

// As sessões de um mentorado na ordem da trilha.
const sessoesDe = (sessoes: readonly Sessao[], mentoradoId: string) =>
  sessoes.filter((s) => s.mentorado_id === mentoradoId).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

export const sessoes1a1De = (sessoes: readonly Sessao[], mentoradoId: string): Sessao[] => sessoesDe(sessoes, mentoradoId).filter(eh1a1);
export const sessoesGrupoDe = (sessoes: readonly Sessao[], mentoradoId: string): Sessao[] => sessoesDe(sessoes, mentoradoId).filter(ehGrupo);

// Os direitos do mentorado nos encontros em grupo (:592–596): uma sessão de implementação (a
// falta dela é alerta no Dashboard) e plantões de dúvida, só contados, desde o fechamento.
export const ETAPA_IMPLEMENTACAO = "Sessão de Implementação Mensal";
const ETAPA_PLANTAO = "Plantão de Dúvida Semanal";

// A primeira presença concluída na implementação, ou null.
export const implementacaoDe = (sessoes: readonly Sessao[], mentoradoId: string): Sessao | null =>
  sessoes
    .filter((s) => s.mentorado_id === mentoradoId && s.etapa === ETAPA_IMPLEMENTACAO && s.status === "Concluída")
    .sort((a, b) => (String(a.data) < String(b.data) ? -1 : 1))[0] ?? null;

export const plantoesDe = (sessoes: readonly Sessao[], m: { id: string; data_fechamento: string | null }): number =>
  sessoes.filter(
    (s) =>
      s.mentorado_id === m.id &&
      s.etapa === ETAPA_PLANTAO &&
      s.status === "Concluída" &&
      (!m.data_fechamento || !s.data || s.data >= m.data_fechamento),
  ).length;

// Quantas 1:1 concluídas o mentorado tem: a ordem da coluna Sessões e o "N" de "N de M".
export const concluidas1a1De = (sessoes: readonly Sessao[], mentoradoId: string): number =>
  sessoes1a1De(sessoes, mentoradoId).filter((s) => s.status === "Concluída").length;

// A trilha de 12 segmentos: uma marca por sessão 1:1, no formato do SegmentedProgress.
export type TomTrilha = "success" | "primary" | "danger" | "neutral";
const TOM_TRILHA: ReadonlyMap<string, TomTrilha> = new Map([
  ["Concluída", "success"],
  ["Agendada", "primary"],
  ["Bloqueada", "danger"],
]);

export const trilhaDe = (sessoes: readonly Sessao[], mentoradoId: string): { tone: TomTrilha; label: string }[] =>
  sessoes1a1De(sessoes, mentoradoId).map((s) => ({ tone: TOM_TRILHA.get(s.status ?? "") ?? "neutral", label: `${s.etapa ?? ""}: ${s.status || "—"}` }));

// Um encontro coletivo é gravado como uma linha por participante, porque sessoes.mentorado_id é
// obrigatório no banco. A chave é etapa + data + hora (OPS-07): o mentor fica fora dela, e o
// encontro herda o primeiro mentor e o primeiro link não nulos.
export interface Encontro {
  chave: string;
  etapa: string | null;
  data: string | null;
  hora: string | null;
  mentor: string | null;
  link_meet: string | null;
  link_gravacao: string | null;
  link_anotacoes: string | null;
  itens: Sessao[];
}

export function agruparGrupo(sessoes: readonly Sessao[]): Encontro[] {
  const mapa = new Map<string, Encontro>();
  for (const s of sessoes) {
    const chave = `${s.etapa ?? ""}|${s.data ?? ""}|${s.hora ?? ""}`;
    const e = mapa.get(chave) ?? {
      chave,
      etapa: s.etapa,
      data: s.data,
      hora: s.hora,
      mentor: null,
      link_meet: null,
      link_gravacao: null,
      link_anotacoes: null,
      itens: [],
    };
    mapa.set(chave, e);
    e.itens.push(s);
    e.mentor ||= s.mentor || null;
    e.link_meet ||= s.link_meet || null;
    e.link_gravacao ||= s.link_gravacao || null;
    e.link_anotacoes ||= s.link_anotacoes || null;
  }
  return [...mapa.values()];
}

// Quantas presenças em cada status, da mais frequente para a menos (empate: a que apareceu
// primeiro). Status fora de S_STATUS vem cru; nulo vira "—" (EDGE-05).
function contagemStatus(e: Encontro): [string, number][] {
  const contagem = new Map<string, number>();
  for (const s of e.itens) {
    const status = s.status || "—";
    contagem.set(status, (contagem.get(status) ?? 0) + 1);
  }
  return [...contagem].sort((a, b) => b[1] - a[1]);
}

// O status do encontro é o mais frequente entre os participantes.
export const statusGrupo = (e: Encontro): string => contagemStatus(e)[0]?.[0] ?? "—";

// "Aguardando confirmação" é invariável; os outros só ganham "s". Fora da lista, o texto cru.
const STATUS_PLURAL: ReadonlyMap<string, string> = new Map([
  ["Não iniciada", "não iniciadas"],
  ["Agendada", "agendadas"],
  ["Aguardando confirmação", "aguardando confirmação"],
  ["Concluída", "concluídas"],
  ["Bloqueada", "bloqueadas"],
]);

export const resumoStatusGrupo = (e: Encontro): string =>
  contagemStatus(e)
    .map(([status, n]) => `${n} ${n === 1 ? status.toLowerCase() : (STATUS_PLURAL.get(status) ?? status.toLowerCase())}`)
    .join(" · ");

// A busca de Sessões no encontro, depois de agrupar: filtrar linha a linha deixaria o encontro
// com um participante só, e a coluna "Participantes" mentiria sobre quem esteve na sala (OPS-07).
export const casaEncontro = (e: Encontro, termo: string, nomeDe: (id: string | null) => string): boolean =>
  casaBusca(termo, e.itens.map((s) => nomeDe(s.mentorado_id)).join(" "), e.mentor, e.etapa, alvoBuscaData(e.data, e.hora));

// Os blocos 1:1 de Sessões. "Não iniciada" não tem bloco: são as vagas da trilha. Fora de foco,
// as concluídas são as 30 de data mais recente (OPS-09; hoje o corte vinha antes de ordenar e
// mostrava as 30 de menor `ordem`). Sob foco não há corte: o aviso pode apontar uma sessão de
// meses atrás, e o corte esconderia a linha que a pessoa veio conferir.
export interface Bloco {
  chave: "aguardando" | "agendadas" | "concluidas" | "bloqueadas";
  titulo: string;
  itens: Sessao[];
}

const quando = (s: Sessao) => `${s.data ?? ""} ${s.hora ?? ""}`;
const maisRecentes = (lista: Sessao[], n: number) =>
  [...lista].sort((a, b) => (quando(a) < quando(b) ? 1 : quando(a) > quando(b) ? -1 : 0)).slice(0, n);

export function blocos1a1(sessoes: readonly Sessao[], comFoco: boolean): Bloco[] {
  const em = (status: string) => sessoes.filter((s) => s.status === status);
  const concluidas = em("Concluída");
  return [
    { chave: "aguardando", titulo: "Aguardando confirmação", itens: em("Aguardando confirmação") },
    { chave: "agendadas", titulo: "Agendadas", itens: em("Agendada") },
    comFoco
      ? { chave: "concluidas", titulo: "Concluídas", itens: concluidas }
      : { chave: "concluidas", titulo: "Concluídas (últimas 30)", itens: maisRecentes(concluidas, 30) },
    { chave: "bloqueadas", titulo: "Bloqueadas", itens: em("Bloqueada") },
  ];
}

// A busca de Sessões na linha 1:1: mentorado, etapa, mentor e a data nos formatos em que se digita
// (alvoBuscaData). Linha sem data não casa com busca de data nenhuma.
export const casaSessao = (s: Sessao, termo: string, nomeDe: (id: string | null) => string): boolean =>
  casaBusca(termo, nomeDe(s.mentorado_id), s.etapa, s.mentor, alvoBuscaData(s.data, s.hora));

export interface RecorteSessoes {
  focoIds: readonly string[] | null; // os ids do aviso do Dashboard
  mentor: string; // "" = todos; "__sem__" = sem mentor; senão o texto exato
  tipo: string; // "" = todos; "individual"; "grupo"
  busca: string;
}

export interface SessoesRecortadas {
  linhas: Sessao[]; // depois do foco e do mentor
  individuais: Sessao[]; // as 1:1 que a busca deixou
  grupos: { categoria: string; encontros: Encontro[] }[]; // por categoria, depois de agrupar e buscar
  mostraIndividuais: boolean;
  mostraGrupo: boolean;
  selo: { n: number; total: number }; // 1:1 por linha e encontro por encontro, só do tipo mostrado
  totais: { concluidas1a1: number; agendadas1a1: number; encontros: number }; // o topo: a operação inteira
}

// Os recortes de Sessões nesta ordem: foco, mentor, tipo e busca (mapeamento §3.3). O foco vem
// antes dos filtros: o aviso aponta linhas, e um filtro não deveria conseguir escondê-las (NAV-10).
// Sob foco, a seção que ficaria vazia não aparece. Os totais do topo não encolhem (OPS-10).
export function recortarSessoes(sessoes: readonly Sessao[], recorte: RecorteSessoes, nomeDe: (id: string | null) => string): SessoesRecortadas {
  const ids = recorte.focoIds ? new Set(recorte.focoIds) : null;
  const doMentor = (s: Sessao) => (recorte.mentor === "__sem__" ? !s.mentor : !recorte.mentor || s.mentor === recorte.mentor);
  const linhas = sessoes.filter((s) => (!ids || ids.has(s.id)) && doMentor(s));
  const individuais = linhas.filter((s) => eh1a1(s) && casaSessao(s, recorte.busca, nomeDe));
  const grupo = linhas.filter(ehGrupo);
  const mostraIndividuais = recorte.tipo !== "grupo" && (!ids || individuais.length > 0);
  const mostraGrupo = recorte.tipo !== "individual" && (!ids || grupo.length > 0);
  const encontros = agruparGrupo(grupo);
  const casam = encontros.filter((e) => casaEncontro(e, recorte.busca, nomeDe));
  const todas1a1 = sessoes.filter(eh1a1);
  return {
    linhas,
    individuais,
    grupos: ETAPAS_GRUPO.map((categoria) => ({ categoria, encontros: casam.filter((e) => e.etapa === categoria) })),
    mostraIndividuais,
    mostraGrupo,
    selo: {
      n: (mostraIndividuais ? individuais.length : 0) + (mostraGrupo ? casam.length : 0),
      total: (mostraIndividuais ? linhas.filter(eh1a1).length : 0) + (mostraGrupo ? encontros.length : 0),
    },
    totais: {
      concluidas1a1: todas1a1.filter((s) => s.status === "Concluída").length,
      agendadas1a1: todas1a1.filter((s) => s.status === "Agendada").length,
      encontros: agruparGrupo(sessoes.filter(ehGrupo)).length,
    },
  };
}
