import type { Analise, NpsResposta } from "./data/esquemas";
import { mediaNps, scoreNps } from "./nps";

// Análise IA do index.html (:2766–2918; mapeamento §3.10). É a leitura do nps-analista (Claude)
// sobre as duas pesquisas: o risco, o texto e os alertas vêm do modelo; as médias e o NPS, do NPS
// carregado, nunca do modelo. As regras daqui servem aos três papéis.

export type Alerta = Analise["alertas"][number];
export type LeituraMentor = NonNullable<Analise["mentores"]>[number];
export type LeituraMentorado = Analise["mentorados"][number];

// O que o modelo não mandou (ou mandou fora de lista) é lista vazia (`lista_`).
export const listaDe = <T>(valor: readonly T[] | null | undefined): readonly T[] => (Array.isArray(valor) ? valor : []);

// GER-06: o formato antigo (`pontos_fortes`, `pontos_de_atencao`) cai nos mesmos blocos de `pros` e
// `contras`. O formato novo vence quando existe, mesmo vazio. `sinais` é evidência neutra (boa ou
// ruim) e aparece sob a leitura, nunca como contra.
export const prosDe = (l: Pick<LeituraMentor, "pros" | "pontos_fortes">): readonly string[] => listaDe(l.pros ?? l.pontos_fortes);
export const contrasDe = (l: Pick<LeituraMentor, "contras" | "pontos_de_atencao">): readonly string[] => listaDe(l.contras ?? l.pontos_de_atencao);
export const sinaisDe = (l: { sinais?: readonly string[] }): readonly string[] => listaDe(l.sinais);
export const pautaDe = (l: { pauta?: readonly string[] }): readonly string[] => listaDe(l.pauta);

export type Tom = "success" | "warning" | "danger";

// Severidade do alerta e risco do mentorado: rótulo, cor e posição na ordem. Valor desconhecido
// mostra o texto cru, em âmbar, depois dos conhecidos.
const SEVERIDADE: ReadonlyMap<string, [Tom, string, number]> = new Map([
  ["alta", ["danger", "Alta", 0]],
  ["media", ["warning", "Média", 1]],
  ["baixa", ["success", "Baixa", 2]],
]);
const RISCO: ReadonlyMap<string, [Tom, string, number]> = new Map([
  ["alto", ["danger", "Alto", 0]],
  ["medio", ["warning", "Médio", 1]],
  ["baixo", ["success", "Baixo", 2]],
]);
const DESCONHECIDO = 3;

export const severidadeDe = (severidade: string): { tom: Tom; rotulo: string } => {
  const [tom, rotulo] = SEVERIDADE.get(severidade) ?? ["warning", severidade];
  return { tom, rotulo };
};
export const riscoDe = (risco: string): { tom: Tom; rotulo: string } => {
  const [tom, rotulo] = RISCO.get(risco) ?? ["warning", risco];
  return { tom, rotulo };
};

// Os alertas, do mais grave ao menos; a ordem do modelo desempata, e a severidade que não
// conhecemos vai para o fim.
export const alertasPorSeveridade = (alertas: readonly Alerta[]): Alerta[] =>
  [...listaDe(alertas)].sort((a, b) => (SEVERIDADE.get(a.severidade)?.[2] ?? DESCONHECIDO) - (SEVERIDADE.get(b.severidade)?.[2] ?? DESCONHECIDO));

const porNome = (a: string, b: string) => String(a).localeCompare(String(b), "pt-BR");

// Por mentor: em ordem alfabética do português.
export const leiturasPorMentor = (analise: Pick<Analise, "mentores">): LeituraMentor[] => [...listaDe(analise.mentores)].sort((a, b) => porNome(a.mentor, b.mentor));

// Por mentorado: o risco mais alto primeiro (alto, médio, baixo, o resto), e o nome desempata.
export const leiturasPorMentorado = (analise: Pick<Analise, "mentorados">): LeituraMentorado[] =>
  [...listaDe(analise.mentorados)].sort((a, b) => (RISCO.get(a.risco)?.[2] ?? DESCONHECIDO) - (RISCO.get(b.risco)?.[2] ?? DESCONHECIDO) || porNome(a.mentorado, b.mentorado));

// "risco alto N · médio N · baixo N" do título da lista.
export const contagemRisco = (leituras: readonly LeituraMentorado[]) => ({
  alto: leituras.filter((l) => l.risco === "alto").length,
  medio: leituras.filter((l) => l.risco === "medio").length,
  baixo: leituras.filter((l) => l.risco === "baixo").length,
});

// A chave de seleção de uma leitura de mentorado: o id da ficha ou, sem ele, o nome. Os prefixos
// são os do `filtro.iaSel`.
export const chaveMentorado = (l: Pick<LeituraMentorado, "mentorado_id" | "mentorado">): string => l.mentorado_id || `nome:${l.mentorado}`;
export const chaveSelecaoMentor = (mentor: string): string => `mentor:${mentor}`;
export const chaveSelecaoMentorado = (l: Pick<LeituraMentorado, "mentorado_id" | "mentorado">): string => `mentorado:${chaveMentorado(l)}`;

const maisRecentesPrimeiro = (respostas: NpsResposta[]): NpsResposta[] => respostas.sort((a, b) => String(b.respondido_em).localeCompare(String(a.respondido_em)));

// As respostas de NPS de um mentorado da análise, da mais recente para a mais antiga. Com ficha
// vale o id; sem ela, só as respostas sem ficha com o mesmo nome informado.
export const npsDoMentorado = (nps: readonly NpsResposta[], l: Pick<LeituraMentorado, "mentorado_id" | "mentorado">): NpsResposta[] =>
  maisRecentesPrimeiro(nps.filter((r) => (l.mentorado_id ? r.mentorado_id === l.mentorado_id : !r.mentorado_id && (r.nome_informado || "") === l.mentorado)));

export const npsDoMentor = (nps: readonly NpsResposta[], mentor: string): NpsResposta[] => maisRecentesPrimeiro(nps.filter((r) => r.mentor === mentor));

// A média, o NPS e a contagem de um mentor, do NPS carregado (nunca do modelo).
export function numerosDoMentor(nps: readonly NpsResposta[], mentor: string): { media: number | null; nps: number | null; respostas: number } {
  const dele = nps.filter((r) => r.mentor === mentor);
  return { media: mediaNps(dele), nps: scoreNps(dele), respostas: dele.length };
}

export type AbaIa = "geral" | "mentores" | "mentorados";

// AD-005 e GER-05: sem a visão completa (o mentor), a aba Por mentor não existe, e quem chega com
// ela escolhida cai na visão geral.
export const abaIaEfetiva = (aba: string, completa: boolean): AbaIa => (aba === "mentores" ? (completa ? "mentores" : "geral") : aba === "mentorados" ? "mentorados" : "geral");

export const abasIa = (completa: boolean): readonly { value: AbaIa; label: string }[] => [
  { value: "geral", label: "Visão geral" },
  ...(completa ? [{ value: "mentores" as const, label: "Por mentor" }] : []),
  { value: "mentorados", label: "Por mentorado" },
];
