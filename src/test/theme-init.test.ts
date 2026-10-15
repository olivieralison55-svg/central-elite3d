import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT = readFileSync(join(RAIZ, "public/theme-init.js"), "utf8");

// O que o ThemeToggle gravou na chave "theme" (src/components/ui/theme-toggle.tsx),
// ou um erro quando o browser bloqueia o storage.
type Salvo = "dark" | "light" | null | Error;

// Roda o script como o <head> roda, com storage, matchMedia e classList falsos,
// e diz se a página abriu no tema escuro.
function abreEscuro(salvo: Salvo, sistemaEscuro: boolean): boolean {
  const classes = new Set<string>();
  const contexto: Record<string, unknown> = {
    localStorage: {
      getItem(chave: string) {
        if (salvo instanceof Error) throw salvo;
        return chave === "theme" ? salvo : null;
      },
    },
    matchMedia: (consulta: string) => ({ matches: sistemaEscuro && /prefers-color-scheme:\s*dark/.test(consulta) }),
    document: {
      documentElement: {
        classList: {
          add: (...nomes: string[]) => nomes.forEach((n) => classes.add(n)),
          remove: (...nomes: string[]) => nomes.forEach((n) => classes.delete(n)),
          toggle(nome: string, ligar = !classes.has(nome)) {
            if (ligar) classes.add(nome);
            else classes.delete(nome);
            return ligar;
          },
        },
      },
    },
    console: { error: () => undefined, warn: () => undefined },
  };
  contexto.window = contexto;
  runInNewContext(SCRIPT, contexto);
  return classes.has("dark");
}

describe("tema sem flash (UI-04)", () => {
  it("preferência dark salva liga a classe dark, mesmo com o sistema claro", () => {
    expect(abreEscuro("dark", false)).toBe(true);
  });

  it("preferência light salva não liga a classe, mesmo com o sistema escuro", () => {
    expect(abreEscuro("light", true)).toBe(false);
  });

  it("sem preferência salva, inclusive com o storage bloqueado, segue o sistema", () => {
    expect(abreEscuro(null, true)).toBe(true);
    expect(abreEscuro(null, false)).toBe(false);
    const bloqueado = new Error("SecurityError");
    expect(abreEscuro(bloqueado, true)).toBe(true);
    expect(abreEscuro(bloqueado, false)).toBe(false);
  });

  it("o layout carrega /theme-init.js por <script src> dentro do <head>, sem HTML inline", () => {
    const layout = readFileSync(join(RAIZ, "src/app/layout.tsx"), "utf8");
    const head = /<head>([\s\S]*?)<\/head>/.exec(layout)?.[1] ?? "";
    expect(head).toMatch(/<script src="\/theme-init\.js"\s*\/?>/);
    // Em pedaços: o nome inteiro só pode aparecer no editor de notas (TEST-03).
    expect(layout).not.toContain("dangerously" + "SetInnerHTML");
  });
});
