import type { Dataset, Mentorado, NpsResposta, Sessao } from "./data/esquemas";
import { diaSP } from "./datas";
import type { LeituraMentor } from "./ia";
import { reunioesConcluidas1a1 } from "./matriz";
import { ehAtivo } from "./mentorados";
import { mediaNps, scoreNps } from "./nps";
import { agruparGrupo, eh1a1, type Encontro, ehGrupo } from "./sessoes";

// Mentores do index.html (:2978–3081; mapeamento §3.11): tudo o que a central sabe de cada mentor
// num lugar. As sessões 1:1 contam por reunião (a mesma regra da matriz do Dashboard, OPS-02), os
// encontros em grupo por encontro. "Hoje" vem de quem chama: a regra não o calcula.

export type DadosMentores = Pick<Dataset, "sessoes" | "mentorados" | "nps" | "transcricoes" | "analise" | "mentores">;

// A data `hoje` menos `dias`, em dia de calendário: a conta é em UTC ao meio-dia, sem horário de verão.
export const haDias = (hoje: string, dias: number): string => new Date(new Date(`${hoje}T12:00:00Z`).getTime() - dias * 864e5).toISOString().slice(0, 10);

// Os mentores da tela: os atuais primeiro, depois quem ainda aparece nas sessões (histórico), em
// ordem alfabética do português.
export const mentoresDaTela = (sessoes: readonly Sessao[], ativos: readonly string[]): string[] => [
  ...ativos,
  ...[...new Set(sessoes.flatMap((s) => (s.mentor ? [s.mentor] : [])))].filter((n) => !ativos.includes(n)).sort((a, b) => a.localeCompare(b, "pt-BR")),
];

// As opções de mentor de um formulário: os do cadastro, e o já gravado mesmo que tenha saído.
export const mentoresCom = (ativos: readonly string[], atual: string | null): string[] => [...ativos, ...(atual && !ativos.includes(atual) ? [atual] : [])];

export interface ResumoMentor {
  nome: string;
  // Mentorados ativos cuja última 1:1 concluída foi com ele, a que está há mais tempo sem sessão primeiro.
  carteira: { m: Mentorado; ultima: Sessao }[];
  nps: NpsResposta[];
  nps30: NpsResposta[];
  r1: Sessao[];
  r1_30: Sessao[];
  grupos: Encontro[];
  grupos30: Encontro[];
  // As agendadas de hoje em diante, a mais próxima primeiro.
  agenda: Sessao[];
  ultima: string | null;
  // As calls transcritas aceitas no dossiê.
  calls: number;
  leitura: LeituraMentor | null;
}

// A última 1:1 concluída de cada mentorado (com data e mentor). Uma 1:1 mais nova que não está
// concluída não a desloca, e no empate de data fica a primeira que apareceu.
function ultimaConcluidaPorMentorado(sessoes: readonly Sessao[]): Map<string, Sessao> {
  const ultima = new Map<string, Sessao>();
  for (const s of sessoes) {
    if (!eh1a1(s) || s.status !== "Concluída" || !s.data || !s.mentor || !s.mentorado_id) continue;
    const u = ultima.get(s.mentorado_id);
    if (!u || (u.data !== null && s.data > u.data)) ultima.set(s.mentorado_id, s);
  }
  return ultima;
}

function resumir(nome: string, dados: DadosMentores, hoje: string, reunioes: readonly Sessao[], ultimas: ReadonlyMap<string, Sessao>): ResumoMentor {
  const corte = haDias(hoje, 30);
  const minhas = dados.sessoes.filter((s) => s.mentor === nome);
  const r1 = reunioes.filter((s) => s.mentor === nome);
  const grupos = agruparGrupo(minhas.filter((s) => ehGrupo(s) && s.status === "Concluída"));
  const nps = dados.nps.filter((r) => r.mentor === nome);
  const carteira = dados.mentorados.flatMap((m) => {
    const ultima = ultimas.get(m.id);
    return ehAtivo(m) && ultima?.mentor === nome ? [{ m, ultima }] : [];
  });
  return {
    nome,
    carteira: carteira.sort((a, b) => (a.ultima.data ?? "").localeCompare(b.ultima.data ?? "")),
    nps,
    nps30: nps.filter((r) => r.respondido_em !== null && diaSP(r.respondido_em) >= corte),
    r1,
    r1_30: r1.filter((s) => s.data !== null && s.data >= corte),
    grupos,
    grupos30: grupos.filter((g) => g.data !== null && g.data >= corte),
    agenda: minhas
      .filter((s) => s.status === "Agendada" && s.data !== null && s.data >= hoje)
      .sort((a, b) => `${a.data}${a.hora ?? ""}`.localeCompare(`${b.data}${b.hora ?? ""}`)),
    ultima: [...r1.map((s) => s.data), ...grupos.map((g) => g.data)].flatMap((d) => d ?? []).sort().pop() ?? null,
    calls: dados.transcricoes.filter((t) => t.mentor === nome && t.status === "aceita").length,
    leitura: dados.analise?.mentores?.find((l) => l.mentor === nome) ?? null,
  };
}

// Um resumo por mentor da tela, e um só para o mentor aberto.
export function resumosDosMentores(dados: DadosMentores, hoje: string): ResumoMentor[] {
  const { reunioes } = reunioesConcluidas1a1(dados.sessoes);
  const ultimas = ultimaConcluidaPorMentorado(dados.sessoes);
  return mentoresDaTela(dados.sessoes, dados.mentores).map((nome) => resumir(nome, dados, hoje, reunioes, ultimas));
}

export function resumoDoMentor(dados: DadosMentores, hoje: string, nome: string): ResumoMentor {
  return resumir(nome, dados, hoje, reunioesConcluidas1a1(dados.sessoes).reunioes, ultimaConcluidaPorMentorado(dados.sessoes));
}

export interface VisaoMentores {
  ativos: ResumoMentor[];
  historico: ResumoMentor[];
  totais: { r1_30: number; r1: number; grupos30: number; grupos: number; agenda: number };
  nps30: { media: number | null; nps: number | null };
}

// A visão geral: quem tem atividade e os cards. É ativo o mentor da lista atual, ou quem teve 1:1
// nos últimos 30 dias ou tem agenda; os outros vão para o histórico. Os totais somam todos. O NPS
// de 30 dias é o de todas as respostas, de qualquer mentor.
export function visaoMentores(resumos: readonly ResumoMentor[], nps: readonly NpsResposta[], hoje: string, cadastrados: readonly string[]): VisaoMentores {
  const ativo = (r: ResumoMentor) => cadastrados.includes(r.nome) || r.r1_30.length > 0 || r.agenda.length > 0;
  const soma = (f: (r: ResumoMentor) => number) => resumos.reduce((a, r) => a + f(r), 0);
  const corte = haDias(hoje, 30);
  const recentes = nps.filter((r) => r.respondido_em !== null && diaSP(r.respondido_em) >= corte);
  return {
    ativos: resumos.filter(ativo),
    historico: resumos.filter((r) => !ativo(r)),
    totais: { r1_30: soma((r) => r.r1_30.length), r1: soma((r) => r.r1.length), grupos30: soma((r) => r.grupos30.length), grupos: soma((r) => r.grupos.length), agenda: soma((r) => r.agenda.length) },
    nps30: { media: mediaNps(recentes), nps: scoreNps(recentes) },
  };
}

// Os 6 últimos meses "AAAA-MM", do mais recente para o mais antigo, terminando no mês de `hoje`.
export function ultimosMeses(hoje: string, quantos = 6): string[] {
  return Array.from({ length: quantos }, (_, i) => {
    const d = new Date(`${hoje.slice(0, 7)}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    return d.toISOString().slice(0, 7);
  });
}

export interface AtividadeMes {
  mes: string;
  r1: number;
  grupos: number;
  respostas: number;
  media: number | null;
}

// A atividade dos 6 últimos meses: 1:1 e encontros pelo dia da sessão, respostas pelo dia de Brasília.
export function atividadePorMes(r: ResumoMentor, hoje: string): AtividadeMes[] {
  return ultimosMeses(hoje).map((mes) => {
    const doMes = r.nps.filter((x) => x.respondido_em !== null && diaSP(x.respondido_em).slice(0, 7) === mes);
    return {
      mes,
      r1: r.r1.filter((s) => (s.data ?? "").startsWith(mes)).length,
      grupos: r.grupos.filter((g) => (g.data ?? "").startsWith(mes)).length,
      respostas: doMes.length,
      media: mediaNps(doMes),
    };
  });
}

const maisRecentesPrimeiro = (nps: readonly NpsResposta[]): NpsResposta[] => [...nps].sort((a, b) => String(b.respondido_em).localeCompare(String(a.respondido_em)));

// As 10 últimas respostas de NPS do mentor.
export const ultimasRespostas = (r: ResumoMentor, quantas = 10): NpsResposta[] => maisRecentesPrimeiro(r.nps).slice(0, quantas);

// A última nota que o mentorado deu a este mentor, para a carteira.
export const ultimaNotaDe = (r: ResumoMentor, mentoradoId: string): NpsResposta | null => maisRecentesPrimeiro(r.nps.filter((x) => x.mentorado_id === mentoradoId))[0] ?? null;
