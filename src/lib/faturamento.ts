import { chaveNome } from "./busca";
import type { FaixaRemuneracao, Sessao, Validacao, ValidacaoLoja } from "./data/esquemas";
import { mesDe } from "./datas";
import { reunioesConcluidas1a1 } from "./matriz";
import { eh1a1 } from "./sessoes";

// A validação mensal do faturamento dos mentores (20261029_validacao_faturamento.sql). O banco
// guarda e trava; a conta mora aqui, sem React, para os testes a exercitarem direto.
//
// O calendário: o mentor envia no 1º dia útil do mês seguinte à competência, até 12h; o admin
// confere no 2º e 3º, fecha até o 4º, e o pagamento sai no 5º.
// As faixas: promoção com 3 meses validados seguidos acima da faixa vigente; rebaixamento com 1 mês
// abaixo do piso dela; as duas valem a partir do mês seguinte. Pagamento: valor hora vigente ×
// sessões individuais concluídas (sessão = 1 hora). Falta do mentorado não conta.

export const ESTADOS = ["rascunho", "enviado", "em_conferencia", "ajuste_pedido", "meet_agendado", "validado", "pago"] as const;
export type Estado = (typeof ESTADOS)[number] | "aguardando";

export const ESTADO_LABEL: Record<Estado, string> = {
  aguardando: "Não enviou",
  rascunho: "Rascunho",
  enviado: "Enviado",
  em_conferencia: "Em conferência",
  ajuste_pedido: "Ajuste pedido",
  meet_agendado: "Meet agendado",
  validado: "Validado",
  pago: "Pago",
};

export const ESTADO_TOM: Record<Estado, "neutral" | "info" | "warning" | "success" | "danger" | "purple"> = {
  aguardando: "danger",
  rascunho: "neutral",
  enviado: "info",
  em_conferencia: "info",
  ajuste_pedido: "warning",
  meet_agendado: "purple",
  validado: "success",
  pago: "success",
};

export const MEET_MOTIVO_LABEL: Record<string, string> = {
  cadastro_inicial: "Cadastro inicial",
  promocao: "Promoção",
  divergencia: "Divergência",
};

// O checklist da conferência, na ordem do processo.
export const CHECKLIST_CONFERENCIA: readonly { chave: string; texto: string }[] = [
  { chave: "lojas_mes_inteiro", texto: "Relatórios das lojas cadastradas, cobrindo o mês inteiro" },
  { chave: "deducoes", texto: "Vendas, cancelamentos, devoluções e reembolsos conferidos" },
  { chave: "sem_duplicidade", texto: "Sem pedidos duplicados entre relatórios" },
  { chave: "elegivel_registrado", texto: "Faturamento elegível calculado e registrado" },
  { chave: "historico", texto: "Histórico de 3 meses atualizado e faixa verificada" },
];

export const estadoDe = (v: Pick<Validacao, "estado"> | null | undefined): Estado => {
  const e = v?.estado;
  return ESTADOS.find((x) => x === e) ?? "aguardando";
};

// O mentor só mexe enquanto o mês está com ele; o banco confere de novo.
export const mentorEdita = (v: Validacao | null | undefined): boolean => !v || v.estado === "rascunho" || v.estado === "ajuste_pedido";
export const fechado = (v: Validacao | null | undefined): boolean => v?.estado === "validado" || v?.estado === "pago";

/* ---------------- Calendário ---------------- */

const DIA_MS = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const utc = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function pascoa(ano: number): number {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}

// Feriados nacionais, mais Carnaval e Corpus Christi, que param a operação. Feriado estadual e
// municipal fica de fora: a equipe não está numa cidade só.
export function feriados(ano: number): Set<string> {
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((md) => `${ano}-${md}`);
  const p = pascoa(ano);
  const moveis = [-48, -47, -2, 60].map((dias) => iso(p + dias * DIA_MS));
  return new Set([...fixos, ...moveis]);
}

export function ehDiaUtil(dia: string): boolean {
  const semana = new Date(utc(dia)).getUTCDay();
  return semana !== 0 && semana !== 6 && !feriados(Number(dia.slice(0, 4))).has(dia);
}

// "AAAA-MM" da competência → "AAAA-MM" do mês em que ela é processada.
export function mesSeguinte(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

// Os primeiros `n` dias úteis do mês "AAAA-MM".
export function diasUteis(mes: string, n: number): string[] {
  const dias: string[] = [];
  for (let t = utc(`${mes}-01`); dias.length < n; t += DIA_MS) {
    const dia = iso(t);
    if (ehDiaUtil(dia)) dias.push(dia);
  }
  return dias;
}

export interface Calendario {
  competencia: string; // "AAAA-MM"
  envio: string; // D1
  conferencia: [string, string]; // D2 e D3
  fechamento: string; // D4
  pagamento: string; // D5
  prazoEnvio: string; // D1 12h em Brasília, como instante ISO
}

export function calendario(competencia: string): Calendario {
  const [d1, d2, d3, d4, d5] = diasUteis(mesSeguinte(competencia), 5);
  // Brasília não tem horário de verão desde 2019: 12h é sempre 15h UTC.
  return { competencia, envio: d1, conferencia: [d2, d3], fechamento: d4, pagamento: d5, prazoEnvio: `${d1}T15:00:00.000Z` };
}

// A competência em processo num dia: a do mês anterior.
export const competenciaAtual = (hoje: string): string => mesAnterior(mesDe(hoje));

// Em que passo do calendário o dia cai: 0 antes do D1, 1–5 nos dias, 6 depois do D5.
export function passoDoDia(cal: Calendario, hoje: string): number {
  const dias = [cal.envio, ...cal.conferencia, cal.fechamento, cal.pagamento];
  return hoje > dias[4] ? 6 : dias.filter((d) => d <= hoje).length;
}

// O envio é carimbado pelo banco (`enviado_em`), então o "fora do prazo" não depende do relógio
// de quem enviou. Sem envio, está fora quando o prazo já passou.
export function foraDoPrazo(v: Pick<Validacao, "enviado_em"> | null | undefined, cal: Calendario, agora: Date): boolean {
  const prazo = new Date(cal.prazoEnvio).getTime();
  return v?.enviado_em ? new Date(v.enviado_em).getTime() > prazo : agora.getTime() > prazo;
}

/* ---------------- Faixas ---------------- */

const num = (v: number | string | null | undefined): number => Number(v) || 0;

export const faixasOrdenadas = (faixas: readonly FaixaRemuneracao[]): FaixaRemuneracao[] => [...faixas].sort((a, b) => num(a.piso) - num(b.piso));

// A faixa do valor, ou null abaixo do piso da tabela ("fora da tabela").
export function faixaDe(valor: number, faixas: readonly FaixaRemuneracao[]): FaixaRemuneracao | null {
  return faixasOrdenadas(faixas).find((f) => valor >= num(f.piso) && (f.teto === null || valor <= num(f.teto))) ?? null;
}

export const faixaPorId = (id: number | null | undefined, faixas: readonly FaixaRemuneracao[]): FaixaRemuneracao | null =>
  faixas.find((f) => f.id === id) ?? null;

export const valorHora = (f: FaixaRemuneracao | null): number => (f ? num(f.valor_hora) : 0);

// Faixa acima ou abaixo: pelo piso, que é o que ordena a tabela.
const ordem = (id: number | null, faixas: readonly FaixaRemuneracao[]) => faixasOrdenadas(faixas).findIndex((f) => f.id === id);

// O quanto falta para a faixa seguinte, ou null na última.
export function faltaParaProxima(valor: number, faixa: FaixaRemuneracao | null, faixas: readonly FaixaRemuneracao[]): { faixa: FaixaRemuneracao; falta: number } | null {
  const lista = faixasOrdenadas(faixas);
  const prox = faixa ? lista[lista.findIndex((f) => f.id === faixa.id) + 1] : lista[0];
  return prox ? { faixa: prox, falta: Math.max(0, Math.round((num(prox.piso) - valor) * 100) / 100) } : null;
}

/* ---------------- Lojas ---------------- */

export const elegivelDasLojas = (lojas: readonly Pick<ValidacaoLoja, "vendas" | "cancelamentos" | "devolucoes" | "reembolsos">[]): number =>
  Math.round(lojas.reduce((t, l) => t + num(l.vendas) - num(l.cancelamentos) - num(l.devolucoes) - num(l.reembolsos), 0) * 100) / 100;

/* ---------------- Sessões ---------------- */

export interface SessoesDoMes {
  pagas: Sessao[]; // 1:1 concluídas, uma por reunião (a mesma regra da matriz)
  pendentes: Sessao[]; // 1:1 aguardando confirmação: travam o fechamento
  faltas: Sessao[]; // o mentorado não compareceu: não pagas
}

const doMentor = (nome: string) => (s: Sessao) => chaveNome(s.mentor) === chaveNome(nome);

// As sessões individuais do mentor no mês "AAAA-MM". Em grupo nunca entra.
export function sessoesDoMes(sessoes: readonly Sessao[], mentor: string, competencia: string): SessoesDoMes {
  const noMes = sessoes.filter((s) => eh1a1(s) && mesDe(s.data) === competencia && doMentor(mentor)(s));
  return {
    pagas: reunioesConcluidas1a1(noMes).reunioes,
    pendentes: noMes.filter((s) => s.status === "Aguardando confirmação"),
    faltas: noMes.filter((s) => s.status === "Não compareceu"),
  };
}

// 1:1 concluídas no mês sem mentor: não são pagas a ninguém, e alguém provavelmente ficou sem elas.
export const semMentorNoMes = (sessoes: readonly Sessao[], competencia: string): Sessao[] =>
  sessoes.filter((s) => eh1a1(s) && mesDe(s.data) === competencia && s.status === "Concluída" && !s.mentor?.trim());

/* ---------------- Ciclo e mudança de faixa ---------------- */

const fechadas = (historico: readonly Validacao[], mentor: string) =>
  historico.filter((v) => chaveNome(v.mentor) === chaveNome(mentor) && fechado(v));

const competenciaDe = (v: Validacao) => v.competencia.slice(0, 7);

// A faixa vigente no mês: a gravada na linha, senão a que o último mês fechado deixou para o
// seguinte. Sem histórico, null: é o cadastro inicial, e o admin escolhe (com Meet).
export function faixaVigente(historico: readonly Validacao[], mentor: string, competencia: string, atual?: Validacao | null): number | null {
  if (atual?.faixa_vigente) return atual.faixa_vigente;
  const anterior = fechadas(historico, mentor)
    .filter((v) => competenciaDe(v) < competencia)
    .sort((a, b) => (a.competencia < b.competencia ? 1 : -1))[0];
  return anterior ? (anterior.faixa_seguinte ?? anterior.faixa_vigente) : null;
}

export interface MesDoCiclo {
  competencia: string;
  acima: boolean | null; // null: mês não fechado
}

export type Sugestao =
  | { tipo: "manter"; faixaSeguinte: number | null }
  | { tipo: "promocao"; faixaSeguinte: number; ciclo: MesDoCiclo[] }
  | { tipo: "rebaixamento"; faixaSeguinte: number }
  | { tipo: "foraDaTabela" }
  | { tipo: "inicial" };

// O que o fechamento deste mês faz com a faixa. `faixaDoMes` é a do elegível deste mês.
export function sugestao(historico: readonly Validacao[], mentor: string, competencia: string, vigente: number | null, faixaDoMes: number | null, faixas: readonly FaixaRemuneracao[]): Sugestao {
  if (faixaDoMes === null) return { tipo: "foraDaTabela" };
  if (vigente === null) return { tipo: "inicial" };
  const pos = (id: number | null) => ordem(id, faixas);
  if (pos(faixaDoMes) < pos(vigente)) return { tipo: "rebaixamento", faixaSeguinte: faixaDoMes };

  const ciclo = cicloDePromocao(historico, mentor, competencia, vigente, faixas);
  const anteriores = fechadas(historico, mentor);
  const m1 = anteriores.find((v) => competenciaDe(v) === mesAnterior(competencia));
  const m2 = anteriores.find((v) => competenciaDe(v) === mesAnterior(mesAnterior(competencia)));
  const seq = [m2, m1].every((v) => v && v.faixa_vigente === vigente && v.faixa_do_mes !== null && pos(v.faixa_do_mes) > pos(vigente));
  if (seq && pos(faixaDoMes) > pos(vigente)) {
    // Os 3 meses em faixas diferentes: sobe para a menor delas, a que ele sustentou nos 3.
    const menor = [m2!.faixa_do_mes!, m1!.faixa_do_mes!, faixaDoMes].sort((a, b) => pos(a) - pos(b))[0];
    return { tipo: "promocao", faixaSeguinte: menor, ciclo };
  }
  return { tipo: "manter", faixaSeguinte: vigente };
}

// Os 3 meses que contam para a promoção, terminando na competência; o último ainda aberto.
export function cicloDePromocao(historico: readonly Validacao[], mentor: string, competencia: string, vigente: number | null, faixas: readonly FaixaRemuneracao[]): MesDoCiclo[] {
  const anteriores = fechadas(historico, mentor);
  const meses = [mesAnterior(mesAnterior(competencia)), mesAnterior(competencia), competencia];
  return meses.map((mes) => {
    const v = anteriores.find((x) => competenciaDe(x) === mes);
    if (!v || v.faixa_do_mes === null || vigente === null) return { competencia: mes, acima: null };
    return { competencia: mes, acima: v.faixa_vigente === vigente && ordem(v.faixa_do_mes, faixas) > ordem(vigente, faixas) };
  });
}

/* ---------------- O fechamento ---------------- */

export interface Fechamento {
  faturamento_elegivel: number;
  faixa_do_mes: number | null;
  faixa_vigente: number;
  faixa_seguinte: number;
  mudanca: "promocao" | "rebaixamento" | null;
  sessoes_ids: string[];
  sessoes_qtd: number;
  valor_hora: number;
  valor_pagar: number;
}

// O que a validação grava. `faixaInicial` só vale no primeiro mês, sem histórico.
export function montarFechamento(
  elegivel: number,
  vigente: number,
  s: Sugestao,
  pagas: readonly Sessao[],
  faixas: readonly FaixaRemuneracao[],
  faixaDoMes: number | null,
): Fechamento {
  const hora = valorHora(faixaPorId(vigente, faixas));
  const seguinte = s.tipo === "promocao" || s.tipo === "rebaixamento" ? s.faixaSeguinte : vigente;
  return {
    faturamento_elegivel: elegivel,
    faixa_do_mes: faixaDoMes,
    faixa_vigente: vigente,
    faixa_seguinte: seguinte,
    mudanca: s.tipo === "promocao" || s.tipo === "rebaixamento" ? s.tipo : null,
    sessoes_ids: pagas.map((x) => x.id),
    sessoes_qtd: pagas.length,
    valor_hora: hora,
    valor_pagar: Math.round(hora * pagas.length * 100) / 100,
  };
}

// O que ainda impede validar o mês, na ordem em que a tela mostra.
export function bloqueiosDaValidacao(o: {
  validacao: Validacao | null;
  lojas: number;
  pendentes: number;
  checklist: Record<string, boolean>;
  sugestao: Sugestao;
  vigente: number | null;
}): string[] {
  const motivos: string[] = [];
  if (!o.validacao || o.validacao.estado === "rascunho") motivos.push("O mentor ainda não enviou");
  if (o.lojas === 0) motivos.push("Nenhuma loja informada");
  if (o.pendentes > 0) motivos.push(`${o.pendentes} sessão(ões) aguardando confirmação no mês`);
  const faltando = CHECKLIST_CONFERENCIA.filter((c) => !o.checklist[c.chave]).length;
  if (faltando > 0) motivos.push(`${faltando} item(ns) do checklist sem marcar`);
  if (o.sugestao.tipo === "foraDaTabela") motivos.push("Elegível abaixo de R$ 10.000: fora da tabela, decida antes de validar");
  if (o.vigente === null) motivos.push("Escolha a faixa inicial (cadastro inicial, com Meet)");
  if (o.sugestao.tipo === "promocao" && o.validacao?.meet_motivo !== "promocao") motivos.push("Promoção exige o Meet de promoção antes");
  if (o.sugestao.tipo === "rebaixamento" && !o.validacao?.comunicado_em) motivos.push("Rebaixamento exige registrar a comunicação ao mentor");
  return motivos;
}
