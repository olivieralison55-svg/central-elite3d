import type { ComponentProps, ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { DadosContexto } from "@/components/shell/contexto";
import type { Dataset, ErrosDeCarga, Mentorado, StlProduto } from "@/lib/data/esquemas";
import { fmtBRL } from "@/lib/moeda";
import type { Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import AbaStlseller from "./aba-stlseller";
import Ficha from "./ficha";

// O falso do Button anota as props: o teste chama o "Tentar de novo".
const botoes = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (botoes.push({ ...props }), createElement(original.default, props)) };
});

function render(el: ReactElement, { papel = "admin", dados = datasetDeTeste(), erros = {}, recarregar = () => Promise.resolve() }: { papel?: Papel; dados?: Dataset; erros?: ErrosDeCarga; recarregar?(): Promise<void> } = {}) {
  botoes.length = 0;
  return renderTela(<DadosContexto.Provider value={{ dados, erros, recarregando: false, recarregar }}>{el}</DadosContexto.Provider>, { papel, dados });
}

const mentorado = (id: string, extra: Partial<Mentorado> = {}): Mentorado => ({ ...(datasetDeTeste().mentorados.find((m) => m.id === id) as Mentorado), ...extra });
// O valor de cada termo da DescriptionList.
const termo = (html: string, nome: string) => html.match(new RegExp(`<dt[^>]*>${nome}</dt><dd[^>]*>([^<]*)</dd>`))?.[1];

describe("aba STLSeller da ficha (GER-01, DATA-07, NAV-05, SEC-05)", () => {
  it("GER-01: casa a ficha pelo e-mail do formulário e mostra origem, cards, loja, pagamento na Lia, pedidos e produtos", () => {
    const html = render(<AbaStlseller mentorado={mentorado("m1")} />);
    expect(html).toContain("Dados do STLSeller");
    expect(html).toContain("Somente leitura: o que estiver errado se corrige lá, não aqui. Atualizado em 22/09/2026, 09:00.");
    for (const texto of ["ATIVO", ">Pago<", ">Ativo<", "loja cadastrada", fmtBRL(1234.5), "2 produto(s) vendido(s)"]) expect(html, texto).toContain(texto);
    expect([termo(html, "Loja"), termo(html, "E-mail da loja"), termo(html, "E-mail STLFLIX"), termo(html, "Vendas em marketplaces")]).toEqual(["Loja da Ana", "loja@ana.com", "ana@stlflix.com", "214"]);
    expect([termo(html, "Status"), termo(html, "Pedidos finalizados"), termo(html, "Último pedido"), termo(html, "Motivo do cancelamento")]).toEqual([
      "Finalizado",
      "1 de 1",
      "06/08/2026, 18:52",
      "—",
    ]);
    expect(html).toContain(">Pedidos por marketplace · 1<");
    // O líquido que o marketplace não informou é traço, não R$ 0,00.
    expect(html).toContain(fmtBRL(1500));
    expect(html).not.toContain(fmtBRL(0));
    expect(html).toContain(">Produtos vendidos · 2<");
    expect(html.indexOf("Chaveiro")).toBeLessThan(html.indexOf("Vaso"));
    // Nada aqui escreve.
    expect(html).not.toContain("data-escrita");
    expect(html).not.toContain("<input");
  });

  it("SEC-05 e TEST-02: o título do anúncio vem escapado, e só o link http(s) vira href, com rel=\"noopener noreferrer\"", () => {
    const html = render(<AbaStlseller mentorado={mentorado("m1")} />);
    expect(html).toContain("Vaso &quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('title="javascript:alert(1)"');
    expect(html).toContain('<a href="https://exemplo.com/p/1" target="_blank" rel="noopener noreferrer"');
    const dados = datasetDeTeste();
    dados.stlProdutos[1].link = "data:text/html,<b>x</b>";
    expect(render(<AbaStlseller mentorado={mentorado("m1")} />, { dados })).not.toMatch(/href="data:/);
  });

  it("o registro achado pelo e-mail STLFLIX, sem loja e sem pedido na Lia; sem pedido nem produto, os blocos dizem que não há", () => {
    const html = render(<AbaStlseller mentorado={mentorado("m2")} />);
    for (const texto of ["PAUSADO", ">Sem pedido na Lia<", ">Inativo<", "sem loja cadastrada", "Nenhum pedido em marketplace.", "Nenhum produto vendido."]) expect(html, texto).toContain(texto);
    expect(termo(html, "Último pedido")).toBe("—");
    expect(html).not.toContain("1969");
  });

  it("sem e-mail na ficha, explica o casamento; com e-mail sem registro, diz o e-mail procurado", () => {
    const semEmail = render(<AbaStlseller mentorado={mentorado("m3")} />);
    expect(semEmail).toContain("Esta ficha não tem e-mail. O STLSeller é casado pelo e-mail — preencha na aba Cadastro.");
    expect(semEmail).not.toContain("Atualizado em");
    expect(render(<AbaStlseller mentorado={mentorado("m3", { email: " Ninguem@Exemplo.com " })} />)).toContain("Nenhum registro no STLSeller para ninguem@exemplo.com.");
  });

  it("acima de 50 produtos, mostra os 50 de maior faturamento e avisa quantos são", () => {
    const dados = datasetDeTeste();
    const base = dados.stlProdutos[1];
    dados.stlProdutos = Array.from({ length: 52 }, (_, i): StlProduto => ({ ...base, anuncio_id: `A${i}`, titulo: `Produto-${String(i).padStart(2, "0")}-fim`, faturamento: String(1000 - i) }));
    const html = render(<AbaStlseller mentorado={mentorado("m1")} />, { dados });
    expect(html).toContain(">Produtos vendidos · 52<");
    expect(html).toContain("Mostrando os 50 de maior faturamento, de 52.");
    expect([html.includes("Produto-49-fim"), html.includes("Produto-50-fim"), html.includes("Produto-51-fim")]).toEqual([true, false, false]);
  });

  it("DATA-07: a falha de qualquer uma de R14–R16 vira o erro com 'Tentar de novo' só nesta aba; as outras abas seguem", async () => {
    for (const relacao of ["stlseller_mentorados", "stlseller_pedidos_marketplace", "stlseller_produtos_vendidos"] as const) {
      const recarregar = vi.fn(() => Promise.resolve());
      const erros: ErrosDeCarga = { [relacao]: `relation "${relacao}" does not exist` };
      const html = render(<AbaStlseller mentorado={mentorado("m1")} />, { erros, recarregar });
      expect(html, relacao).toContain("Não foi possível carregar os dados do STLSeller");
      expect(html, relacao).toContain(`relation &quot;${relacao}&quot; does not exist`);
      expect(html, relacao).not.toContain("Loja da Ana");
      const tentar = botoes.find((p) => p.children === "Tentar de novo")?.onClick;
      if (typeof tentar !== "function") throw new Error("Tentar de novo ausente");
      tentar();
      expect(recarregar, relacao).toHaveBeenCalledTimes(1);
      // A mesma falha não toca o cadastro da ficha.
      const cadastro = render(<Ficha id="m1" aba="cadastro" />, { erros });
      expect(cadastro, relacao).not.toContain("Não foi possível carregar os dados do STLSeller");
      expect(cadastro, relacao).toContain("Salvar alterações");
    }
  });

  it("DATA-07: com R14–R16 em falha, Cadastro, Financeiro e Sessões da ficha seguem sem aviso de erro nenhum; só a aba STLSeller mostra o dela", () => {
    // O corpo de cada aba, para o aviso ausente não passar com a aba vazia.
    const corpo = { cadastro: "Salvar alterações", financeiro: ">Parcelas", sessoes: "Sessões 1:1 com mentores" };
    for (const relacao of ["stlseller_mentorados", "stlseller_pedidos_marketplace", "stlseller_produtos_vendidos"] as const) {
      const erros: ErrosDeCarga = { [relacao]: `relation "${relacao}" does not exist` };
      for (const [aba, marca] of Object.entries(corpo)) {
        const html = render(<Ficha id="m1" aba={aba} />, { erros });
        expect(html, `${relacao} ${aba}`).toContain(marca);
        for (const aviso of ["Parte dos dados não carregou", "Não foi possível carregar", "does not exist"]) expect(html, `${relacao} ${aba}: ${aviso}`).not.toContain(aviso);
      }
      const stlseller = render(<Ficha id="m1" aba="stlseller" />, { erros });
      expect(stlseller, relacao).toContain("Não foi possível carregar os dados do STLSeller");
      expect(stlseller, relacao).toContain(`relation &quot;${relacao}&quot; does not exist`);
    }
  });

  it("NAV-05: só quem tem verFinanceiro vê a aba; o mentor que pede stlseller fica em Sessões", () => {
    for (const papel of ["admin", "diretoria"] as const) expect(render(<Ficha id="m1" aba="stlseller" />, { papel }), papel).toContain("Dados do STLSeller");
    const doMentor = render(<Ficha id="m1" aba="stlseller" />, { papel: "mentor" });
    expect(doMentor).not.toContain("Dados do STLSeller");
    expect(doMentor).toContain("Sessões 1:1 com mentores");
  });
});
