import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { UI_INICIAL, type Ui, UiContexto } from "@/components/shell/contexto";
import EmptyState from "@/components/ui/empty-state";
import type { Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Mentorados from "./mentorados";

// Os falsos anotam as props de SortHeader, SegmentedControl e SearchInput e desenham o de verdade:
// o teste chama o handler anotado, que no render do servidor não vai para o HTML.
const vistos = vi.hoisted(() => [] as Array<{ tipo: string; props: Record<string, unknown> }>);
const anotar = vi.hoisted(
  () =>
    <P extends object>(tipo: string, Original: (props: P) => unknown) =>
    (props: P) => {
      vistos.push({ tipo, props: { ...props } as Record<string, unknown> });
      return Original(props);
    },
);
vi.mock("@/components/ui/sort-header", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/ui/sort-header")>();
  return { ...original, default: anotar("ordem", original.default) };
});
vi.mock("@/components/ui/segmented-control", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/ui/segmented-control")>();
  return { ...original, default: anotar("filtro", original.default) };
});
vi.mock("@/components/ui/search-input", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/ui/search-input")>();
  return { ...original, default: anotar("busca", original.default) };
});

function tela(papel: Papel, ui: Partial<Ui> = {}) {
  const mudancas: Array<Partial<Ui>> = [];
  vistos.length = 0;
  const html = renderTela(
    <UiContexto.Provider value={{ ui: { ...UI_INICIAL, ...ui }, mudar: (parcial) => mudancas.push(parcial) }}>
      <Mentorados />
    </UiContexto.Provider>,
    { papel },
  );
  return { html, mudancas, vistos: [...vistos] };
}

const filtro = (campos: Partial<Ui["filtro"]>) => ({ filtro: { ...UI_INICIAL.filtro, ...campos } });
// As linhas da tabela, cada uma com o HTML dela.
const linhas = (html: string) => [...html.matchAll(/<tr class="group bg-background[^"]*">([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
// O id do mentorado da linha, pelo link da primeira célula.
const ids = (html: string) => linhas(html).map((linha) => /href="\/mentorado\/([^"/]+)"/.exec(linha)?.[1]);
function props(lista: typeof vistos, tipo: string, casa: (p: Record<string, unknown>) => boolean = () => true) {
  const achados = lista.filter((v) => v.tipo === tipo && casa(v.props));
  expect(achados, tipo).toHaveLength(1);
  return achados[0].props;
}
const chamar = (fn: unknown, ...args: unknown[]) => {
  if (typeof fn !== "function") throw new Error("handler ausente");
  return fn(...args);
};

describe("tela Mentorados (OPS-10, UI-06, UI-07, WRITE-09)", () => {
  it("a coluna Contrato só aparece com verFinanceiro", () => {
    for (const papel of ["admin", "diretoria"] as const) {
      const { html } = tela(papel);
      expect(html, papel).toContain('aria-label="Contrato, sem ordenação"');
      expect(html, papel).toContain(">Assinado</span>");
    }
    const mentor = tela("mentor").html;
    expect(mentor).not.toContain("Contrato");
    expect(mentor).not.toContain(">Assinado</span>");
  });

  it("a linha leva à ficha por <Link> na primeira célula; não ativo aparece com opacidade reduzida", () => {
    const { html } = tela("admin");
    expect(ids(html)).toEqual(["m1", "m2", "m4", "m3"]);
    const [ana, , carla] = linhas(html);
    expect(ana).toContain('href="/mentorado/m1">Ana Clara</a>');
    expect(ana).not.toContain("opacity-60");
    expect(carla).toContain("opacity-60");
    expect(carla).toContain(">pausado</span>");
  });

  it("o emoji de situação do nome vira ícone na lista, e a busca casa o nome sem ele", () => {
    const dados = datasetDeTeste();
    dados.mentorados = dados.mentorados.map((m) => (m.id === "m1" ? { ...m, nome: "🔴 Ana Clara" } : m.id === "m2" ? { ...m, nome: "⚠️Bruno Dias" } : m));
    const ver = (ui: Partial<Ui>) =>
      renderTela(
        <UiContexto.Provider value={{ ui: { ...UI_INICIAL, ...ui }, mudar: () => undefined }}>
          <Mentorados />
        </UiContexto.Provider>,
        { papel: "admin", dados },
      );
    const [ana, bruno] = linhas(ver({}));
    expect(ana).toMatch(/href="\/mentorado\/m1"[^>]*><span[^>]*><svg[^>]*aria-label="risco"[\s\S]*Ana Clara<\/span><\/a>/);
    expect(bruno).toMatch(/aria-label="alerta"[\s\S]*Bruno Dias<\/span><\/a>/);
    expect(ana + bruno).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]/u);
    expect(ids(ver(filtro({ q: "ana clara" })))).toEqual(["m1"]);
    expect(ids(ver(filtro({ q: "bruno" })))).toEqual(["m2"]);
  });

  it("UI-06: a ordem padrão é por nome; o cabeçalho alterna a coluna pela T37 e grava sortState; a seta só aparece na coluna escolhida", () => {
    const padrao = tela("admin");
    chamar(props(padrao.vistos, "ordem", (p) => p.label === "Sessões").onToggle);
    expect(padrao.mudancas).toEqual([{ sortState: { mentorados: { coluna: "sessoes", direcao: "asc" } } }]);

    const crescente = tela("admin", { sortState: { mentorados: { coluna: "sessoes", direcao: "asc" } } });
    // 1:1 concluídas: m2 e m3 nenhuma, m1 e m4 uma.
    expect(ids(crescente.html)).toEqual(["m2", "m3", "m1", "m4"]);
    expect(crescente.html).toContain('aria-label="Sessões, ordem crescente"');
    expect(crescente.html).toContain('aria-label="Mentorado, sem ordenação"');
    chamar(props(crescente.vistos, "ordem", (p) => p.label === "Sessões").onToggle);
    expect(crescente.mudancas).toEqual([{ sortState: { mentorados: { coluna: "sessoes", direcao: "desc" } } }]);

    expect(ids(tela("admin", { sortState: { mentorados: { coluna: "sessoes", direcao: "desc" } } }).html)).toEqual(["m4", "m1", "m3", "m2"]);
    expect(ids(tela("admin", { sortState: { mentorados: { coluna: "fechamento", direcao: "asc" } } }).html)).toEqual(["m3", "m4", "m1", "m2"]);
  });

  it("WRITE-09: '+ Novo mentorado' só com criarMentorado, com data-escrita=\"W14\"", () => {
    expect(tela("admin").html).toMatch(/<button[^>]*data-escrita="W14"[^>]*>\+ Novo mentorado<\/button>/);
    for (const papel of ["diretoria", "mentor"] as const) {
      const { html } = tela(papel);
      expect(html, papel).not.toContain('data-escrita="W14"');
      expect(html, papel).not.toContain("+ Novo mentorado");
    }
  });

  it("OPS-10: filtro e busca: o filtro grava statusFin, a busca grava q, e a lista mostra o que os dois deixaram, com o selo", () => {
    const admin = tela("admin");
    const segmentos = props(admin.vistos, "filtro");
    expect(segmentos.items).toEqual(["Todos", "Somente ativos", "Somente pausados", "Somente cancelados", "Cadastro incompleto", "Contrato pendente"]);
    expect(segmentos.value).toBe("Todos");
    chamar(segmentos.onChange, "Cadastro incompleto");
    chamar(props(admin.vistos, "busca").onChange, { target: { value: "bruno" } });
    expect(admin.mudancas).toEqual([filtro({ statusFin: "incompletos" }), filtro({ q: "bruno" })]);
    expect(props(tela("mentor").vistos, "filtro").items).toEqual(["Todos", "Somente ativos", "Somente pausados", "Somente cancelados", "Cadastro incompleto"]);

    const busca = tela("admin", filtro({ q: "bruno" })).html;
    expect(ids(busca)).toEqual(["m2"]);
    expect(busca).toContain("Busca: “bruno” · 1 de 4 mentorado(s)");
    expect(busca).toContain("1 de 4 registro(s) · dados financeiros ficam em Financeiro");
    const incompletos = tela("admin", filtro({ statusFin: "incompletos" }));
    expect(ids(incompletos.html)).toEqual(["m3"]);
    expect(props(incompletos.vistos, "filtro").value).toBe("Cadastro incompleto");
  });

  it("Ficha criada pela Lia: a linha vem marcada e explica o que falta; o nome do banco sai escapado", () => {
    const diego = linhas(tela("admin").html).find((linha) => linha.includes('href="/mentorado/m3"')) ?? "";
    expect(diego).toContain(">cadastro incompleto</span>");
    expect(diego).toContain('title="Ficha criada por um pagamento na Lia. Falta contrato, ciclo, mentor e datas — abra e salve para completar."');
    expect(diego).toContain("&lt;img");
    expect(diego).not.toContain("<img src=x");
  });

  it("OPS-05: a coluna Sessões é a trilha 1:1, com N de M concluídas; quem não tem 1:1 mostra '0 sessões'", () => {
    const html = tela("admin").html;
    const ana = linhas(html)[0];
    expect(ana).toContain('role="img" aria-label="1 de 2 sessões 1:1 concluídas"');
    expect(ana.match(/<span title="[^"]*" class="h-1\.5 w-3/g)).toHaveLength(2);
    const diego = linhas(html).find((linha) => linha.includes('href="/mentorado/m3"')) ?? "";
    expect(diego).toContain(">0 sessões</span>");
  });

  it("UI-07: filtro e busca que não deixam ninguém mostram EmptyState", () => {
    const html = tela("admin", filtro({ statusFin: "pausados", q: "bruno" })).html;
    expect(html).toContain(renderToStaticMarkup(<EmptyState title="Nenhum mentorado encontrado com esses filtros." />));
    expect(linhas(html)).toEqual([]);
  });
});
