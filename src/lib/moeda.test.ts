import { describe, expect, it } from "vitest";

import { fmtBRL, lerBRL, mascaraBRL } from "./moeda";

// O pt-BR do Intl separa "R$" do número com espaço não separável.
const reais = (texto: string) => `R$ ${texto}`;

describe("moeda BRL (OPS-20, grupo 'Formatadores e campo de data')", () => {
  it("fmtBRL formata em reais, com ponto de milhar e duas casas", () => {
    expect(fmtBRL(1000)).toBe(reais("1.000,00"));
    expect(fmtBRL(5000)).toBe(reais("5.000,00"));
    expect(fmtBRL(10000)).toBe(reais("10.000,00"));
    expect(fmtBRL(2000.5)).toBe(reais("2.000,50"));
  });

  it("fmtBRL sem valor imprime R$ 0,00, sem lixo; numeric que chega como texto também formata", () => {
    expect(fmtBRL(null)).toBe(reais("0,00"));
    expect(fmtBRL(undefined)).toBe(reais("0,00"));
    expect(fmtBRL("1500.5")).toBe(reais("1.500,50"));
  });

  it("OPS-20: '2000.50' vale 2000,50", () => {
    expect(mascaraBRL("2000.50", true)).toBe("R$ 2.000,50");
    expect(lerBRL("2000.50")).toBe(2000.5);
  });

  it("OPS-20: '1.234,56' vale 1234,56", () => {
    expect(mascaraBRL("1.234,56")).toBe("R$ 1.234,56");
    expect(lerBRL("1.234,56")).toBe(1234.56);
  });

  it("OPS-20: vazio vale vazio: a máscara devolve '' e a leitura devolve null, não zero", () => {
    expect(mascaraBRL("")).toBe("");
    expect(mascaraBRL("", true)).toBe("");
    expect(mascaraBRL(null, true)).toBe("");
    expect(lerBRL("")).toBeNull();
    expect(lerBRL(null)).toBeNull();
    expect(lerBRL("abc")).toBeNull();
  });

  it("mascaraBRL(v, true) fecha as casas no blur; digitando, deixa como está", () => {
    expect(mascaraBRL("2000")).toBe("R$ 2.000");
    expect(mascaraBRL("2000", true)).toBe("R$ 2.000,00");
    expect(mascaraBRL("2000,5")).toBe("R$ 2.000,5");
    expect(mascaraBRL("2000,5", true)).toBe("R$ 2.000,50");
    expect(mascaraBRL("2000.")).toBe("R$ 2.000,");
    expect(mascaraBRL("2000.", true)).toBe("R$ 2.000,00");
  });

  it("os 12 casos da máscara do teste antigo", () => {
    const casos: [string, boolean, string][] = [
      ["2000", false, "R$ 2.000"],
      ["2000", true, "R$ 2.000,00"],
      ["2000,5", true, "R$ 2.000,50"],
      ["R$ 2.000", false, "R$ 2.000"],
      ["R$ 2.0005", false, "R$ 20.005"],
      ["2000.", false, "R$ 2.000,"],
      ["2000.50", true, "R$ 2.000,50"],
      ["1234567,899", false, "R$ 1.234.567,89"],
      [",5", true, "R$ 0,50"],
      ["", true, ""],
      ["abc", true, ""],
      ["007", true, "R$ 7,00"],
    ];
    expect(casos.map(([bruto, fim]) => mascaraBRL(bruto, fim))).toEqual(casos.map(([, , esperado]) => esperado));
  });

  it("o valor do banco abre formatado no campo, e o texto da máscara volta ao número", () => {
    expect(mascaraBRL(2000.5, true)).toBe("R$ 2.000,50");
    expect(mascaraBRL(1500, true)).toBe("R$ 1.500,00");
    expect(lerBRL("R$ 2.000,50")).toBe(2000.5);
    expect(lerBRL("2000")).toBe(2000);
  });
});
