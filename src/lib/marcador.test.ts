import { describe, expect, it } from "vitest";

import { casaBusca, normBusca } from "./busca";
import { separarMarcador, semMarcador } from "./marcador";

describe("marcador de situação no nome do mentorado", () => {
  it.each([
    ["🟢 Guilherme Souza", "ok", "Guilherme Souza"],
    ["🟡 Bruno Dias", "atencao", "Bruno Dias"],
    ["🟠 Carla Lima", "atencao", "Carla Lima"],
    ["🔴 Diego Alves", "risco", "Diego Alves"],
    ["⚠️ Sávio Rocha", "alerta", "Sávio Rocha"],
    ["✅ Ana Clara", "concluido", "Ana Clara"],
  ])("%s vira o marcador %s e o nome limpo", (entrada, marcador, nome) => {
    expect(separarMarcador(entrada)).toEqual({ marcador, nome });
  });

  it("emoji colado no nome, sem espaço, também sai (⚠️Sávio)", () => {
    expect(separarMarcador("⚠️Sávio Rocha")).toEqual({ marcador: "alerta", nome: "Sávio Rocha" });
    expect(separarMarcador("⚠ Sávio")).toEqual({ marcador: "alerta", nome: "Sávio" });
  });

  it("qualquer outro emoji inicial sai do texto e fica sem ícone", () => {
    expect(separarMarcador("🚀 Lia Mota")).toEqual({ marcador: null, nome: "Lia Mota" });
    expect(separarMarcador("👩🏽‍💻 Lia Mota")).toEqual({ marcador: null, nome: "Lia Mota" });
  });

  it("nome sem emoji passa intacto, e emoji no meio ou no fim não é tocado", () => {
    expect(separarMarcador("Ana Clara")).toEqual({ marcador: null, nome: "Ana Clara" });
    expect(separarMarcador("Ana 🟢 Clara")).toEqual({ marcador: null, nome: "Ana 🟢 Clara" });
    expect(separarMarcador("2ª Turma 1")).toEqual({ marcador: null, nome: "2ª Turma 1" });
  });

  it("nome só com emoji vira nome vazio; nulo vira vazio", () => {
    expect(separarMarcador("🔴")).toEqual({ marcador: "risco", nome: "" });
    expect(separarMarcador("  🔴  ")).toEqual({ marcador: "risco", nome: "" });
    expect(separarMarcador(null)).toEqual({ marcador: null, nome: "" });
    expect(semMarcador(undefined)).toBe("");
  });

  it("a busca e a chave de ordem ignoram o marcador", () => {
    expect(casaBusca("guilherme", "🟢 Guilherme Souza")).toBe(true);
    expect(casaBusca("savio", "⚠️Sávio Rocha")).toBe(true);
    expect(casaBusca("🟢", "🟢 Guilherme")).toBe(true); // termo só de emoji vira vazio: não filtra
    expect(normBusca("🔴 Zé")).toBe(normBusca("Zé"));
  });
});
