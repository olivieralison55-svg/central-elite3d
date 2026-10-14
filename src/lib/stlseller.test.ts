import { describe, expect, it } from "vitest";

import { datasetDeTeste } from "@/test/fixtures";

import { stlsellerDe } from "./stlseller";

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
