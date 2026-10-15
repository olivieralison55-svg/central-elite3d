import { describe, expect, it } from "vitest";

import { datasetDeTeste } from "@/test/fixtures";

import type { StlMentorado, StlPedido, StlProduto } from "./data/esquemas";
import type { Ordem } from "./ordem";
import {
  agregadosAnalise,
  ANALISE_STATUS,
  type ChipAnalise,
  concentracaoAnalise,
  contagemStatusReal,
  gruposAnalise,
  linhasAnalise,
  listaAnalise,
  lojaPor,
  nomeAnalise,
  ORDEM_ANALISE,
  pct,
  recorteAnalise,
  rotuloMarketplace,
  situacaoEmail,
  STATUS_PADRAO,
  stlsellerDe,
  topAnuncios,
  ultimaSync,
} from "./stlseller";

describe("STLSeller da ficha (GER-01)", () => {
  it("o e-mail da ficha, normalizado, casa com o e-mail do formulário e, se nenhum casar, com o da conta STLFLIX", () => {
    const { stlseller } = datasetDeTeste();
    expect(stlsellerDe(stlseller, "  Ana.Clara@Exemplo.COM ")?.email).toBe("ana.clara@exemplo.com");
    // m2: o formulário tem outro e-mail; a conta STLFLIX acha o registro.
    expect(stlsellerDe(stlseller, "bruno@exemplo.com")?.email).toBe("outro@exemplo.com");
    expect(stlsellerDe(stlseller, "ninguem@exemplo.com")).toBeNull();
    for (const vazio of [null, undefined, "", "   "]) expect(stlsellerDe(stlseller, vazio), String(vazio)).toBeNull();
  });

  it("o e-mail do formulário vence o da conta STLFLIX, e o STLFLIX gravado com caixa e espaço também casa", () => {
    const [base] = datasetDeTeste().stlseller;
    const peloStlflix = { ...base, email: "loja@exemplo.com", email_stlflix: " X@Exemplo.com " };
    const peloFormulario = { ...base, email: "x@exemplo.com", email_stlflix: null };
    expect(stlsellerDe([peloStlflix, peloFormulario], "x@exemplo.com")).toBe(peloFormulario);
    expect(stlsellerDe([peloStlflix], "X@EXEMPLO.COM")).toBe(peloStlflix);
  });
});

// GER-01: a tela STLSeller. Os registros abaixo são montados à mão: cada um existe para um ramo.
const reg = (email: string, extra: Partial<StlMentorado> = {}): StlMentorado => ({
  email,
  email_stlflix: null,
  nome: null,
  status_formulario: "ATIVO",
  status_real: "pago",
  plano_ativo: false,
  vendas_marketplace: null,
  loja_id: "loja",
  loja_nome: null,
  loja_email: null,
  lia_status_pagamento: null,
  lia_motivo_cancelamento: null,
  lia_pedidos: null,
  lia_pedidos_finalizados: null,
  lia_ultimo_pedido_em: null,
  produtos_vendidos: 0,
  faturamento_total: "0",
  synced_at: "2026-09-22T12:00:00Z",
  ...extra,
});
const ped = (email: string, marketplace: string, extra: Partial<StlPedido> = {}): StlPedido => ({
  email,
  marketplace,
  pedidos: 0,
  pedidos_vendidos: 0,
  pedidos_cancelados: 0,
  total_bruto: "0",
  total_liquido: null,
  ultimo_pedido_em: null,
  ...extra,
});
const prod = (email: string, anuncio: string, faturamento: number | string | null, extra: Partial<StlProduto> = {}): StlProduto => ({
  email,
  marketplace: "shopee",
  anuncio_id: anuncio,
  titulo: anuncio,
  cadastrado_no_stlseller: true,
  link: null,
  pedidos: 1,
  unidades: 1,
  faturamento,
  ultima_venda_em: null,
  ...extra,
});
const ficha = (id: string, nome: string, email: string | null) => ({ ...datasetDeTeste().mentorados[0], id, nome, email });

describe("o STLSeller soma por e-mail (GER-01, mapeamento §3.8)", () => {
  const dados = {
    mentorados: [ficha("f1", "Ana", "ana@x.com"), ficha("f2", "Beto", "beto@stlflix.com")],
    stlseller: [reg("ana@x.com", { loja_id: "a" }), reg("beto@form.com", { email_stlflix: "Beto@Stlflix.com", loja_id: "b", loja_email: "beto@stlflix.com" }), reg("cid@x.com", { loja_id: "c", nome: "Cid" }), reg("dora@x.com", { loja_id: null })],
    stlPedidos: [
      ped("ana@x.com", "shopee", { pedidos: 10, pedidos_cancelados: 2, total_bruto: "100.50", ultimo_pedido_em: "2026-09-01T10:00:00Z" }),
      ped("ana@x.com", "mercadolivre", { pedidos: 5, pedidos_cancelados: 1, total_bruto: 50, ultimo_pedido_em: "2026-09-10T10:00:00Z" }),
      ped("beto@form.com", "shopee", { pedidos: null, pedidos_cancelados: null, total_bruto: null }),
    ],
    stlProdutos: [
      prod("ana@x.com", "A1", "60.25"),
      prod("ana@x.com", "A2", 30, { cadastrado_no_stlseller: false }),
      prod("ana@x.com", "A3", null, { cadastrado_no_stlseller: null }),
      prod("cid@x.com", "C1", 7),
    ],
  };
  const linhas = linhasAnalise(dados);
  const [ana, beto, cid, dora] = linhas;

  it("pedidos, cancelados e bruto somam os pedidos (numeric como texto também), a receita soma os produtos", () => {
    expect([ana.pedidos, ana.cancelados, ana.bruto, ana.receita]).toEqual([15, 3, 150.5, 90.25]);
    expect(ana.pctCancel).toBeCloseTo(0.2);
    expect(ana.cobertura).toBeCloseTo(90.25 / 150.5);
    // número nulo conta zero; sem pedido não há divisão: % cancelado e cobertura ficam nulos.
    expect([beto.pedidos, beto.bruto, beto.pctCancel, beto.cobertura]).toEqual([0, 0, null, null]);
  });

  it("anúncios contam os produtos; fora do catálogo só conta o `false` (nulo não é fora)", () => {
    expect([ana.anuncios, ana.fora]).toEqual([3, 1]);
  });

  it("canais saem únicos e em ordem, e o último pedido é o maior instante", () => {
    expect(ana.canais).toEqual(["mercadolivre", "shopee"]);
    expect(ana.ultimo).toBe("2026-09-10T10:00:00Z");
    expect(beto.ultimo).toBeNull();
  });

  it("situação: sem loja é sem conta; pedido ou produto é vende; loja sem nada é parado", () => {
    expect(linhas.map((l) => l.situacao)).toEqual(["vende", "parado", "vende", "sem-conta"]);
    // beto tem uma linha de pedido, mas com zero pedidos e sem produto: parado. cid vende só por produto.
    expect(cid.pedidos).toBe(0);
    expect(cid.anuncios).toBe(1);
  });

  it("a ficha vem pelo e-mail do formulário ou pelo e-mail STLFLIX, e o nome da linha cai para o do registro e depois para o e-mail", () => {
    expect([ana.ficha?.id, beto.ficha?.id, cid.ficha, dora.ficha]).toEqual(["f1", "f2", null, null]);
    expect(nomeAnalise(ana)).toBe("Ana");
    expect(nomeAnalise(cid)).toBe("Cid");
    expect(nomeAnalise(dora)).toBe("dora@x.com");
  });

  it("a última sincronização é a maior", () => {
    expect(ultimaSync([reg("a@x.com", { synced_at: "2026-09-01T00:00:00Z" }), reg("b@x.com", { synced_at: "2026-09-22T12:00:00Z" })])).toBe("2026-09-22T12:00:00Z");
    expect(ultimaSync([])).toBeNull();
  });
});

describe("recorte, agregados e concentração (GER-01)", () => {
  const base = linhasAnalise({
    mentorados: [],
    stlseller: [
      reg("a@x.com", { status_formulario: "ATIVO", plano_ativo: true }),
      reg("b@x.com", { status_formulario: "PAUSADO" }),
      reg("c@x.com", { status_formulario: "CANCELADO", loja_id: null }),
      reg("d@x.com", { status_formulario: "ATIVO", loja_id: null }),
    ],
    stlPedidos: [ped("a@x.com", "shopee", { pedidos: 4, pedidos_cancelados: 1, total_bruto: 400 }), ped("b@x.com", "shopee", { pedidos: 1, total_bruto: 100 })],
    stlProdutos: [prod("a@x.com", "A", 300)],
  });

  it('o padrão é "Ativos" e "" é "Todos"', () => {
    expect(STATUS_PADRAO).toBe("ATIVO");
    expect(recorteAnalise(base, STATUS_PADRAO).map((l) => l.r.email)).toEqual(["a@x.com", "d@x.com"]);
    expect(recorteAnalise(base, "PAUSADO").map((l) => l.r.email)).toEqual(["b@x.com"]);
    expect(recorteAnalise(base, "").length).toBe(4);
    expect(ANALISE_STATUS.map(([v]) => v)).toEqual(["ATIVO", "PAUSADO", "CANCELADO", ""]);
  });

  it("os agregados somam só o recorte", () => {
    expect(agregadosAnalise(recorteAnalise(base, "ATIVO"))).toEqual({ vendendo: 1, bruto: 400, receita: 300, pedidos: 4, cancelados: 1, comPlano: 1, semConta: 1 });
    expect(agregadosAnalise(base)).toMatchObject({ vendendo: 2, bruto: 500, pedidos: 5, semConta: 2 });
  });

  it("a concentração traz os 5 maiores do bruto e o resto como `outros N`, só quando o resto passa de zero", () => {
    const seis = linhasAnalise({
      mentorados: [],
      stlseller: ["a", "b", "c", "d", "e", "f", "g"].map((n) => reg(`${n}@x.com`, { nome: n })),
      stlPedidos: [10, 70, 20, 60, 30, 50, 40].map((bruto, i) => ped(`${"abcdefg"[i]}@x.com`, "shopee", { pedidos: 1, total_bruto: bruto })),
      stlProdutos: [],
    });
    expect(concentracaoAnalise(seis)).toEqual([
      { nome: "b", valor: 70 },
      { nome: "d", valor: 60 },
      { nome: "f", valor: 50 },
      { nome: "g", valor: 40 },
      { nome: "e", valor: 30 },
      { nome: "outros 2", valor: 30 },
    ]);
    // sete vendem, mas dois com bruto zero: o resto é zero e a fatia `outros` não aparece.
    const zerados = linhasAnalise({ mentorados: [], stlseller: seis.slice(0, 6).map((l) => l.r), stlPedidos: [], stlProdutos: seis.slice(0, 6).map((l) => prod(l.r.email, l.r.email, 1)) });
    expect(concentracaoAnalise(zerados).map((f) => f.nome)).toEqual(["a", "b", "c", "d", "e"]);
    expect(concentracaoAnalise([])).toEqual([]);
  });

  it('o status real conta por valor, o maior grupo primeiro, e o vazio é "—"', () => {
    const l = linhasAnalise({
      mentorados: [],
      stlseller: [reg("a@x.com", { status_real: "pendente" }), reg("b@x.com", { status_real: "pago" }), reg("c@x.com", { status_real: "pago" }), reg("d@x.com", { status_real: null })],
      stlPedidos: [],
      stlProdutos: [],
    });
    expect(contagemStatusReal(l)).toEqual([["pago", 2], ["pendente", 1], ["—", 1]]);
  });

  it("o pct tem até 1 casa e `—` sem valor", () => {
    expect([pct(null), pct(0), pct(0.25), pct(0.12345), pct(1)]).toEqual(["—", "0%", "25%", "12,3%", "100%"]);
  });
});

describe("chips, busca e ordem da tabela (GER-01)", () => {
  const base = linhasAnalise({
    mentorados: [],
    stlseller: [
      reg("a@x.com", { nome: "Alfa", plano_ativo: true, email_stlflix: "a@x.com", loja_nome: "Loja Zeta" }),
      reg("b@x.com", { nome: "Beta", email_stlflix: "b@x.com" }),
      reg("c@x.com", { nome: "Gama", loja_id: null, email_stlflix: "c@x.com" }),
      reg("d@x.com", { nome: "Delta", plano_ativo: true, email_stlflix: "d@x.com" }),
    ],
    stlPedidos: [ped("a@x.com", "shopee", { pedidos: 2, pedidos_cancelados: 1, total_bruto: 50, ultimo_pedido_em: "2026-09-01T00:00:00Z" }), ped("d@x.com", "shopee", { pedidos: 9, total_bruto: 500, ultimo_pedido_em: "2026-09-05T00:00:00Z" })],
    stlProdutos: [prod("a@x.com", "A", 40, { cadastrado_no_stlseller: false })],
  });
  const emails = (chip: ChipAnalise, busca = "", ordem: Ordem | null = null) => listaAnalise(base, chip, busca, ordem).lista.map((l) => l.r.email);

  it("cada chip recorta o que diz", () => {
    expect(emails("todos").sort()).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]);
    expect(emails("vende").sort()).toEqual(["a@x.com", "d@x.com"]);
    // "Sem venda" é tudo que não vende: parado e sem conta.
    expect(emails("parado").sort()).toEqual(["b@x.com", "c@x.com"]);
    expect(emails("plano").sort()).toEqual(["a@x.com", "d@x.com"]);
    expect(emails("fora")).toEqual(["a@x.com"]);
  });

  it("o chip de e-mail incorreto lista só quem o diagnóstico recusa", () => {
    const l = linhasAnalise({
      mentorados: [],
      stlseller: [reg("a@x.com", { email_stlflix: "a@x.com" }), reg("b@x.com"), reg("c@x.com", { email_stlflix: "outro@x.com" })],
      stlPedidos: [],
      stlProdutos: [],
    });
    expect(listaAnalise(l, "email", "", null).lista.map((x) => x.r.email).sort()).toEqual(["b@x.com", "c@x.com"]);
  });

  it("a busca acha por nome, e-mail, e-mail STLFLIX e loja, sem acento, e `antesDaBusca` é a base do chip", () => {
    expect(emails("todos", "alfa")).toEqual(["a@x.com"]);
    expect(emails("todos", "d@x")).toEqual(["d@x.com"]);
    expect(emails("todos", "zeta")).toEqual(["a@x.com"]);
    const comOutroStlflix = linhasAnalise({ mentorados: [], stlseller: [reg("q@x.com", { email_stlflix: "conta.stl@x.com" })], stlPedidos: [], stlProdutos: [] });
    expect(listaAnalise(comOutroStlflix, "todos", "conta.stl", null).lista.length).toBe(1);
    expect(listaAnalise(base, "plano", "beta", null)).toEqual({ lista: [], antesDaBusca: 2 });
  });

  it("sem ordem escolhida vale o bruto, do maior para o menor; escolhida, a escolhida (% cancel. sem pedido vale -1)", () => {
    expect(ORDEM_ANALISE).toEqual({ campo: "bruto", direcao: "desc" });
    expect(emails("vende")).toEqual(["d@x.com", "a@x.com"]);
    expect(emails("todos", "", { campo: "nome", direcao: "asc" })).toEqual(["a@x.com", "b@x.com", "d@x.com", "c@x.com"]);
    expect(emails("todos", "", { campo: "cancel", direcao: "desc" })[0]).toBe("a@x.com");
    expect(emails("todos", "", { campo: "pedidos", direcao: "asc" }).slice(-1)).toEqual(["d@x.com"]);
    expect(emails("todos", "", { campo: "ultimo", direcao: "desc" }).slice(0, 2)).toEqual(["d@x.com", "a@x.com"]);
  });
});

describe("os 15 anúncios que mais faturam e o diagnóstico de e-mail (GER-01)", () => {
  it("são os 15 de maior faturamento do recorte, com o dono, o numeric como texto ordenado como número", () => {
    const regs = [reg("a@x.com"), reg("b@x.com")];
    const produtos = Array.from({ length: 18 }, (_, i) => prod(i % 2 ? "a@x.com" : "b@x.com", `P${i}`, i === 3 ? "9.5" : i === 5 ? null : i * 10));
    const base = linhasAnalise({ mentorados: [], stlseller: regs, stlPedidos: [], stlProdutos: produtos });
    const top = topAnuncios(base);
    expect(top.length).toBe(15);
    expect(top[0].p.anuncio_id).toBe("P17");
    expect(top[0].l.r.email).toBe("a@x.com");
    expect(top.map((t) => t.p.anuncio_id)).not.toContain("P5");
    expect(top.map((t) => t.p.anuncio_id)).not.toContain("P3");
    expect(topAnuncios(base.slice(0, 1)).every((t) => t.l.r.email === "a@x.com")).toBe(true);
    expect(topAnuncios([])).toEqual([]);
  });

  it("o e-mail STLFLIX vem primeiro: vale só se ele leva à loja, mesmo que o do formulário também leve", () => {
    // formulário = STLFLIX: ok.
    expect(situacaoEmail(reg("a@x.com", { email_stlflix: " A@X.com " }))).toEqual({ ok: true });
    // formulário diferente, mas o STLFLIX é o da loja: resolvido pelo STLFLIX.
    expect(situacaoEmail(reg("form@x.com", { email_stlflix: "stl@x.com", loja_email: "STL@x.com" }))).toEqual({ ok: true, resolvidoPorStlflix: true });
    // a loja foi achada pelo e-mail do formulário, mas o STLFLIX é outro: não é o da loja.
    expect(situacaoEmail(reg("a@x.com", { email_stlflix: "stl@x.com", loja_email: "a@x.com" }))).toEqual({ ok: false, motivo: "E-mail STLFLIX não é o da loja" });
    expect(situacaoEmail(reg("a@x.com", { email_stlflix: "stl@x.com", loja_id: null, loja_email: null }))).toEqual({ ok: false, motivo: "E-mail STLFLIX não encontra conta de seller" });
    for (const vazio of [null, "", "  "]) expect(situacaoEmail(reg("a@x.com", { email_stlflix: vazio })), String(vazio)).toEqual({ ok: false, motivo: "Formulário sem e-mail STLFLIX" });
  });

  it("os grupos: sem venda (loja sem pedido), sem conta, e-mail incorreto e resolvidos pelo STLFLIX", () => {
    const base = linhasAnalise({
      mentorados: [],
      stlseller: [
        reg("ok@x.com", { email_stlflix: "ok@x.com" }),
        reg("form@x.com", { email_stlflix: "stl@x.com", loja_email: "stl@x.com" }),
        reg("parado@x.com"),
        reg("sem@x.com", { loja_id: null, email_stlflix: "outro@x.com" }),
      ],
      stlPedidos: [ped("ok@x.com", "shopee", { pedidos: 1 })],
      stlProdutos: [],
    });
    const g = gruposAnalise(base);
    expect(g.semVenda.map((l) => l.r.email)).toEqual(["form@x.com", "parado@x.com"]);
    expect(g.semConta.map((l) => l.r.email)).toEqual(["sem@x.com"]);
    expect(g.emailIncorreto.map((l) => l.r.email)).toEqual(["parado@x.com", "sem@x.com"]);
    expect(g.peloStlflix.map((l) => l.r.email)).toEqual(["form@x.com"]);
  });

  it("por qual e-mail a loja foi achada", () => {
    expect(lojaPor(reg("a@x.com", { loja_id: null }))).toBeNull();
    expect(lojaPor(reg("a@x.com", { loja_email: "A@x.com" }))).toBe("e-mail do formulário");
    expect(lojaPor(reg("a@x.com", { email_stlflix: "s@x.com", loja_email: "S@x.com" }))).toBe("e-mail STLFLIX");
    expect(lojaPor(reg("a@x.com", { email_stlflix: "s@x.com", loja_email: "z@x.com" }))).toBe("z@x.com");
    expect(lojaPor(reg("a@x.com", { loja_email: null }))).toBe("—");
  });

  it("o rótulo do marketplace conhecido; o desconhecido vai cru", () => {
    expect([rotuloMarketplace("mercadolivre"), rotuloMarketplace("shopee"), rotuloMarketplace("amazon")]).toEqual(["Mercado Livre", "Shopee", "amazon"]);
  });
});
