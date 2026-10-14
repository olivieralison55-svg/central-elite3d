import { describe, expect, it } from "vitest";

import { alternarOrdem, aplicarOrdem, type Ordem } from "./ordem";

interface Linha {
  nome: string;
  valor: number | null;
  data: string | null;
}

const linha = (nome: string, valor: number | null = null, data: string | null = null): Linha => ({ nome, valor, data });

const GETTERS = {
  nome: (l: Linha) => l.nome,
  valor: (l: Linha) => l.valor,
  data: (l: Linha) => l.data,
};

const ordenar = (lista: Linha[], campo: string, direcao: Ordem["direcao"]) => aplicarOrdem(lista, { campo, direcao }, GETTERS);

describe("ordenação de tabela (UI-06)", () => {
  it("a mesma coluna alterna asc → desc → asc; coluna nova, ou o primeiro clique, começa em asc", () => {
    expect(alternarOrdem(null, "nome")).toEqual({ campo: "nome", direcao: "asc" });
    expect(alternarOrdem({ campo: "nome", direcao: "asc" }, "nome")).toEqual({ campo: "nome", direcao: "desc" });
    expect(alternarOrdem({ campo: "nome", direcao: "desc" }, "nome")).toEqual({ campo: "nome", direcao: "asc" });
    expect(alternarOrdem({ campo: "nome", direcao: "desc" }, "data")).toEqual({ campo: "data", direcao: "asc" });
  });

  it("ordena texto sem caixa e sem acento, numa cópia da lista", () => {
    const lista = ["bruno", "Zé", "Álvaro", "Érica", "ana"].map((nome) => linha(nome));
    expect(ordenar(lista, "nome", "asc").map((l) => l.nome)).toEqual(["Álvaro", "ana", "bruno", "Érica", "Zé"]);
    expect(ordenar(lista, "nome", "desc").map((l) => l.nome)).toEqual(["Zé", "Érica", "bruno", "ana", "Álvaro"]);
    expect(lista.map((l) => l.nome)).toEqual(["bruno", "Zé", "Álvaro", "Érica", "ana"]);
  });

  it("ordena número como número e data AAAA-MM-DD pelo calendário", () => {
    const numeros = [10, 9, 100, 0].map((valor) => linha(`n${valor}`, valor));
    expect(ordenar(numeros, "valor", "asc").map((l) => l.valor)).toEqual([0, 9, 10, 100]);
    expect(ordenar(numeros, "valor", "desc").map((l) => l.valor)).toEqual([100, 10, 9, 0]);
    const datas = ["2026-10-01", "2025-12-31", "2026-02-15"].map((data) => linha(data, null, data));
    expect(ordenar(datas, "data", "asc").map((l) => l.data)).toEqual(["2025-12-31", "2026-02-15", "2026-10-01"]);
    expect(ordenar(datas, "data", "desc").map((l) => l.data)).toEqual(["2026-10-01", "2026-02-15", "2025-12-31"]);
  });

  it("valor nulo fica no fim nas duas direções; campo sem getter devolve a lista como veio", () => {
    const lista = [linha("a", 3), linha("b"), linha("c", 1), linha("d"), linha("e", 2)];
    expect(ordenar(lista, "valor", "asc").map((l) => l.nome)).toEqual(["c", "e", "a", "b", "d"]);
    expect(ordenar(lista, "valor", "desc").map((l) => l.nome)).toEqual(["a", "e", "c", "b", "d"]);
    expect(ordenar(lista, "inexistente", "asc").map((l) => l.nome)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
