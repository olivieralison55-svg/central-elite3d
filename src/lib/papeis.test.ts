import { describe, expect, it } from "vitest";

import { type Capacidade, ehPapel, itensDoMenu, pode } from "./papeis";

const TODAS: Capacidade[] = [
  "verFinanceiro",
  "verIa",
  "criarMentorado",
  "editarMentorado",
  "editarFinanceiro",
  "criarSessao",
  "excluir",
  "escreverSessao",
  "escreverRotas",
  "escreverNotas",
];

// As capacidades que `pode` concede ao papel, na ordem de TODAS.
const capacidadesDe = (papel: string | null) => TODAS.filter((cap) => pode(papel, cap));

describe("papéis e capacidades (AUTH-07, NAV-04, NAV-06, WRITE-08)", () => {
  it("admin tem as 10 capacidades", () => {
    expect(capacidadesDe("admin")).toEqual(TODAS);
  });

  it("diretoria só vê: verFinanceiro e verIa", () => {
    expect(capacidadesDe("diretoria")).toEqual(["verFinanceiro", "verIa"]);
  });

  it("mentor: escreverSessao, escreverRotas, escreverNotas e verIa", () => {
    expect(capacidadesDe("mentor")).toEqual(["verIa", "escreverSessao", "escreverRotas", "escreverNotas"]);
  });

  it("papel nulo ou fora de admin, diretoria e mentor: nenhuma capacidade e ehPapel falso", () => {
    for (const papel of [null, "", "Admin", "gestor", "constructor", "__proto__", "toString"]) {
      expect(capacidadesDe(papel), String(papel)).toEqual([]);
      expect(ehPapel(papel), String(papel)).toBe(false);
    }
    expect(ehPapel(undefined)).toBe(false);
    expect(ehPapel(1)).toBe(false);
    expect(["admin", "diretoria", "mentor"].filter(ehPapel)).toEqual(["admin", "diretoria", "mentor"]);
  });

  it("menu: os 6 itens comuns para os 3 papéis; Mentores, STLSeller, NPS e Financeiro só para admin e diretoria", () => {
    const completo = [
      ["/dash", "Dashboard"],
      ["/acompanhamento", "Acompanhamento"],
      ["/mentorados", "Mentorados"],
      ["/sessoes", "Sessões"],
      ["/rotas", "Rotas"],
      ["/mentores", "Mentores"],
      ["/analise", "STLSeller"],
      ["/nps", "NPS"],
      ["/ia", "Análise IA"],
      ["/financeiro", "Financeiro"],
    ];
    const doMenu = (papel: "admin" | "diretoria" | "mentor") => itensDoMenu(papel).map((i) => [i.caminho, i.rotulo]);
    expect(doMenu("admin")).toEqual(completo);
    expect(doMenu("diretoria")).toEqual(completo);
    expect(doMenu("mentor")).toEqual([
      ["/dash", "Dashboard"],
      ["/acompanhamento", "Acompanhamento"],
      ["/mentorados", "Mentorados"],
      ["/sessoes", "Sessões"],
      ["/rotas", "Rotas"],
      ["/ia", "Análise IA"],
    ]);
  });
});
