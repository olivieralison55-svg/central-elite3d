import { describe, expect, it } from "vitest";

import { alvoBuscaData, casaBusca, chaveNome } from "./busca";

// s1 do teste antigo: Ana Clara, Diagnóstico de Negócio, 01/02/2026 às 10:00, com o Evaldo.
const s1 = ["Ana Clara", "Diagnóstico de Negócio", "Evaldo", alvoBuscaData("2026-02-01", "10:00:00")];

describe("busca sem caixa, sem acento e por partes (OPS-10, grupo 'Busca e botão de criar')", () => {
  it("ignora caixa", () => {
    expect(casaBusca("ana", "Ana Clara")).toBe(true);
    expect(casaBusca("ANA CLARA", "ana clara")).toBe(true);
  });

  it("ignora acento nos dois lados", () => {
    expect(casaBusca("jose", "José Antônio")).toBe(true);
    expect(casaBusca("josé", "Jose Antonio")).toBe(true);
    expect(casaBusca("diagnostico", "Diagnóstico de Negócio")).toBe(true);
  });

  it("casa por partes, fora de ordem e espalhadas pelos campos; toda parte precisa casar", () => {
    expect(casaBusca("silva ana", "Ana Paula da Silva")).toBe(true);
    expect(casaBusca("bruno michelle", "Bruno Dias", "Michelle")).toBe(true);
    expect(casaBusca("bruno luan", "Bruno Dias", "Michelle")).toBe(false);
  });

  it("termo vazio, só espaço ou nulo não filtra nada", () => {
    expect(casaBusca("", "qualquer")).toBe(true);
    expect(casaBusca("   ", "qualquer")).toBe(true);
    expect(casaBusca(null, "qualquer")).toBe(true);
  });

  it("não casa quem não tem o termo, e campo nulo não vira o texto 'null'", () => {
    expect(casaBusca("bruno", "Ana Clara")).toBe(false);
    expect(casaBusca("null", null, undefined)).toBe(false);
  });
});

describe("busca por data (OPS-10, grupo 'Busca por data')", () => {
  it("a data casa nos 4 formatos, e a hora também", () => {
    for (const termo of ["01/02", "01/02/2026", "02/2026", "2026-02-01", "10:00"]) {
      expect(casaBusca(termo, ...s1), termo).toBe(true);
    }
  });

  it("data de outro dia não casa, e sem hora a busca pela hora não casa", () => {
    expect(casaBusca("31/12/2099", ...s1)).toBe(false);
    expect(casaBusca("06/08/2026", ...s1)).toBe(false);
    expect(casaBusca("01/02/2026", "Bruno Dias", alvoBuscaData("2026-08-06", "19:00:00"))).toBe(false);
    expect(casaBusca("10:00", "Ana Clara", alvoBuscaData("2026-02-01"))).toBe(false);
  });

  it("sessão sem data tem alvo vazio e não entra por acaso numa busca de data", () => {
    expect(alvoBuscaData(null, null)).toBe("");
    expect(casaBusca("01/02", "Checkup 1", alvoBuscaData(null, null))).toBe(false);
  });
});

describe("chaveNome da exclusão (OPS-11)", () => {
  it("compara sem caixa, sem acento e sem espaço sobrando", () => {
    expect(chaveNome("  José   da  SILVA ")).toBe("jose da silva");
    expect(chaveNome("ana  clara ")).toBe(chaveNome("Ana Clara"));
    expect(chaveNome(null)).toBe("");
  });

  it("nome incompleto ou diferente não confirma", () => {
    expect(chaveNome("Ana")).not.toBe(chaveNome("Ana Clara"));
    expect(chaveNome("Ana Clara Silva")).not.toBe(chaveNome("Ana Clara"));
    expect(chaveNome("Anaclara")).not.toBe(chaveNome("Ana Clara"));
  });
});
