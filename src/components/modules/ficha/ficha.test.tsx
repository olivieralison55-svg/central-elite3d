import { type ComponentProps, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PaginaFicha from "@/app/(app)/mentorado/[id]/[[...aba]]/page";
import type { Ui } from "@/components/shell/contexto";
import { PortaoDados } from "@/components/shell/dados";
import { Carregando } from "@/components/shell/sessao";
import type { Dataset } from "@/lib/data/esquemas";
import type { Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { navegadorFalso, renderTela } from "@/test/render";

import Ficha from "./ficha";

// O falso das Tabs anota as props e desenha as de verdade: o teste chama o onChange anotado.
const vistos = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("@/components/ui/tabs", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/tabs")>();
  return {
    ...original,
    default: (props: ComponentProps<typeof original.default>) => {
      vistos.push({ ...props });
      return createElement(original.default, props);
    },
  };
});

function render(el: React.ReactElement, { papel = "admin", dados = datasetDeTeste(), ui = {} }: { papel?: Papel; dados?: Dataset; ui?: Partial<Ui> } = {}) {
  vistos.length = 0;
  const navegar = navegadorFalso("/mentorado/m1");
  const html = renderTela(el, { papel, dados, ui, navegar });
  return { html, tabs: [...vistos], chamadas: navegar.chamadas };
}

// [rótulo, selecionada] de cada aba, na ordem.
const abas = (html: string) => [...html.matchAll(/<button type="button" role="tab" aria-selected="(true|false)"[^>]*>([^<]*)<\/button>/g)].map((m) => [m[2], m[1] === "true"]);
const subtitulo = (html: string) => html.match(/<p class="mt-1\.5[^"]*">([^<]*)<\/p>/)?.[1];

describe("ficha: topo, abas e página (NAV-05, NAV-08, NAV-09, EDGE-01, OPS-05)", () => {
  it("o topo resume fechamento, parcelas pagas, N de M 1:1 concluídas, implementação e plantões", () => {
    expect(subtitulo(render(<Ficha id="m2" />).html)).toBe(
      "Fechamento 02/03/2026 · 1/2 parcelas pagas · 0 de 2 sessões concluídas · Implementação pendente · 1 plantão(ões) de dúvida desde a entrada",
    );
    // OPS-05: os encontros em grupo de m1 (o plantão, a implementação concluída) não entram no N de M.
    const dados = datasetDeTeste();
    dados.sessoes.push({ ...dados.sessoes[0], id: "i1", etapa: "Sessão de Implementação Mensal", ordem: 91, status: "Concluída", mentor: "Michelle", data: "2026-09-10", hora: "20:00:00" });
    expect(subtitulo(render(<Ficha id="m1" />, { dados }).html)).toBe(
      "Fechamento 10/01/2026 · 0/1 parcelas pagas · 1 de 2 sessões concluídas · Implementação feita em 10/09/2026 · 1 plantão(ões) de dúvida desde a entrada",
    );
    // Sem parcela nenhuma e sem sessão 1:1, as duas partes somem em vez de virar "0/0".
    expect(subtitulo(render(<Ficha id="m3" />).html)).toBe("Fechamento 01/10/2025 · Implementação pendente · 0 plantão(ões) de dúvida desde a entrada");
  });

  it("as parcelas pagas só aparecem no topo para quem tem verFinanceiro", () => {
    // O mentor não tem verFinanceiro: mesmo com parcelas no dataset, o topo não fala delas.
    expect(subtitulo(render(<Ficha id="m2" />, { papel: "mentor" }).html)).toBe(
      "Fechamento 02/03/2026 · 0 de 2 sessões concluídas · Implementação pendente · 1 plantão(ões) de dúvida desde a entrada",
    );
    expect(subtitulo(render(<Ficha id="m2" />, { papel: "diretoria" }).html)).toContain("1/2 parcelas pagas");
  });

  it("NAV-09: id fora dos mentorados carregados mostra 'Ficha não encontrada', com o caminho de volta, e nenhuma aba", () => {
    const { html } = render(<Ficha id="nao-existe" aba="financeiro" />);
    expect(html).toContain("Ficha não encontrada");
    expect(html).toContain("Este mentorado não existe mais, ou o endereço está errado.");
    expect(html).toContain("Se a ficha foi excluída, o histórico dela saiu junto.");
    expect(html).toMatch(/<a [^>]*href="\/mentorados"[^>]*>Ver todos os mentorados<\/a>/);
    expect(html).not.toContain('role="tablist"');
  });

  it("EDGE-01: a ficha aberta que some na recarga vira 'Ficha não encontrada'", () => {
    const antes = datasetDeTeste();
    expect(render(<Ficha id="m1" />, { dados: antes }).html).toContain("Ana Clara");
    const depois = { ...antes, mentorados: antes.mentorados.filter((m) => m.id !== "m1") };
    const html = render(<Ficha id="m1" />, { dados: depois }).html;
    expect(html).toContain("Ficha não encontrada");
    expect(html).not.toContain("Ana Clara");
  });

  it("NAV-08: antes da primeira carga a ficha é o Skeleton, nunca 'Ficha não encontrada'", () => {
    const html = renderToStaticMarkup(
      <PortaoDados estado={{ atual: null, erro: null, recarregando: false }} recarregar={() => Promise.resolve()}>
        <Ficha id="nao-existe" />
      </PortaoDados>,
    );
    expect(html).toBe(renderToStaticMarkup(<Carregando />));
    expect(html).not.toContain("Ficha não encontrada");
  });

  it("NAV-05: sem verFinanceiro as abas financeiro e stlseller desenham sessoes, e só Cadastro, Sessões e Notas são oferecidas", () => {
    const doMentor = [
      ["Cadastro", false],
      ["Sessões", true],
      ["Notas", false],
    ];
    expect(abas(render(<Ficha id="m1" aba="financeiro" />, { papel: "mentor" }).html)).toEqual(doMentor);
    expect(abas(render(<Ficha id="m1" aba="stlseller" />, { papel: "mentor" }).html)).toEqual(doMentor);
    // Com verFinanceiro, a aba pedida vale; a desconhecida (e o `completo` de hoje) vira Cadastro.
    expect(abas(render(<Ficha id="m1" aba="stlseller" />, { papel: "diretoria" }).html)).toEqual([
      ["Cadastro", false],
      ["Financeiro", false],
      ["Sessões", false],
      ["Notas", false],
      ["STLSeller", true],
    ]);
    expect(abas(render(<Ficha id="m1" aba="financeiro" />).html).find(([, ativa]) => ativa)).toEqual(["Financeiro", true]);
    for (const aba of [undefined, "completo", "inventada"]) {
      expect(abas(render(<Ficha id="m1" aba={aba} />).html).find(([, ativa]) => ativa), String(aba)).toEqual(["Cadastro", true]);
    }
  });

  it("trocar de aba vai para o endereço da ficha naquela aba, com o id codificado; o cadastro não leva sufixo", () => {
    const dados = datasetDeTeste();
    dados.mentorados.push({ ...dados.mentorados[0], id: "a/b?c", nome: "Id Estranho" });
    const { tabs, chamadas } = render(<Ficha id="a/b?c" aba="notas" />, { dados });
    expect(tabs).toHaveLength(1);
    const trocar = tabs[0].onChange;
    if (typeof trocar !== "function") throw new Error("onChange ausente");
    trocar("financeiro");
    trocar("cadastro");
    expect(chamadas).toEqual([
      ["ir", "/mentorado/a%2Fb%3Fc/financeiro"],
      ["ir", "/mentorado/a%2Fb%3Fc"],
    ]);
  });

  it("voltar aponta para voltarPara, com o rótulo da tela; sem lista de origem, Mentorados", () => {
    expect(render(<Ficha id="m1" />).html).toMatch(/<a [^>]*href="\/mentorados"[^>]*>← Mentorados<\/a>/);
    expect(render(<Ficha id="m1" />, { ui: { voltarPara: "/sessoes" } }).html).toMatch(/<a [^>]*href="\/sessoes"[^>]*>← Sessões<\/a>/);
    expect(render(<Ficha id="m1" />, { papel: "diretoria", ui: { voltarPara: "/financeiro" } }).html).toMatch(/<a [^>]*href="\/financeiro"[^>]*>← Financeiro<\/a>/);
    expect(render(<Ficha id="nao-existe" />, { ui: { voltarPara: "/dash" } }).html).toMatch(/<a [^>]*href="\/dash"[^>]*>← Dashboard<\/a>/);
  });

  it("o nome vai escapado no título, com a situação quando não é ativo", () => {
    const { html } = render(<Ficha id="m4" />);
    expect(html).toContain("Carla &quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).toMatch(/<h1[^>]*>.*>pausado<\/span>.*<\/h1>/);
  });

  it("a página da rota entrega o id e só o primeiro segmento da aba", async () => {
    const pagina = await PaginaFicha({ params: Promise.resolve({ id: "m1", aba: ["financeiro", "extra"] }) });
    expect(isValidElement(pagina) && [pagina.type, pagina.props]).toEqual([Ficha, { id: "m1", aba: "financeiro" }]);
    const semAba = await PaginaFicha({ params: Promise.resolve({ id: "m1" }) });
    expect(isValidElement(semAba) && semAba.props).toEqual({ id: "m1", aba: undefined });
  });
});
