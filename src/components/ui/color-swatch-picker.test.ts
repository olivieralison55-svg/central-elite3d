import { describe, expect, it } from "vitest";

import { checkColorFor, isSwatchSelected, swatchKey, type Swatch } from "./color-swatch-picker";

/**
 * Spec: `.specs/features/carousel-slide-color/spec.md`, COLOR-13.
 *
 * A razão de `value` existir está no último teste: dois papéis de paleta podem
 * resolver para a mesma cor num tema pouco contrastado, e comparar por cor
 * marcaria os dois como selecionados, deixando um inalcançável.
 */

const byColour: Swatch = { hex: "#101a10", label: "Fundo" };
const byValue: Swatch = { hex: "#101a10", label: "Fundo do tema", value: "background" };

describe("swatchKey", () => {
  it("é a cor quando a amostra não tem valor", () => {
    expect(swatchKey(byColour)).toBe("#101a10");
  });

  it("é o valor quando ela tem", () => {
    expect(swatchKey(byValue)).toBe("background");
  });
});

describe("isSwatchSelected", () => {
  it("compara por cor, sem diferenciar maiúscula, quando não há valor", () => {
    expect(isSwatchSelected(byColour, "#101A10")).toBe(true);
    expect(isSwatchSelected(byColour, "#000000")).toBe(false);
  });

  it("compara por valor quando a amostra tem um", () => {
    expect(isSwatchSelected(byValue, "background")).toBe(true);
    // A cor certa com o papel errado NÃO seleciona: é o papel que manda.
    expect(isSwatchSelected(byValue, "#101a10")).toBe(false);
  });

  it("nada está selecionado quando o valor é nulo", () => {
    expect(isSwatchSelected(byColour, null)).toBe(false);
    expect(isSwatchSelected(byValue, null)).toBe(false);
  });

  it("dois papéis com a mesma cor não colidem", () => {
    const surface: Swatch = { hex: "#101a10", label: "Superfície", value: "surface" };
    expect(swatchKey(byValue)).not.toBe(swatchKey(surface));
    expect(isSwatchSelected(byValue, "surface")).toBe(false);
    expect(isSwatchSelected(surface, "surface")).toBe(true);
  });
});

/**
 * O "check" era um literal quase-preto (`#1c1c1f`) e sumia em cima de toda
 * amostra escura — inclusive a do acento `#0f36d2`, que é uma cor de marca
 * comum, não um caso raro. O anel de seleção sozinho não resolve num chip de
 * 28 px.
 */
describe("checkColorFor", () => {
  it("é branco sobre amostra escura", () => {
    expect(checkColorFor("#0f36d2")).toBe("#ffffff");
    expect(checkColorFor("#101a10")).toBe("#ffffff");
    expect(checkColorFor("#000000")).toBe("#ffffff");
  });

  it("é quase-preto sobre amostra clara", () => {
    expect(checkColorFor("#f4f6ff")).toBe("#1c1c1f");
    expect(checkColorFor("#ffffff")).toBe("#1c1c1f");
  });

  it("herda a cor do texto na amostra sem cor", () => {
    // `transparent` não é hex: o chip do automático desenha o contorno e a
    // barra na cor do próprio painel, e o check acompanha.
    expect(checkColorFor("transparent")).toBe("currentColor");
    expect(checkColorFor("")).toBe("currentColor");
  });

  it("aceita maiúscula e espaço em volta", () => {
    expect(checkColorFor("  #F4F6FF ")).toBe("#1c1c1f");
  });
});
