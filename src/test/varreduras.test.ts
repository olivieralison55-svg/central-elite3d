import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";

// Varreduras estáticas: uma regra de texto proibido por teste, valendo para todo arquivo
// que entrar depois. Cada teste mostra antes que a regra pega um exemplo ruim, porque uma
// regex quebrada passaria calada num repo limpo, e só então varre o repo.

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const ESTE_ARQUIVO = "src/test/varreduras.test.ts";
const EDITOR = "src/components/modules/ficha/editor-notas.tsx";
const EVIDENCIA = ".specs/features/migracao-nextjs/evidence";
// Código é o que roda ou estiliza. Texto (.md) e binário ficam de fora: as regras proíbem
// chamar e carregar, não mencionar (o README do design system cita a Manrope).
const CODIGO = /\.(?:[cm]?[jt]sx?|css)$/;

type Regra = (texto: string, caminho: string) => string[];

const ler = (caminho: string) => readFileSync(join(RAIZ, caminho), "utf8");

// Os arquivos de código sob `pasta`, com o caminho relativo à raiz.
function codigo(pasta: string): string[] {
  return readdirSync(join(RAIZ, pasta), { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && CODIGO.test(d.name))
    .map((d) => relative(RAIZ, join(d.parentPath, d.name)));
}

// Este arquivo traz cada padrão como agulha e como exemplo ruim, então as regras de uso
// (importar, ler, chamar, carregar, inserir) não o varrem. A STACK-07 proíbe o texto em si
// e varre este arquivo também: as agulhas dela vêm em pedaços.
const SRC = codigo("src").filter((caminho) => caminho !== ESTE_ARQUIVO);

const numeroDaLinha = (texto: string, i: number) => texto.slice(0, i).split("\n").length;

// "linha: trecho" de cada casamento de `padrao` (com flag g) que `recusa` não absolve.
function achar(texto: string, padrao: RegExp, recusa: (m: RegExpExecArray) => boolean = () => true): string[] {
  return [...texto.matchAll(padrao)].filter(recusa).map((m) => `${numeroDaLinha(texto, m.index)}: ${m[0]}`);
}

function varrer(arquivos: string[], regra: Regra): string[] {
  return arquivos.flatMap((caminho) => regra(ler(caminho), caminho).map((achado) => `${caminho}:${achado}`));
}

// DATA-01
const importaSupabaseForaDaPorta: Regra = (texto, caminho) =>
  caminho.startsWith("src/lib/data/")
    ? []
    : achar(texto, /\b(?:from|import|require)\s*\(?\s*["'`]@supabase\/supabase-js(?:\/[^"'`]*)?["'`]/g);

// DATA-08. Rpc ou função com nome que não é texto literal também conta: não dá para provar que está
// na lista. A única edge function chamada pelo app é a admin-usuarios (AD-011).
const RPCS = ["experiencia_adesao", "analise_ia_mentor", "mentores_ativos", "lia_adotar_orfas", "lia_refletir_financeiro"];
const FUNCOES = ["admin-usuarios"];
const chamaBancoForaDaLista: Regra = (texto) => [
  ...achar(texto, /\.functions\.invoke\(\s*(?:(["'`])([^"'`]*)\1)?/g, (m) => !FUNCOES.includes(m[2] ?? "")),
  ...achar(texto, /\.rpc\(\s*(?:(["'`])([^"'`]*)\1)?/g, (m) => !RPCS.includes(m[2] ?? "")),
];

// STACK-05. Acesso por colchete também conta: lê qualquer nome.
const VARIAVEIS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
const leOutraVariavel: Regra = (texto) =>
  achar(texto, /process\.env(?:\.(\w+))?/g, (m) => !VARIAVEIS.includes(m[1] ?? ""));

// STACK-07
const SEGREDOS = ["sb_sec" + "ret_", "service" + "_role", "SUPABASE_SERVICE" + "_ROLE_KEY"];
const citaSegredo: Regra = (texto) => SEGREDOS.flatMap((segredo) => achar(texto, new RegExp(segredo, "g")));

// STACK-08
const carregaDeOutraOrigem: Regra = (texto) => [
  // `i` pega também o <Script> do next/script.
  ...achar(texto, /<script\b[^>]*?\bsrc\s*=\s*\{?\s*["'`](?:https?:)?\/\//gi),
  // Sem `i`: o <Link> do next/link é navegação, não folha de estilo.
  ...achar(texto, /<link\b[^>]*?\bhref\s*=\s*\{?\s*["'`](?:https?:)?\/\//g),
  ...achar(texto, /fonts\.googleapis/g),
];

// TEST-03. ponytail: confere a linha, não o caminho do valor (`sanitizarNota(a) + b` passa);
// subir para uma análise do AST se o editor precisar de mais que uma inserção por linha.
const insereHtml: Regra = (texto, caminho) =>
  achar(
    texto,
    /dangerouslySetInnerHTML|\.(?:inner|outer)HTML\s*\+?=(?!=)|insertAdjacentHTML|createContextualFragment|execCommand\(\s*["'`]insertHTML/g,
    (m) => caminho !== EDITOR || !texto.split("\n")[numeroDaLinha(texto, m.index) - 1].includes("sanitizarNota("),
  );

// UI-02: hexa (menos entidade HTML como &#8212;), rgb(, rgba( e a paleta padrão do Tailwind.
// `marca.css` é onde o projeto define os tokens da marca (AD-009): lá o hexa é a definição.
const usaCorCrua: Regra = (texto, caminho) =>
  /^src\/(?:components\/modules|app)\//.test(caminho) && caminho !== "src/app/marca.css"
    ? achar(
        texto,
        /(?<!&)#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\brgba?\(|\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/g,
      )
    : [];

// UI-03
const carregaOutraFonte: Regra = (texto) => achar(texto, /next\/font\/google|manrope/gi);

// UI-05: só chamada. Método de outro objeto (`dialogo.confirm(`) e menção sem parêntese não contam.
const chamaDialogoNativo: Regra = (texto) =>
  achar(texto, /\b(?:window|globalThis|self)\.(?:confirm|prompt|alert)\s*\(|(?<![\w$.])(?:confirm|prompt|alert)\s*\(/g);
// O UI-05 fala do app. Teste e fixture carregam como dado os vetores que a própria spec
// escreve com `alert(1)` (SEC-01, SEC-05, TEST-02), então ficam fora desta regra.
const ehTeste = (caminho: string) => caminho.startsWith("src/test/") || /\.test\.tsx?$/.test(caminho);

// GATE-03
const NA_EVIDENCIA: Array<[string, RegExp]> = [
  ["Authorization", /authorization/i],
  ["/auth/v1/", /\/auth\/v1\//],
  ["refresh_token", /refresh_token/],
  ["JWT", /eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*/],
];

// "arquivo: motivo" de cada evidência com HAR, credencial ou JWT. Sem a pasta, que só nasce
// no primeiro gate, não há o que acusar.
function varrerEvidencia(pasta: string): string[] {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .flatMap((d) => {
      const caminho = join(d.parentPath, d.name);
      const texto = readFileSync(caminho, "utf8");
      const har = /\.har$/i.test(d.name) || /"log"\s*:\s*\{[\s\S]*"entries"\s*:/.test(texto);
      const motivos = [...(har ? ["HAR"] : []), ...NA_EVIDENCIA.filter(([, p]) => p.test(texto)).map(([nome]) => nome)];
      return motivos.map((motivo) => `${relative(pasta, caminho)}: ${motivo}`);
    });
}

const esquemaPacote = z.object({
  packageManager: z.string().optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  pnpm: z.object({ onlyBuiltDependencies: z.array(z.string()).optional() }).optional(),
});
type Pacote = z.infer<typeof esquemaPacote>;
const PACOTE = esquemaPacote.parse(JSON.parse(ler("package.json")));

// SEC-07: pnpm com versão exata (o hash do corepack é opcional) e a lista de scripts de instalação.
function conferirPnpm(pacote: Pacote): string[] {
  const problemas: string[] = [];
  if (!/^pnpm@\d+\.\d+\.\d+(?:\+sha\d+\.[0-9a-f]+)?$/.test(pacote.packageManager ?? "")) {
    problemas.push(`packageManager: ${pacote.packageManager}`);
  }
  if (!pacote.pnpm?.onlyBuiltDependencies) problemas.push("pnpm.onlyBuiltDependencies ausente");
  return problemas;
}

describe("varreduras estáticas", () => {
  it("as varreduras leem todo arquivo de código de src/, e não .md nem binário", () => {
    const amostra = [
      "src/app/layout.tsx",
      "src/app/globals.css",
      "src/lib/data/config.ts",
      "src/components/ui/confirm-dialog.tsx",
      "src/design-system/tokens.ts",
      "src/test/theme-init.test.ts",
    ];
    expect(SRC).toEqual(expect.arrayContaining(amostra));
    expect(SRC).not.toContain("src/design-system/README.md");
    expect(SRC).not.toContain("src/public/fonts/InterVariable.woff2");
  });

  it("DATA-01: nenhum import de @supabase/supabase-js fora de src/lib/data/", () => {
    const ruim = 'import { createClient } from "@supabase/supabase-js";\nconst m = await import("@supabase/supabase-js");';
    expect(importaSupabaseForaDaPorta(ruim, "src/components/modules/x.tsx")).toHaveLength(2);
    expect(importaSupabaseForaDaPorta(ruim, "src/lib/data/cliente.ts")).toEqual([]);
    expect(varrer(SRC, importaSupabaseForaDaPorta)).toEqual([]);
  });

  it("DATA-08: edge function só a admin-usuarios, e .rpc( só com as 5 rpcs da lista", () => {
    const ruim = 'db.functions.invoke("lia-webhook");\ndb.functions.invoke(nome);\ndb.rpc("outra_rpc");\ndb.rpc(nome);';
    expect(chamaBancoForaDaLista(ruim, "x.ts")).toHaveLength(4);
    expect(chamaBancoForaDaLista('db.functions.invoke("admin-usuarios", {});', "x.ts")).toEqual([]);
    expect(chamaBancoForaDaLista(RPCS.map((rpc) => `db.rpc("${rpc}", {});`).join("\n"), "x.ts")).toEqual([]);
    expect(varrer(SRC, chamaBancoForaDaLista)).toEqual([]);
  });

  it("STACK-05: process.env só com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", () => {
    const ruim = 'process.env.NODE_ENV;\nprocess.env["NEXT_PUBLIC_SUPABASE_URL"];';
    expect(leOutraVariavel(ruim, "x.ts")).toHaveLength(2);
    expect(leOutraVariavel(VARIAVEIS.map((v) => `process.env.${v};`).join("\n"), "x.ts")).toEqual([]);
    expect(varrer(SRC, leOutraVariavel)).toEqual([]);
  });

  it("STACK-07: nenhum dos três textos de chave secreta em src/ nem no next.config.ts", () => {
    expect(citaSegredo(SEGREDOS.join("\n"), "x.ts")).toHaveLength(3);
    expect(varrer([...codigo("src"), "next.config.ts"], citaSegredo)).toEqual([]);
  });

  it("STACK-08: nada carregado de outra origem, supabase-js e dompurify exatos, sem chart.js", () => {
    // Como as linhas 11–14 do index.html de hoje, mais o <Script> do next/script.
    const ruim = [
      '<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">',
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
      '<Script strategy="beforeInteractive" src="//cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.6/purify.min.js" />',
    ].join("\n");
    expect(carregaDeOutraOrigem(ruim, "x.tsx")).toHaveLength(4);
    expect(varrer(SRC, carregaDeOutraOrigem)).toEqual([]);
    expect([PACOTE.dependencies?.["@supabase/supabase-js"], PACOTE.dependencies?.dompurify]).toEqual(["2.117.3", "3.2.6"]);
    expect(Object.keys({ ...PACOTE.dependencies, ...PACOTE.devDependencies })).not.toContain("chart.js");
  });

  it("TEST-03: HTML inserido só no editor de notas, e só com sanitizarNota(", () => {
    const ruim = [
      "el.innerHTML = nota;",
      "el.outerHTML += trecho;",
      "<div dangerouslySetInnerHTML={{ __html: nota }} />",
      "intervalo.createContextualFragment(nota);",
      'el.insertAdjacentHTML("beforeend", nota);',
      'document.execCommand("insertHTML", false, nota);',
    ].join("\n");
    expect(insereHtml(ruim, "src/components/modules/x.tsx")).toHaveLength(6);
    expect(insereHtml(ruim, EDITOR)).toHaveLength(6);
    const limpo = "el.innerHTML = sanitizarNota(nota);\nif (el.innerHTML === antes) {}";
    expect(insereHtml(limpo, EDITOR)).toEqual([]);
    expect(insereHtml(limpo, "src/components/modules/x.tsx")).toHaveLength(1);
    expect(varrer(SRC, insereHtml)).toEqual([]);
  });

  it("GATE-03: nenhuma evidência com HAR, Authorization, /auth/v1/, refresh_token ou JWT", () => {
    expect(varrerEvidencia(join(RAIZ, EVIDENCIA))).toEqual([]);

    const pasta = mkdtempSync(join(tmpdir(), "evidencia-"));
    try {
      const base64url = (valor: object) => Buffer.from(JSON.stringify(valor)).toString("base64url");
      const arquivos = {
        "G2.md": "sha 8e64212 · exit=0 · 80 testes",
        "rede.har": "{}",
        "rede.json": '{"log": {"version": "1.2", "entries": []}}',
        "G3-cabecalho.md": "authorization: Bearer x",
        "G3-login.md": "POST /auth/v1/token",
        "G3-sessao.md": '{"refresh_token": "x"}',
        "G3-token.md": `token ${base64url({ alg: "HS256" })}.${base64url({ role: "anon" })}.assinatura`,
      };
      for (const [nome, texto] of Object.entries(arquivos)) writeFileSync(join(pasta, nome), texto);
      expect(varrerEvidencia(pasta).sort()).toEqual(
        [
          "rede.har: HAR",
          "rede.json: HAR",
          "G3-cabecalho.md: Authorization",
          "G3-login.md: /auth/v1/",
          "G3-sessao.md: refresh_token",
          "G3-token.md: JWT",
        ].sort(),
      );
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it("SEC-07: packageManager com a versão exata do pnpm e pnpm.onlyBuiltDependencies presente", () => {
    expect(conferirPnpm({ packageManager: "pnpm@^9.9.0" })).toHaveLength(2);
    expect(conferirPnpm(PACOTE)).toEqual([]);
  });

  it("UI-02: nenhum hexa, rgb(, rgba( ou paleta padrão do Tailwind em src/components/modules/ e src/app/", () => {
    const ruim = '<div className="bg-gray-500 text-[#ff0000] border-blue-600/50" style={{ color: "rgba(0, 0, 0, .5)" }} />';
    expect(usaCorCrua(ruim, "src/components/modules/x.tsx")).toHaveLength(4);
    expect(usaCorCrua(ruim, "src/app/x/page.tsx")).toHaveLength(4);
    expect(usaCorCrua(ruim, "src/components/ui/x.tsx")).toEqual([]);
    expect(usaCorCrua(ruim, "src/app/marca.css")).toEqual([]);
    expect(usaCorCrua(ruim, "src/app/globals.css")).toHaveLength(4);
    expect(varrer(SRC, usaCorCrua)).toEqual([]);
  });

  it("UI-09: nenhum emoji em src/components/modules nem em src/components/shell, fora dos testes", () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu;
    const regra: Regra = (texto, caminho) =>
      /^src\/components\/(?:modules|shell)\//.test(caminho) && !/\.test\.tsx?$/.test(caminho) ? achar(texto, emoji) : [];
    expect(regra("<span>🟢 ok ✓ ❝ ⚠️</span>", "src/components/modules/x.tsx")).toHaveLength(5);
    expect(regra("<span>🟢</span>", "src/components/modules/x.test.tsx")).toEqual([]);
    expect(regra("<span>🟢</span>", "src/lib/marcador.ts")).toEqual([]);
    expect(varrer(SRC, regra)).toEqual([]);
  });

  it("UI-03: nenhum next/font/google nem Manrope", () => {
    const ruim = 'import { Manrope } from "next/font/google";\n.titulo { font-family: "manrope", sans-serif; }';
    expect(carregaOutraFonte(ruim, "x.tsx")).toHaveLength(3);
    expect(varrer(SRC, carregaOutraFonte)).toEqual([]);
  });

  it("UI-05: nenhuma chamada a window.confirm, window.prompt, window.alert, confirm(, prompt( ou alert( no código do app", () => {
    const ruim = 'if (window.confirm("Excluir?")) {}\nconst nome = prompt("Nome");\nalert ("feito");\nglobalThis.alert(1);';
    expect(chamaDialogoNativo(ruim, "x.tsx")).toHaveLength(4);
    const permitido = "onConfirm(); dialogo.confirm(); reconfirm(); // o window.confirm não serve";
    expect(chamaDialogoNativo(permitido, "x.tsx")).toEqual([]);
    expect(["src/test/fixtures.ts", "src/lib/endereco.test.ts", "src/components/modules/x.tsx", "src/lib/endereco.ts"].filter(ehTeste)).toEqual([
      "src/test/fixtures.ts",
      "src/lib/endereco.test.ts",
    ]);
    expect(varrer(SRC.filter((caminho) => !ehTeste(caminho)), chamaDialogoNativo)).toEqual([]);
  });
});
