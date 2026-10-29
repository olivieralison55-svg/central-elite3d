import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// NAV-01 e TEST-01: o conjunto de rotas do app e o porte dos 20 grupos do harness antigo. Lê só
// `src/` e o mapeamento: continua valendo depois que a T83 apaga `tests/` e o `index.html`.

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const APP = join(RAIZ, "src/app");

// O caminho que cada page.tsx ou route.ts serve: grupo `(x)` não entra no endereço.
function rotas(): string[] {
  return readdirSync(APP, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && /^(?:page|route)\.(?:[jt]sx?|mdx?)$/.test(d.name))
    .map((d) => {
      const partes = relative(APP, d.parentPath).split(sep).filter((p) => p && !/^\(.*\)$/.test(p));
      return "/" + partes.join("/");
    })
    .sort();
}

const ROTAS = [
  "/",
  "/acompanhamento",
  "/analise",
  "/dash",
  "/faturamento",
  "/financeiro",
  "/ia",
  "/mentorado/[id]/[[...aba]]",
  "/mentorados",
  "/mentores",
  "/nps",
  "/rotas",
  "/sessoes",
  "/usuarios",
];

// A tabela de porte do design (componente 11): cada grupo do mapeamento §7 e os testes novos dele.
const TELAS = ["dashboard/dashboard", "mentorados/mentorados", "sessoes/sessoes", "rotas/rotas", "mentores/mentores", "stlseller/stlseller", "nps/nps", "ia/ia", "financeiro/financeiro", "ficha/ficha"].map(
  (t) => `src/components/modules/${t}.test.tsx`,
);
const PORTE: Record<string, string[]> = {
  "Formatadores e campo de data": ["src/lib/datas.test.ts", "src/lib/moeda.test.ts", "src/components/modules/comum/campo-moeda.test.tsx"],
  "1:1 × grupo": ["src/lib/sessoes.test.ts"],
  "Telas do admin": ["src/test/xss.test.tsx", ...TELAS],
  "Modais e telas": ["src/test/xss.test.tsx", ...TELAS],
  "Escrita do grupo": ["src/lib/data/escritas.test.ts", "src/components/modules/sessoes/grupo.test.tsx"],
  "Papel mentor": ["src/test/papeis.test.tsx", "src/lib/endereco.test.ts"],
  "Papel diretoria": ["src/test/papeis.test.tsx"],
  "Controle negativo com admin": ["src/test/papeis.test.tsx"],
  "Matriz por mentor": ["src/lib/matriz.test.ts"],
  "Alertas que focam linhas": ["src/lib/matriz.test.ts", "src/components/modules/dashboard/dashboard.foco.test.tsx"],
  "Busca e botão de criar": ["src/lib/busca.test.ts", "src/components/modules/mentorados/mentorados.test.tsx", "src/components/modules/mentorados/novo-mentorado.test.tsx"],
  Exclusão: ["src/lib/mentorados.test.ts", "src/components/modules/ficha/aba-cadastro.test.tsx"],
  "Cobrança órfã": ["src/lib/financeiro.test.ts", "src/components/modules/financeiro/financeiro.test.tsx"],
  "Ficha criada pela Lia": ["src/lib/mentorados.test.ts", "src/components/modules/ficha/aba-cadastro.test.tsx"],
  "Parcelas da Lia": ["src/lib/financeiro.test.ts", "src/components/modules/ficha/aba-financeiro.test.tsx"],
  "Etapa deduzida": ["src/lib/data/escritas.test.ts", "src/components/modules/sessoes/sessoes.test.tsx"],
  "Busca por data": ["src/lib/busca.test.ts"],
  "E-mail do mentorado": ["src/lib/mentorados.test.ts", "src/components/modules/ficha/aba-cadastro.test.tsx"],
  Rotas: ["src/lib/rotas.test.ts", "src/components/modules/rotas/rotas.test.tsx"],
  Notas: ["src/lib/notas.test.ts", "src/components/modules/ficha/editor-notas.test.tsx"],
};

// Os grupos da tabela do mapeamento §7, sem o parêntese que alguns trazem.
function gruposDoMapeamento(): string[] {
  const texto = readFileSync(join(RAIZ, "docs/planejamento/mapeamento-migracao-nextjs.md"), "utf8");
  const secao = texto.slice(texto.indexOf("\n## 7. Testes"), texto.indexOf("\n## 8."));
  return [...secao.matchAll(/^\| ([^|]+?) \| (\d+) \|/gm)].map((m) => m[1].replace(/\s*\(.*\)$/, ""));
}

describe("estrutura (NAV-01, TEST-01)", () => {
  it("NAV-01: as 14 rotas existem em src/app, e nenhuma a mais", () => {
    expect(rotas()).toEqual(ROTAS);
  });

  it("TEST-01: cada um dos 20 grupos do mapeamento §7 aponta para testes que existem e afirmam algo", () => {
    const grupos = gruposDoMapeamento();
    expect(grupos).toHaveLength(20);
    expect(Object.keys(PORTE).sort()).toEqual([...grupos].sort());
    for (const [grupo, arquivos] of Object.entries(PORTE)) {
      expect(arquivos.length, grupo).toBeGreaterThan(0);
      for (const arquivo of arquivos) {
        expect(existsSync(join(RAIZ, arquivo)), `${grupo}: ${arquivo}`).toBe(true);
        expect(readFileSync(join(RAIZ, arquivo), "utf8"), `${grupo}: ${arquivo}`).toMatch(/\bit\(\s*["'`][\s\S]*?\bexpect\(/);
      }
    }
  });
});
