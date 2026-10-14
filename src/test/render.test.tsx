import { describe, expect, it } from "vitest";

import {
  type Navegador,
  UI_INICIAL,
  useDados,
  useNavegar,
  useSessao,
  useUi,
  type ValorDados,
  type ValorSessao,
  type ValorUi,
} from "@/components/shell/contexto";

import { datasetDeTeste, XSS } from "./fixtures";
import { navegadorFalso, renderTela } from "./render";

interface Visto {
  sessao: ValorSessao;
  dados: ValorDados;
  ui: ValorUi;
  navegar: Navegador;
}

// Lê os quatro contextos durante o render e guarda o que achou.
function sondar() {
  const visto: { valor?: Visto } = {};
  function Sonda() {
    visto.valor = { sessao: useSessao(), dados: useDados(), ui: useUi(), navegar: useNavegar() };
    return null;
  }
  return { visto, Sonda };
}

const ids = (linhas: ReadonlyArray<Readonly<Record<string, unknown>>>, chave = "id") => linhas.map((linha) => linha[chave]);

describe("renderTela e fixtures (TEST-02, STACK-02)", () => {
  it("renderTela entrega às telas os quatro valores: sessão do papel, dados, ui e navegação", () => {
    const { visto, Sonda } = sondar();
    const dados = datasetDeTeste();
    const navegar = navegadorFalso("/sessoes");
    expect(renderTela(<Sonda />, { papel: "mentor", dados, ui: { voltarPara: "/sessoes" }, navegar })).toBe("");

    expect(visto.valor?.sessao.papel).toBe("mentor");
    expect(visto.valor?.sessao.perfil.role).toBe("mentor");
    expect([visto.valor?.sessao.pode("escreverSessao"), visto.valor?.sessao.pode("verFinanceiro")]).toEqual([true, false]);
    expect(visto.valor?.dados.dados).toBe(dados);
    expect(visto.valor?.dados.erros).toEqual({});
    expect(visto.valor?.ui.ui).toEqual({ ...UI_INICIAL, voltarPara: "/sessoes" });
    expect(visto.valor?.navegar).toBe(navegar);
    expect(visto.valor?.navegar.caminho).toBe("/sessoes");
  });

  it("o stub de navegação registra ir e substituir", () => {
    const { visto, Sonda } = sondar();
    const navegar = navegadorFalso();
    renderTela(<Sonda />, { papel: "admin", navegar });
    visto.valor?.navegar.ir("/mentorado/m1/financeiro");
    visto.valor?.navegar.substituir("/dash");
    expect(navegar.chamadas).toEqual([
      ["ir", "/mentorado/m1/financeiro"],
      ["substituir", "/dash"],
    ]);
  });

  it("fixtures.ts monta um Dataset com os registros de tests/ambiente.mjs, o XSS nos nomes de m3 e m4", () => {
    const d = datasetDeTeste();
    expect(ids(d.mentorados)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(d.mentorados.filter((m) => String(m.nome).includes("<img src=x onerror=alert(1)>")).map((m) => m.id)).toEqual(["m3", "m4"]);
    expect(XSS).toBe('"><img src=x onerror=alert(1)>');
    expect(ids(d.sessoes)).toEqual(["s1", "s2", "s3", "s4", "s5", "g1", "g2", "g3", "g4", "g5"]);
    expect(ids(d.parcelas)).toEqual(["p1", "p2", "p3"]);
    expect([ids(d.rotas), ids(d.marcos), ids(d.canais), ids(d.faturamento)]).toEqual([["r1"], ["mk1", "mk2"], ["c1"], ["f1", "f2"]]);
    expect([ids(d.mentoradoMarcos, "marco_id"), ids(d.mentoradoCanais, "canal_id")]).toEqual([["mk1"], ["c1"]]);
    expect(ids(d.cobrancas, "lia_bill_id")).toEqual(["orf1", "orf2", "ok1", "desc1"]);
    expect(ids(d.stlseller, "email")).toEqual(["ana.clara@exemplo.com", "outro@exemplo.com", "form.eva@exemplo.com"]);
    expect([ids(d.stlPedidos, "marketplace"), ids(d.stlProdutos, "anuncio_id")]).toEqual([["mercadolivre"], ["MLB1", "SP1"]]);
    expect(ids(d.nps)).toEqual(["n1", "n2", "n3", "n4"]);
    expect(ids(d.experiencia, "origem_id")).toEqual(["sheet:a", "sheet:b"]);
    expect(d.analise?.resumo).toBe("Resumo " + XSS);
  });
});
