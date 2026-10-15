import type { ComponentProps, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, UI_INICIAL, type Ui, UiContexto } from "@/components/shell/contexto";
import type { Dataset, Relacao } from "@/lib/data/esquemas";
import { fmtBRL } from "@/lib/moeda";
import type { Papel } from "@/lib/papeis";
import { datasetDeTeste, XSS } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Stlseller from "./stlseller";

// Sem DOM, o setState que chega depois do render no servidor não muda nada: o falso guarda o
// estado das duas primeiras chamadas (o recorte de status e o chip, os únicos da tela) entre
// renders. Os useState dos primitivos (o DataTable) voltam ao inicial a cada render.
const estado = vi.hoisted(() => ({ valores: [] as unknown[], proximo: 0 }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (inicial: unknown) => {
      const i = estado.proximo++;
      const valorInicial = typeof inicial === "function" ? (inicial as () => unknown)() : inicial;
      if (i >= 2) return [valorInicial, () => undefined];
      if (!(i in estado.valores)) estado.valores[i] = valorInicial;
      return [estado.valores[i], (valor: unknown) => void (estado.valores[i] = valor)];
    },
  };
});

const vistos = vi.hoisted(() => [] as Array<{ tipo: string; props: Record<string, unknown> }>);
const gravar = vi.hoisted(() => (tipo: string, props: object) => vistos.push({ tipo, props: { ...props } as Record<string, unknown> }));
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("button", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/search-input", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/search-input")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("busca", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/sort-header", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/sort-header")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("ordem", props), createElement(original.default, props)) };
});

let ui: Ui;
const mudancas: Array<Partial<Ui>> = [];
const recargas = vi.hoisted(() => ({ n: 0 }));

function render(el: ReactElement, { papel = "admin", dados = datasetDeTeste(), erros = {} }: { papel?: Papel; dados?: Dataset; erros?: Partial<Record<Relacao, string>> } = {}) {
  estado.proximo = 0;
  vistos.length = 0;
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
const tela = (opcoes: Parameters<typeof render>[1] = {}) => render(<Stlseller />, opcoes);
const chamar = (fn: unknown, ...args: unknown[]) => {
  if (typeof fn !== "function") throw new Error("handler ausente");
  return fn(...args);
};
const botao = (lista: ReturnType<typeof tela>["vistos"], inicio: string) => {
  const achado = lista.find((v) => v.tipo === "button" && String(v.props.children).startsWith(inicio));
  if (!achado) throw new Error(`botão ${inicio} ausente`);
  return achado.props;
};
// O texto do HTML, sem tags; o espaço fixo da moeda vira espaço comum (`brl` faz o mesmo no esperado).
const texto = (html: string) => html.replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, " ").replace(/\s+/g, " ");
const brl = (v: number) => fmtBRL(v).replace(/\s/g, " ");
// O HTML de um painel: do título até o fim da primeira tabela depois dele (ou até o fim da tela).
const painel = (html: string, titulo: string) => {
  const inicio = html.indexOf(titulo);
  expect(inicio, titulo).toBeGreaterThan(-1);
  const fim = html.indexOf("</table>", inicio);
  return fim < 0 ? html.slice(inicio) : html.slice(inicio, fim + "</table>".length);
};

// Fixture: ativos são m1 (Ana, com pedidos e 2 produtos) e Eva (loja, sem pedido e sem ficha); o
// pausado é o registro de Bruno, sem loja.
beforeEach(() => {
  estado.valores = [];
  ui = { ...UI_INICIAL, filtro: { ...UI_INICIAL.filtro }, sortState: {} };
  mudancas.length = 0;
  recargas.n = 0;
});

describe("tela STLSeller (GER-01, DATA-07, SEC-05, UI-07)", () => {
  it("GER-01: abre no recorte Ativos, com os cinco cards, a origem e a contagem de cada status", () => {
    const { html, vistos: v } = tela();
    expect(botao(v, "Ativos")["aria-pressed"]).toBe(true);
    for (const outro of ["Pausados", "Cancelados", "Todos"]) expect(botao(v, outro)["aria-pressed"], outro).toBe(false);
    expect([botao(v, "Ativos").children, botao(v, "Pausados").children, botao(v, "Cancelados").children, botao(v, "Todos").children]).toEqual(["Ativos · 2", "Pausados · 1", "Cancelados · 0", "Todos · 3"]);
    const t = texto(html);
    expect(t).toContain("Dados do STLSeller atualizado em 22/09/2026, 09:00");
    // Ana: bruto 1.500, por anúncio 1.234,50, 12 pedidos e 2 cancelados; Eva está sem pedido.
    for (const esperado of [`Bruto vendido ${brl(1500)}`, `Atribuído a anúncios ${brl(1234.5)}`, "82,3% do bruto", "Pedidos 12 16,7% cancelados (2)", "Vendendo 1 de 2", "Plano STLSeller ativo 2 de 2", "0 sem conta de seller"]) {
      expect(t, esperado).toContain(esperado);
    }
    expect(t).toContain("Visão geral por mentorado · 2");
    expect(html).toContain("Concentração do bruto");
    expect(html).toContain("Os 15 anúncios que mais faturam");
  });

  it("GER-01: trocar o recorte e o chip muda a tabela e os cards, e o Todos junta os três", () => {
    tela();
    chamar(botao(tela().vistos, "Pausados").onClick);
    const pausados = tela();
    expect(botao(pausados.vistos, "Pausados")["aria-pressed"]).toBe(true);
    const t = texto(pausados.html);
    expect(t).toContain("Visão geral por mentorado · 1");
    expect(t).toContain("Vendendo 0 de 1");
    // O mentorado pausado é o Bruno (ficha pelo e-mail STLFLIX), sem conta de seller.
    expect(painel(pausados.html, "Visão geral por mentorado")).toContain("Bruno Dias");
    expect(t).toContain("Sem conta de seller · 1");
    chamar(botao(pausados.vistos, "Todos").onClick);
    chamar(botao(tela().vistos, "Sem venda").onClick);
    const todosSemVenda = tela();
    expect(texto(todosSemVenda.html)).toContain("Visão geral por mentorado · 2");
    expect(botao(todosSemVenda.vistos, "Sem venda")["aria-pressed"]).toBe(true);
    expect(botao(todosSemVenda.vistos, "Todos ·")["aria-pressed"]).toBe(true);
  });

  it("a busca grava qAnalise e o selo diz o termo e a base do recorte; o cabeçalho grava a ordem da tabela", () => {
    const { vistos: v } = tela();
    const busca = v.find((x) => x.tipo === "busca")?.props;
    chamar(busca?.onChange, { target: { value: "loja da ana" } });
    expect(mudancas.at(-1)).toEqual({ filtro: { ...UI_INICIAL.filtro, qAnalise: "loja da ana" } });
    const achada = tela();
    expect(texto(achada.html)).toContain("Visão geral por mentorado · 1");
    expect(texto(achada.html)).toContain("Busca: “loja da ana” · 1 de 2 mentorado(s) neste recorte");
    chamar(achada.vistos.find((x) => x.tipo === "ordem" && x.props.label === "Pedidos")?.props.onToggle);
    expect(mudancas.at(-1)).toEqual({ sortState: { analise: { coluna: "pedidos", direcao: "asc" } } });
  });

  it("SEC-05 e TEST-02: o título do anúncio vem escapado, e só o link http(s) vira href, com rel noopener noreferrer", () => {
    const { html } = tela();
    const top = painel(html, "Os 15 anúncios que mais faturam");
    expect(top).toContain("Vaso &quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('href="javascript');
    expect(top).toContain('title="javascript:alert(1)"');
    expect(top).toMatch(/<a href="https:\/\/exemplo\.com\/p\/1"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    // O de maior faturamento vem primeiro.
    expect(top.indexOf("Chaveiro")).toBeLessThan(top.indexOf("Vaso"));
  });

  it("o diagnóstico de e-mail lista o motivo, os e-mails e por qual a loja foi achada; o resolvido pelo STLFLIX é citado", () => {
    const { html } = tela({ dados: { ...datasetDeTeste() } });
    const t = texto(painel(html, "E-mail não cadastrado corretamente"));
    // Ana: o STLFLIX (ana@stlflix.com) não é o da loja (loja@ana.com). Eva: STLFLIX = loja.
    expect(t).toContain("E-mail não cadastrado corretamente · 1");
    expect(t).toContain("E-mail STLFLIX não é o da loja");
    expect(t).toContain("ana.clara@exemplo.com ana@stlflix.com loja@ana.com");
    expect(t).toContain("1 resolvido(s) pelo e-mail STLFLIX: Eva Sem Ficha.");
    expect(painel(html, "Ainda sem nenhuma venda")).toContain("Eva Sem Ficha · Loja da Eva");
  });

  it("o nome da linha com ficha leva à ficha pela aba STLSeller; sem ficha é só texto", () => {
    const { html } = tela();
    expect(html).toContain('href="/mentorado/m1/stlseller"');
    expect(html).not.toMatch(/<a [^>]*>Eva Sem Ficha/);
    // O nome do mentorado vem escapado.
    const comXss = datasetDeTeste();
    comXss.stlseller = comXss.stlseller.map((r) => (r.email === "form.eva@exemplo.com" ? { ...r, nome: `Eva ${XSS}` } : r));
    expect(tela({ dados: comXss }).html).not.toContain("<img src=x");
  });

  it("DATA-07 e UI-07: a falha de qualquer uma de R14, R15 ou R16 troca a tela por um EmptyState com Tentar de novo, que recarrega", async () => {
    for (const relacao of ["stlseller_mentorados", "stlseller_pedidos_marketplace", "stlseller_produtos_vendidos"] as const) {
      const antes = recargas.n;
      const { html, vistos: v } = tela({ erros: { [relacao]: "permission denied" } });
      expect(texto(html), relacao).toContain(`Não foi possível carregar esta tela ${relacao}: permission denied`);
      expect(html, relacao).not.toContain("Bruto vendido");
      await chamar(botao(v, "Tentar de novo").onClick);
      expect(recargas.n, relacao).toBe(antes + 1);
    }
    // Erro de outra relação não é da tela.
    expect(tela({ erros: { nps_respostas: "x" } }).html).toContain("Bruto vendido");
  });

  it("sem registro nenhum a tela abre vazia, sem dividir por zero", () => {
    const vazio = { ...datasetDeTeste(), stlseller: [], stlPedidos: [], stlProdutos: [] };
    const t = texto(tela({ dados: vazio }).html);
    expect(t).toContain("Vendendo 0 de 0");
    expect(t).toContain("Atribuído a anúncios R$ 0,00 — do bruto");
    expect(t).toContain("Nenhum anúncio com venda.");
    expect(t).not.toContain("Concentração do bruto");
    expect(t).not.toContain("NaN");
  });

  it("a diretoria lê o mesmo, e a tela não escreve nada", () => {
    const admin = tela({ papel: "admin" }).html;
    const diretoria = tela({ papel: "diretoria" }).html;
    expect(texto(diretoria)).toBe(texto(admin));
    expect(admin).not.toContain("data-escrita");
  });
});
