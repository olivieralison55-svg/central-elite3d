// Datas do index.html (:606, :813–970, :1022–1026, :1550, :2722–2731). O `HOJE` de lá era
// calculado uma vez, no carregamento: com a aba aberta de um dia para o outro, todo prazo ficava
// um dia atrás. Aqui "hoje" é `hojeSP()`, calculado na hora do uso (EDGE-03, AD-007).

const FUSO = "America/Sao_Paulo";
const DIA_MS = 86400000;
const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// O dia de Brasília de um instante, "AAAA-MM-DD". toISOString() devolveria o dia de UTC, que
// entre 21h e meia-noite de Brasília já é o seguinte.
const diaEmSP = (instante: Date) => instante.toLocaleDateString("sv-SE", { timeZone: FUSO });

export const hojeSP = (): string => diaEmSP(new Date());

// O dia de Brasília de um timestamp do banco (o `respondido_em` do NPS).
export const diaSP = (instante: string): string => diaEmSP(new Date(instante));

// Um instante do banco em horário de Brasília, "DD/MM/AAAA, HH:MM" (fmtInstante, index.html:3125).
// Sem valor, inválido ou do epoch para trás: "—", e o dado nulo não vira 31/12/1969.
export function fmtInstante(valor: string | null | undefined): string {
  const instante = valor ? new Date(valor) : null;
  if (!instante || Number.isNaN(instante.getTime()) || instante.getTime() <= 0) return "—";
  return instante.toLocaleString("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "short" });
}

// "AAAA-MM-DD" vira "DD/MM/AAAA"; sem data, "—".
export const fmtD = (data: string | null | undefined): string => (data ? data.split("-").reverse().join("/") : "—");

// Rótulo de um campo de data: o dia como fmtD; no modo mês ("AAAA-MM"), "Ago/2026".
export function dpLabel(valor: string | null | undefined, modo: "day" | "month" = "day"): string {
  if (!valor) return "";
  if (modo === "day") return fmtD(valor);
  const [ano, mes] = valor.split("-");
  return `${MESES_PT[Number(mes) - 1]}/${ano}`;
}

// O mês "AAAA-MM" de uma data; sem data, "".
export const mesDe = (data: string | null | undefined): string => (data ?? "").slice(0, 7);

// Dias de hoje até a data, em dia de calendário: a diferença em milissegundos erraria por uma
// hora no fim do horário de verão. Sem data, null.
export function diasAte(data: string | null | undefined): number | null {
  if (!data) return null;
  const [a1, m1, d1] = hojeSP().split("-").map(Number);
  const [a2, m2, d2] = data.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / DIA_MS);
}

export function prazoTexto(data: string | null | undefined): string {
  const dias = diasAte(data);
  if (dias === null) return "";
  if (dias < -1) return `venceu há ${-dias} dias`;
  if (dias === -1) return "venceu ontem";
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias`;
}

// A segunda-feira da semana do dia "AAAA-MM-DD": a semana do NPS vai de segunda a domingo. A
// conta é de calendário, em UTC ao meio-dia, sobre um dia que já está no fuso de Brasília.
export function segundaDe(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
