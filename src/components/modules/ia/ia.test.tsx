import type { ComponentProps, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, UI_INICIAL, type Ui, UiContexto } from "@/components/shell/contexto";
import type { Dataset, Relacao } from "@/lib/data/esquemas";
import type { Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Ia from "./ia";

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
const tela = (opcoes: Parameters<typeof render>[1] = {}) => render(<Ia />, opcoes);
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
const ESCAPADO = "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;";

// O recorte do mentor: a rpc devolve a análise sem `resumo` e sem `mentores`; o NPS que o mentor
// não lê vem vazio. O teste deixa o NPS no dataset para provar que a tela não o mostra.
function dadosDoMentor(): Dataset {
  const d = datasetDeTeste();
  if (!d.analise) throw new Error("o fixture não traz análise");
  const { resumo: _resumo, mentores: _mentores, ...recorte } = d.analise;
  return { ...d, analise: recorte };
}

beforeEach(() => {
  mudancas.length = 0;
  recargas.n = 0;
});

describe("tela Análise IA, admin e diretoria (GER-05, GER-06, DATA-07)", () => {
  it("a visão geral traz o resumo e os alertas por severidade, com o texto do modelo escapado, e as três abas", () => {
    const { html, vistos: v } = tela();
    const t = texto(html);
    expect(t).toContain("Resumo Resumo");
    expect(html).toContain(`Resumo ${ESCAPADO}`);
    expect(t).toContain("Alertas · 1");
    expect(t).toContain("Alta Nota caiu");
    expect(t).toContain("mentorado · Mentor: Luan · Mentorado: Ana");
    expect(t).toContain("Evidência: &quot;citação&quot;");
    expect(t).toContain("Ação sugerida: Ligar hoje");
    expect(html).not.toContain("<img src=x");
    expect((props(v, "abas").items as Array<{ value: string }>).map((i) => i.value)).toEqual(["geral", "mentores", "mentorados"]);
    // 11h em UTC é 8h em Brasília.
    expect(t).toContain("08/10/2026, 08:00 · 6 resposta(s) lidas · claude-opus-5-5");
    expect(t).not.toContain("Visão dos mentores");
  });

  it("trocar de aba grava a aba e limpa a pessoa aberta, guardando o resto do filtro", () => {
    const { vistos: v } = tela({ estado: filtro({ iaAba: "mentorados", iaSel: "mentorado:m1", qNps: "ana" }) });
    chamar(props(v, "abas").onChange, "mentores");
    expect(mudancas.at(-1)).toEqual(filtro({ iaAba: "mentores", iaSel: "", qNps: "ana" }));
  });

  it("GER-06: Por mentor lê o formato antigo nos blocos de prós e contras, com a média e o NPS do NPS carregado", () => {
    const { html } = tela({ estado: filtro({ iaAba: "mentores" }) });
    // Diovani: notas 10, 8 e 9 no NPS carregado: média 9,0, NPS +67; um pró e um contra.
    expect(texto(html)).toContain("Mentores · 1");
    expect(texto(html)).toMatch(/Diovani 9,0 \+67 1 1/);
    const aberto = tela({ estado: filtro({ iaAba: "mentores", iaSel: "mentor:Diovani" }) });
    const t = texto(aberto.html);
    expect(t).toContain("Mentor · média 9,0 · NPS +67 · 3 resposta(s)");
    expect(t).toContain("Prós 1 Prático");
    expect(aberto.html).toContain(`Atrasa ${ESCAPADO}`);
    expect(aberto.html).toContain(`Leitura ${ESCAPADO}`);
    expect(t).toContain("Respostas de NPS · 3");
    expect(aberto.html).not.toContain("<img src=x");
  });

  it("Por mentorado vem do risco mais alto ao mais baixo, com a contagem por risco e a última nota do NPS carregado", () => {
    const { html } = tela({ estado: filtro({ iaAba: "mentorados" }) });
    const t = texto(html);
    expect(t).toContain("Mentorados · 3 · risco alto 1 · médio 1 · baixo 1");
    expect(t.indexOf("Ana Clara")).toBeLessThan(t.indexOf("Fulano"));
    expect(t.indexOf("Fulano")).toBeLessThan(t.indexOf("Outro"));
    // Ana (ficha m1): n1, nota 10. Fulano (sem ficha): n3, nota 5, achada pelo nome informado. Outro: nenhuma.
    expect(t).toContain("Ana Clara Diovani 10 (1) Alto 1 1");
    expect(t).toContain("Fulano Petare 5 (1) Médio 0 0");
    expect(t).toContain(`Outro ${ESCAPADO} Luan — Baixo 0 0`);
  });

  it("a pessoa aberta traz o nome ligado à ficha, o risco, o próximo passo, prós, contras, pauta e as respostas de NPS dela", () => {
    const { html } = tela({ estado: filtro({ iaAba: "mentorados", iaSel: "mentorado:m1" }) });
    const t = texto(html);
    expect(html).toContain('href="/mentorado/m1"');
    expect(t).toContain("Mentorado · mentor Diovani · risco Alto");
    expect(t).toContain("Próximo passo: CS hoje");
    expect(t).toContain("Prós 1 Vendeu na feira");
    expect(t).toContain("Pauta para a conversa");
    expect(html).toContain(`O que travou? ${ESCAPADO}`);
    expect(t).toContain("Respostas de NPS · 1");
    expect(t).toContain("13/09/2026, 22:00");
    expect(html).not.toContain("<img src=x");
  });

  it("GER-06: os `sinais` do formato antigo aparecem sob a leitura e nunca como contra", () => {
    const { html } = tela({ estado: filtro({ iaAba: "mentorados", iaSel: "mentorado:nome:Fulano" }) });
    const t = texto(html);
    expect(t).toContain("Sinais: Nota 5");
    expect(t).toContain("Contras 0 Nada nos dados desta rodada.");
    expect(t).toContain("Respostas de NPS · 1");
    // Sem ficha, o nome é só texto.
    expect(html).not.toMatch(/<a [^>]*>Fulano/);
  });

  it("o clique no nome abre a pessoa e o Voltar fecha, pela chave da lista", () => {
    const lista = tela({ estado: filtro({ iaAba: "mentorados" }) });
    chamar(props(lista.vistos, "button", (p) => p.children === "Ana Clara").onClick);
    expect(mudancas.at(-1)).toEqual(filtro({ iaAba: "mentorados", iaSel: "mentorado:m1" }));
    chamar(props(lista.vistos, "button", (p) => p.children === "Fulano").onClick);
    expect(mudancas.at(-1)).toEqual(filtro({ iaAba: "mentorados", iaSel: "mentorado:nome:Fulano" }));
    const aberta = tela({ estado: filtro({ iaAba: "mentorados", iaSel: "mentorado:m1" }) });
    chamar(props(aberta.vistos, "button", (p) => String(p.children).includes("Voltar")).onClick);
    expect(mudancas.at(-1)).toEqual(filtro({ iaAba: "mentorados", iaSel: "" }));
    const mentores = tela({ estado: filtro({ iaAba: "mentores" }) });
    chamar(props(mentores.vistos, "button", (p) => p.children === "Diovani").onClick);
    expect(mudancas.at(-1)).toEqual(filtro({ iaAba: "mentores", iaSel: "mentor:Diovani" }));
  });

  it("uma seleção que não existe mais cai na lista, e sem leitura a aba diz isso", () => {
    expect(texto(tela({ estado: filtro({ iaAba: "mentorados", iaSel: "mentorado:sumiu" }) }).html)).toContain("Mentorados · 3");
    const d = datasetDeTeste();
    if (!d.analise) throw new Error("sem análise");
    const vazio = { ...d, analise: { ...d.analise, mentores: [], mentorados: [], alertas: [] } };
    expect(texto(tela({ dados: vazio, estado: filtro({ iaAba: "mentores" }) }).html)).toContain("Sem leitura por mentor nesta rodada.");
    expect(texto(tela({ dados: vazio, estado: filtro({ iaAba: "mentorados" }) }).html)).toContain("Sem leitura por mentorado nesta rodada.");
    expect(texto(tela({ dados: vazio }).html)).toContain("Nenhum alerta nesta rodada.");
  });

  it("sem análise a tela diz que o analista roda às 8h", () => {
    expect(texto(tela({ dados: { ...datasetDeTeste(), analise: null } }).html)).toContain("Nenhuma análise ainda. O analista roda todo dia às 8h");
  });

  it("DATA-07: a falha de R19 troca a tela por um EmptyState com Tentar de novo; a de R21 não é do admin", async () => {
    const { html, vistos: v } = tela({ erros: { nps_analises: "permission denied" } });
    expect(texto(html)).toContain("Não foi possível carregar esta tela nps_analises: permission denied");
    expect(html).not.toContain("Alertas ·");
    await chamar(props(v, "button", (p) => p.children === "Tentar de novo").onClick);
    expect(recargas.n).toBe(1);
    expect(texto(tela({ erros: { analise_ia_mentor: "boom" } }).html)).toContain("Alertas · 1");
  });

  it("DATA-07: a falha de R17 (as médias) é um aviso e o resto renderiza; a de R18 não afeta esta tela", () => {
    const r17 = tela({ erros: { nps_respostas: "timeout" }, estado: filtro({ iaAba: "mentores" }) });
    expect(texto(r17.html)).toContain("Parte dos dados não carregou nps_respostas: timeout");
    expect(texto(r17.html)).toContain("Mentores · 1");
    const r18 = tela({ erros: { experiencia_respostas: "boom" } });
    expect(texto(r18.html)).toContain("Alertas · 1");
    expect(r18.html).not.toContain("não carregou");
    expect(r18.html).not.toContain("Não foi possível");
  });

  it("a diretoria lê o mesmo que o admin, e a tela não escreve nada", () => {
    const admin = tela({ papel: "admin" }).html;
    expect(texto(tela({ papel: "diretoria" }).html)).toBe(texto(admin));
    expect(admin).not.toContain("data-escrita");
  });
});

describe("tela Análise IA, o recorte do mentor (GER-05, AD-005)", () => {
  it("lê a análise do recorte (R21): sem resumo, sem a aba Por mentor, com o aviso do recorte", () => {
    const { html, vistos: v } = tela({ papel: "mentor", dados: dadosDoMentor() });
    const t = texto(html);
    expect(t).toContain("Alertas · 1");
    expect(t).not.toContain("Resumo");
    expect((props(v, "abas").items as Array<{ value: string }>).map((i) => i.value)).toEqual(["geral", "mentorados"]);
    expect(t).not.toContain("Por mentor ");
    expect(t).toContain("Visão dos mentores: alertas sobre mentorados e sobre a mentoria, e a leitura de cada mentorado.");
  });

  it("quem chegou com a aba Por mentor escolhida cai na visão geral, mesmo com a leitura por mentor no dado", () => {
    const { html } = tela({ papel: "mentor", dados: { ...dadosDoMentor(), analise: { ...datasetDeTeste().analise!, resumo: "Resumo vazado", mentores: datasetDeTeste().analise!.mentores } }, estado: filtro({ iaAba: "mentores" }) });
    const t = texto(html);
    expect(t).toContain("Alertas · 1");
    expect(t).not.toContain("Mentores · ");
    expect(t).not.toContain("Diovani 9,0");
  });

  it("a pessoa aberta não traz as respostas de NPS, que o admin vê na mesma pessoa", () => {
    const estado = filtro({ iaAba: "mentorados", iaSel: "mentorado:m1" });
    const doMentor = tela({ papel: "mentor", dados: dadosDoMentor(), estado });
    expect(texto(doMentor.html)).toContain("Prós 1 Vendeu na feira");
    expect(texto(doMentor.html)).not.toContain("Respostas de NPS");
    expect(doMentor.html).not.toContain("Ótima");
    expect(texto(tela({ estado }).html)).toContain("Respostas de NPS · 1");
  });

  it("DATA-07: a falha de R21 troca a tela; a de R19 não é do mentor", () => {
    expect(texto(tela({ papel: "mentor", dados: dadosDoMentor(), erros: { analise_ia_mentor: "boom" } }).html)).toContain("Não foi possível carregar esta tela analise_ia_mentor: boom");
    expect(texto(tela({ papel: "mentor", dados: dadosDoMentor(), erros: { nps_analises: "boom" } }).html)).toContain("Alertas · 1");
    // E o NPS que o mentor não lê não vira aviso.
    expect(tela({ papel: "mentor", dados: dadosDoMentor(), erros: { nps_respostas: "boom" } }).html).not.toContain("não carregou");
  });
});
