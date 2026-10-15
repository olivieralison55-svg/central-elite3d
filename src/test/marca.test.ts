import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AD-009: a cor primária é o verde da Elite 3D, sobreposta em arquivo do projeto, nunca na cópia do DS.

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}${rel}`, "utf8");
const CSS = ler("src/app/marca.css");
const CONFIG = ler("tailwind.config.ts");

// Contraste WCAG entre dois hex #rrggbb.
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

describe("marca verde da Elite 3D (AD-009)", () => {
  it("o verde e o lima do hover entram em variáveis com canal alpha, depois do import dos tokens", () => {
    expect(CSS.indexOf("--primary-rgb: 185 255 70")).toBeGreaterThan(CSS.indexOf('@import "../design-system/tokens.css"'));
    expect(CSS).toContain("--primary-dark-rgb: 159 226 47");
    expect(CONFIG).toContain('"rgb(var(--primary-rgb) / <alpha-value>)"');
    expect(CONFIG).toContain('"rgb(var(--primary-dark-rgb) / <alpha-value>)"');
    // O override vem depois do spread: o azul literal do DS não volta.
    expect(CONFIG).toMatch(/\.\.\.tailwindColors,\s*primary: primaria,\s*"primary-dark": primariaEscura/);
  });

  it("texto, borda, anel e contorno em primary usam a cor sobre o fundo: verde escuro no claro, lima no escuro", () => {
    expect(CONFIG).toMatch(/textColor: \{ primary: primariaSobreFundo \}/);
    expect(CONFIG).toMatch(/borderColor: \{ primary: primariaSobreFundo \}/);
    expect(CONFIG).toMatch(/ringColor: \{ primary: primariaSobreFundo \}/);
    expect(CONFIG).toMatch(/outlineColor: \{ primary: primariaSobreFundo \}/);
    expect(CSS).toContain("--primary-ink-rgb: 63 98 18");
    expect(CSS).toMatch(/\.dark \{[^}]*--primary-ink-rgb: 185 255 70/);
    for (const fundo of ["#ffffff", "#f5f6f8", "#e6e8ec"]) expect(contraste("#3f6212", fundo)).toBeGreaterThanOrEqual(4.5);
  });

  it("branco sobre lima vira grafite, e o hover em primary-dark também", () => {
    expect(CSS).toMatch(/\.bg-primary\.text-white,\s*\.hover\\:bg-primary-dark\.text-white:hover \{\s*color: #10141a;/);
    expect(contraste("#10141a", "#b9ff46")).toBeGreaterThanOrEqual(4.5);
    expect(contraste("#10141a", "#9fe22f")).toBeGreaterThanOrEqual(4.5);
    expect(contraste("#ffffff", "#b9ff46")).toBeLessThan(3);
  });
});

describe("a marca sobrevive à sincronização do DS (AD-009)", () => {
  it("o layout importa marca.css depois do globals.css, e o globals.css da cópia não carrega a marca", () => {
    const layout = ler("src/app/layout.tsx");
    const globals = layout.indexOf('import "./globals.css";');
    const marca = layout.indexOf('import "./marca.css";');
    expect(globals).toBeGreaterThanOrEqual(0);
    expect(marca).toBeGreaterThan(globals);
    expect(ler("src/app/globals.css")).not.toContain("185 255 70");
  });
});
