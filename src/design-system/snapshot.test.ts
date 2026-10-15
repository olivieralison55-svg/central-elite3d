import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PACOTES, hashGit, lerSnapshot } from "../../scripts/sync-design-system.mjs";

type Snapshot = ReturnType<typeof lerSnapshot>;

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const SNAPSHOT = lerSnapshot(readFileSync(join(RAIZ, "src/design-system/SNAPSHOT"), "utf8"));

// Arquivos deste repo dentro das pastas copiadas.
const PROPRIOS = ["src/design-system/SNAPSHOT", "src/design-system/snapshot.test.ts"];
// Os primitivos genéricos novos em src/components/ui/ vêm da lista do AD-008. Cada item aceita o
// primitivo e o teste dele ao lado.
const AD_008 = "docs/decisions/008-lacunas-do-design-system.md";
const ITEM_DO_AD = /^- `src\/components\/ui\/[a-z0-9-]+\.tsx`$/;

// Os itens da seção "## Primitivos novos". Seção ausente, lista vazia ou item fora do formato
// reprova com o motivo, em vez de virar uma lista vazia.
function primitivosDoAd(texto: string): string[] {
  const linhas = texto.split("\n");
  const inicio = linhas.indexOf("## Primitivos novos");
  if (inicio < 0) throw new Error(`${AD_008} não tem a seção "## Primitivos novos"`);
  const fim = linhas.findIndex((linha, i) => i > inicio && linha.startsWith("## "));
  const itens = linhas.slice(inicio + 1, fim < 0 ? linhas.length : fim).filter((linha) => linha.startsWith("- "));
  const foraDoFormato = itens.filter((linha) => !ITEM_DO_AD.test(linha));
  if (foraDoFormato.length > 0) throw new Error(`${AD_008}: item fora do formato: ${foraDoFormato.join(" | ")}`);
  if (itens.length === 0) throw new Error(`${AD_008}: a lista de primitivos novos está vazia`);
  return itens.flatMap((linha) => {
    const base = linha.slice("- `".length, -".tsx`".length);
    return [`${base}.tsx`, `${base}.test.tsx`];
  });
}
// SEC-08: só um aviso high ou critical nestes três fixa versão fora da cópia.
const PODEM_TER_EXCECAO = ["next", "react", "react-dom"];

const pacoteJson = z.object({
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
});

function diferencasDeVersao(s: Snapshot, pkg: z.infer<typeof pacoteJson>): string[] {
  const fixadas = { ...pkg.dependencies, ...pkg.devDependencies };
  const diferencas: string[] = [];
  for (const pacote of s.excecoes.keys()) {
    if (!PODEM_TER_EXCECAO.includes(pacote)) diferencas.push(`${pacote}: excecao fora de next, react e react-dom`);
  }
  for (const pacote of PACOTES) {
    const esperada = s.excecoes.get(pacote)?.versao ?? s.versoes.get(pacote);
    if (esperada === undefined) diferencas.push(`${pacote}: sem versao no SNAPSHOT`);
    else if (fixadas[pacote] !== esperada) diferencas.push(`${pacote}: ${fixadas[pacote]} no package.json, ${esperada} no SNAPSHOT`);
  }
  return diferencas;
}

describe("cópia do design system (UI-01, STACK-01, SEC-08)", () => {
  it("cada arquivo do SNAPSHOT existe e bate com o hash git dele, inclusive a Inter", () => {
    expect(SNAPSHOT.blobs.has("src/public/fonts/InterVariable.woff2")).toBe(true);
    const diferentes = [...SNAPSHOT.blobs]
      .filter(([caminho, hash]) => hashGit(readFileSync(join(RAIZ, caminho))) !== hash)
      .map(([caminho]) => caminho);
    expect(diferentes).toEqual([]);
  });

  it("o package.json fixa as versões de STACK-01 do SNAPSHOT", () => {
    const pkg = pacoteJson.parse(JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8")));
    expect(diferencasDeVersao(SNAPSHOT, pkg)).toEqual([]);
  });

  it("a conferência de versões aceita a versão de uma linha excecao e recusa qualquer outra diferença", () => {
    const snapshot = (...extras: string[]) =>
      lerSnapshot([`sha ${"f".repeat(40)}`, ...PACOTES.map((p) => `versao ${p} 1.0.0`), ...extras, `blob ${"0".repeat(40)} x`].join("\n"));
    const fixadas = (mudancas: Record<string, string>) => ({
      dependencies: { ...Object.fromEntries(PACOTES.map((p) => [p, "1.0.0"])), ...mudancas },
    });
    const comExcecao = snapshot("excecao next 1.0.1 GHSA-aaaa-bbbb-cccc");

    expect(diferencasDeVersao(comExcecao, fixadas({ next: "1.0.1" }))).toEqual([]);
    expect(diferencasDeVersao(comExcecao, fixadas({}))).toEqual(["next: 1.0.0 no package.json, 1.0.1 no SNAPSHOT"]);
    expect(diferencasDeVersao(snapshot(), fixadas({ zod: "1.0.1" }))).toEqual(["zod: 1.0.1 no package.json, 1.0.0 no SNAPSHOT"]);
    expect(diferencasDeVersao(snapshot(), fixadas({ react: "^1.0.0" }))).toEqual(["react: ^1.0.0 no package.json, 1.0.0 no SNAPSHOT"]);
    expect(diferencasDeVersao(snapshot("excecao zod 1.0.1 GHSA-dddd-eeee-ffff"), fixadas({ zod: "1.0.1" }))).toEqual([
      "zod: excecao fora de next, react e react-dom",
    ]);
  });

  it("nenhum arquivo em src/design-system/ ou src/components/ui/ fica fora do SNAPSHOT, salvo os primitivos que o AD-008 lista", () => {
    // A lista reprova antes de aceitar qualquer arquivo: sem a seção, vazia (o item de outra
    // seção não conta) ou com item fora do formato.
    expect(() => primitivosDoAd("# AD-008\n\n## Decisão\n")).toThrow(/não tem a seção/);
    expect(() => primitivosDoAd("## Primitivos novos\n\nNenhum.\n\n## Por quê\n- `src/components/ui/x.tsx`\n")).toThrow(/vazia/);
    expect(() => primitivosDoAd("## Primitivos novos\n- src/components/ui/x.tsx\n")).toThrow(/fora do formato/);
    expect(() => primitivosDoAd("## Primitivos novos\n- `src/lib/x.tsx`\n")).toThrow(/fora do formato/);

    const novos = primitivosDoAd(readFileSync(join(RAIZ, AD_008), "utf8"));
    const primitivos = novos.filter((c) => !c.endsWith(".test.tsx"));
    expect(primitivos.filter((c) => !existsSync(join(RAIZ, c)))).toEqual([]);

    const locais = ["src/design-system", "src/components/ui"].flatMap((pasta) =>
      readdirSync(join(RAIZ, pasta), { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => relative(RAIZ, join(e.parentPath, e.name))),
    );
    const sobrando = locais.filter((c) => !SNAPSHOT.blobs.has(c) && !PROPRIOS.includes(c) && !novos.includes(c));
    expect(sobrando).toEqual([]);
  });
});
