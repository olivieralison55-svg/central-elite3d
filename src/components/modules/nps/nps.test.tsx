import type { ComponentProps, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, UI_INICIAL, type Ui, UiContexto } from "@/components/shell/contexto";
import type { Dataset, NpsResposta, Relacao } from "@/lib/data/esquemas";
import type { Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Nps from "./nps";

// Os primitivos que o teste aciona anotam as props e desenham o de verdade.
const vistos = vi.hoisted(() => [] as Array<{ tipo: string; props: Record<string, unknown> }>);
const gravar = vi.hoisted(() => (tipo: string, props: object) => vistos.push({ tipo, props: { ...props } as Record<string, unknown> }));
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("button", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/tabs", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/tabs")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("abas", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/segmented-control", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/segmented-control")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("periodo", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/select", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/select")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("mentor", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/pagination", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/pagination")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("pagina", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/search-input", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/search-input")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("busca", props), createElement(original.default, props)) };
});

let ui: Ui;
const mudancas: Array<Partial<Ui>> = [];
const recargas = vi.hoisted(() => ({ n: 0 }));

const filtro = (parcial: Partial<Ui["filtro"]>): Partial<Ui> => ({ filtro: { ...UI_INICIAL.filtro, ...parcial } });

function render(el: ReactElement, { papel = "admin", dados = datasetDeTeste(), erros = {}, estado }: { papel?: Papel; dados?: Dataset; erros?: Partial<Record<Relacao, string>>; estado?: Partial<Ui> } = {}) {
  vistos.length = 0;
  ui = { ...UI_INICIAL, ...estado };
  const mudar = (parcial: Partial<Ui>) => {
    mudancas.push(parcial);
    ui = { ...ui, ...parcial };
  };
  const html = renderTela(
    <DadosContexto.Provider value={{ dados, erros, recarregando: false, recarregar: async () => void (recargas.n += 1) }}>
      <UiContexto.Provider value={{ ui, mudar }}>{el}</UiContexto.Provider>
    </DadosContexto.Provider>,
    { papel, dados },
  );
  return { html, vistos: [...vistos] };
}
const tela = (opcoes: Parameters<typeof render>[1] = {}) => render(<Nps />, opcoes);
type Vistos = ReturnType<typeof tela>["vistos"];
const props = (v: Vistos, tipo: string, onde: (p: Record<string, unknown>) => boolean = () => true) => {
  const achado = v.find((x) => x.tipo === tipo && onde(x.props));
  if (!achado) throw new Error(`${tipo} ausente`);
  return achado.props;
};
const chamar = (fn: unknown, ...args: unknown[]) => {
  if (typeof fn !== "function") throw new Error("handler ausente");
  return fn(...args);
};
const texto = (html: string) => html.replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, " ").replace(/\s+/g, " ");
const painel = (html: string, titulo: string) => {
  const inicio = html.indexOf(titulo);
  expect(inicio, titulo).toBeGreaterThan(-1);
  const fim = html.indexOf("</table>", inicio);
  return fim < 0 ? html.slice(inicio) : html.slice(inicio, fim + "</table>".length);
};

// 25 respostas, uma em cada semana (segundas de 2026), para provar as duas paginações.
const muitas = (n: number): NpsResposta[] =>
  Array.from({ length: n }, (_, i) => ({
    ...datasetDeTeste().nps[0],
    id: `x${i}`,
    mentor: "Diovani",
    nota: 8,
    respondido_em: new Date(Date.UTC(2026, 0, 5 + 7 * i, 15)).toISOString(),
    mentorado_id: null,
    nome_informado: `Resp ${i}`,
    comentario: null,
  }));

beforeEach(() => {
  mudancas.length = 0;
  recargas.n = 0;
});

describe("tela NPS, aba das sessões (GER-02, GER-03, GER-04, DATA-07)", () => {
  it("GER-02: os cards são o geral e um por mentor, com média de 1 casa, NPS com sinal e a contagem", () => {
    const t = texto(tela().html);
    // 10, 8, 5 e 9: média 8,0; dois promotores e um detrator em quatro: NPS +25.
    expect(t).toContain("Média geral 8,0 NPS +25 · 4 resposta(s)");
    expect(t).toContain("Diovani 9,0 NPS +67 · 3 resposta(s)");
    expect(t).toMatch(/Petare[^|]*? 5,0 NPS -100 · 1 resposta\(s\)/);
  });

  it("GER-02: a tabela por semana conta o domingo das 22h em Brasília na semana que terminou nele", () => {
    const { html } = tela();
    const tabela = texto(painel(html, "Média por semana"));
    // n1 (10, domingo 13/09 às 22h) fica sozinha em 07/09 a 13/09; n2 e n3 em 14/09 a 20/09; n4 em agosto.
    expect(tabela).toContain("07/09 a 13/09 1 10,0 +100");
    expect(tabela).toContain("14/09 a 20/09 2 6,5 -50");
    expect(tabela).toContain("17/08 a 23/08 1 9,0 +100");
    expect(tabela.indexOf("14/09 a 20/09")).toBeLessThan(tabela.indexOf("07/09 a 13/09"));
    // A coluna de cada mentor: média e quantas respostas a formam; sem resposta, o traço.
    expect(tabela).toContain("14/09 a 20/09 2 6,5 -50 8,0 (1) 5,0 (1)");
    expect(tabela).toContain("07/09 a 13/09 1 10,0 +100 10,0 (1) —");
  });

  it("o período Mês junta as semanas pelo mês de Brasília e muda o título", () => {
    const t = texto(tela({ estado: filtro({ npsPeriodo: "mes" }) }).html);
    expect(t).toContain("Média por mês");
    expect(t).toContain("setembro de 2026 3 7,7 0 9,0 (2) 5,0 (1)");
    expect(t).toContain("agosto de 2026 1 9,0 +100 9,0 (1) —");
  });

  it("GER-03: a paginação só aparece com mais de uma página, 10 períodos e 20 respostas por página", () => {
    const poucas = tela().vistos.filter((x) => x.tipo === "pagina");
    expect(poucas).toEqual([]);
    const dados = { ...datasetDeTeste(), nps: muitas(25) };
    const { html, vistos: v } = tela({ dados });
    const periodos = props(v, "pagina", (p) => p.label === "Paginação dos períodos");
    const respostas = props(v, "pagina", (p) => p.label === "Paginação das respostas");
    expect([periodos.page, periodos.pageCount, respostas.page, respostas.pageCount]).toEqual([1, 3, 1, 2]);
    expect(texto(html)).toContain("Respostas · 25");
    // Página 1 das respostas: as 20 mais recentes (Resp 24 a Resp 5), nunca Resp 4.
    expect(html).toContain("Resp 24");
    expect(html).toContain("Resp 5<");
    expect(html).not.toContain("Resp 4<");
    const p2 = tela({ dados, estado: filtro({ npsPagResp: 2, npsPagPeriodo: 3 }) });
    expect(props(p2.vistos, "pagina", (p) => p.label === "Paginação das respostas").page).toBe(2);
    expect(p2.html).toContain("Resp 4<");
    expect(p2.html).not.toContain("Resp 24");
  });

  it("a página pedida é presa ao que existe: um filtro que encolhe a lista não deixa a tela vazia", () => {
    const dados = { ...datasetDeTeste(), nps: muitas(25) };
    const { vistos: v } = tela({ dados, estado: filtro({ npsPagResp: 9, npsPagPeriodo: 9 }) });
    expect(props(v, "pagina", (p) => p.label === "Paginação das respostas").page).toBe(2);
    expect(props(v, "pagina", (p) => p.label === "Paginação dos períodos").page).toBe(3);
  });

  it("GER-03: trocar a aba ou o período volta as duas paginações para 1, e guarda o resto do filtro", () => {
    const estado = filtro({ npsPagPeriodo: 3, npsPagResp: 2, npsMentor: "Diovani", qNps: "ana" });
    const { vistos: v } = tela({ dados: { ...datasetDeTeste(), nps: muitas(25) }, estado });
    chamar(props(v, "abas").onChange, "experiencia");
    expect(mudancas.at(-1)).toEqual(filtro({ npsPagPeriodo: 1, npsPagResp: 1, npsAba: "experiencia", npsMentor: "Diovani", qNps: "ana" }));
    chamar(props(v, "periodo").onChange, "Mês");
    expect(mudancas.at(-1)).toEqual(filtro({ npsPagPeriodo: 1, npsPagResp: 1, npsPeriodo: "mes", npsMentor: "Diovani", qNps: "ana" }));
    chamar(props(v, "periodo").onChange, "Semana");
    expect(mudancas.at(-1)).toEqual(filtro({ npsPagPeriodo: 1, npsPagResp: 1, npsPeriodo: "semana", npsMentor: "Diovani", qNps: "ana" }));
  });

  it("GER-04: trocar o mentor volta só as respostas; a página dos períodos fica onde estava", () => {
    const estado = filtro({ npsPagPeriodo: 3, npsPagResp: 2 });
    const { vistos: v } = tela({ dados: { ...datasetDeTeste(), nps: muitas(25) }, estado });
    chamar(props(v, "mentor").onChange, "Diovani");
    expect(mudancas.at(-1)).toEqual(filtro({ npsPagPeriodo: 3, npsPagResp: 1, npsMentor: "Diovani" }));
    // O menu oferece "Todos" e cada mentor, e o Todos limpa o filtro.
    expect((props(v, "mentor").options as Array<{ value: string }>).map((o) => o.value)).toEqual(["", "Diovani"]);
    chamar(props(v, "mentor").onChange, "");
    expect(mudancas.at(-1)).toEqual(filtro({ npsPagPeriodo: 3, npsPagResp: 1, npsMentor: "" }));
  });

  it("cada paginação muda só a sua página, e a busca grava qNps", () => {
    const { vistos: v } = tela({ dados: { ...datasetDeTeste(), nps: muitas(25) } });
    chamar(props(v, "pagina", (p) => p.label === "Paginação dos períodos").onChange, 2);
    expect(mudancas.at(-1)).toEqual(filtro({ npsPagPeriodo: 2 }));
    chamar(props(v, "pagina", (p) => p.label === "Paginação das respostas").onChange, 2);
    expect(mudancas.at(-1)).toEqual(filtro({ npsPagResp: 2 }));
    chamar(props(v, "busca").onChange, { target: { value: "zé" } });
    expect(mudancas.at(-1)).toEqual(filtro({ qNps: "zé" }));
  });

  it("o filtro de mentor recorta as respostas e a busca; o selo diz o termo sobre as respostas do mentor", () => {
    const t = texto(tela({ estado: filtro({ npsMentor: "Diovani", qNps: "zé" }) }).html);
    expect(t).toContain("Respostas · 1");
    expect(t).toContain("Busca: “zé” · 1 de 3 resposta(s)");
    const sem = tela({ estado: filtro({ npsMentor: "Diovani" }) }).html;
    expect(texto(sem)).toContain("Respostas · 3");
    expect(sem).not.toContain("Fulano");
  });

  it("o nome com ficha leva à ficha, o sem ficha é texto, e tudo que vem do banco é escapado", () => {
    const { html } = tela();
    const respostas = painel(html, "Respostas ·");
    expect(respostas).toContain('href="/mentorado/m1"');
    expect(respostas).toContain("Ana Clara");
    expect(respostas).toContain("Zé &quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(respostas).toContain("Ótima &quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(respostas).toContain("Petare &quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it("as perguntas novas aparecem com a cor da resposta e o apoio; as respostas antigas, sem elas", () => {
    const dados = datasetDeTeste();
    dados.nps = [{ ...dados.nps[0], clareza: "Sim", direcionamento: "Parcialmente", apoio: "Marketing\ndigital" }, dados.nps[1]];
    const { html } = tela({ dados });
    expect(html).toContain("Clareza dos próximos passos");
    expect(html).toMatch(/Clareza dos próximos passos[\s\S]*?bg-success-soft[^>]*>Sim</);
    expect(html).toMatch(/Direcionamento adequado[\s\S]*?bg-warning-soft[^>]*>Parcialmente</);
    expect(html).toContain("Quer mais apoio em: Marketing\ndigital");
    expect(html.match(/Clareza dos próximos passos/g)).toHaveLength(1);
  });

  it("sem resposta de NPS a aba diz que não há nenhuma", () => {
    const t = texto(tela({ dados: { ...datasetDeTeste(), nps: [] } }).html);
    expect(t).toContain("Nenhuma resposta de NPS ainda.");
    expect(t).not.toContain("Média geral");
  });

  it("DATA-07: a falha de R17 troca só a aba das sessões por um EmptyState com Tentar de novo, que recarrega; o título e as abas ficam", async () => {
    const { html, vistos: v } = tela({ erros: { nps_respostas: "permission denied" } });
    expect(texto(html)).toContain("Não foi possível carregar esta tela nps_respostas: permission denied");
    expect(html).not.toContain("Média geral");
    expect(texto(html)).toContain("NPS das sessões");
    await chamar(props(v, "button", (p) => p.children === "Tentar de novo").onClick);
    expect(recargas.n).toBe(1);
  });

  it("a diretoria lê o mesmo que o admin, e a tela não escreve nada", () => {
    const admin = tela({ papel: "admin" }).html;
    expect(texto(tela({ papel: "diretoria" }).html)).toBe(texto(admin));
    expect(admin).not.toContain("data-escrita");
  });
});

describe("tela NPS, aba da Pesquisa de Experiência (GER-02, DATA-07)", () => {
  const exp = { estado: filtro({ npsAba: "experiencia" }) };

  it("mostra o NPS da mentoria, o índice, a clareza e os itens da grade, o pior primeiro", () => {
    const { html } = tela(exp);
    const t = texto(html);
    expect(t).toContain("NPS da mentoria 0 2 resposta(s) · média 7,5");
    expect(t).toContain("Índice de experiência 50 média da grade, 0 a 100");
    expect(t).toContain("Clareza dos próximos passos 50% Sim 1 · Parcial 0 · Não 1");
    const itens = texto(painel(html, "Item da grade"));
    expect(itens).toContain("Organização dos agendamentos 13 2");
    expect(itens).toContain("Qualidade das sessões 88 2");
    expect(itens.indexOf("Organização")).toBeLessThan(itens.indexOf("Qualidade"));
    expect(html).toMatch(/bg-danger-soft[^>]*>13</);
    expect(html).toMatch(/bg-success-soft[^>]*>88</);
  });

  it("as respostas abertas ficam em <details>, com a pergunta e o texto escapado", () => {
    const { html } = tela(exp);
    expect(html).toContain("<details");
    expect(html).toContain("O que mais gera valor?");
    expect(html).toContain("Sessões &quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(texto(html)).toContain("nota 10 · Muito Satisfeito · clareza: Sim");
  });

  it("DATA-07: a falha de R18 troca só esta aba; e a falha de R17 não a afeta", () => {
    const quebrada = tela({ ...exp, erros: { experiencia_respostas: "boom" } });
    expect(texto(quebrada.html)).toContain("Não foi possível carregar esta tela experiencia_respostas: boom");
    expect(quebrada.html).not.toContain("NPS da mentoria");
    // A aba das sessões segue de pé com a falha de R18.
    const sessoes = tela({ erros: { experiencia_respostas: "boom" } });
    expect(texto(sessoes.html)).toContain("Média geral 8,0");
    expect(sessoes.html).not.toContain("não foi possível");
    // E a falha de R17 não derruba a Experiência.
    expect(texto(tela({ ...exp, erros: { nps_respostas: "boom" } }).html)).toContain("NPS da mentoria 0");
  });

  it("sem resposta de Experiência a aba diz que não há nenhuma", () => {
    expect(texto(tela({ ...exp, dados: { ...datasetDeTeste(), experiencia: [] } }).html)).toContain("Nenhuma resposta ainda.");
  });
});
