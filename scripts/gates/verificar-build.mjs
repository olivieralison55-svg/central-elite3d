/* Conferência do build (G2.3 e G2.4; GATE-11, GATE-12).
 *
 *   node scripts/gates/verificar-build.mjs [pasta-do-build]   # padrão: .next
 *
 * GATE-11: em `.next/static` e `.next/server/app`, nenhum valor `sb_secret_…`
 * e nenhum JWT cujo payload decodificado tenha `role` diferente de `anon` (a
 * chave publicável do Supabase é JWT `anon`, e pode ir para o bundle). A palavra
 * solta, sem valor depois, não é segredo: é o texto de uma regra.
 * GATE-12: a classe `__variable_…` do `<html>` do HTML do servidor existe no
 * CSS de `.next/static/css`; sem ela a página cai na fonte serifada.
 *
 * Imprime arquivo e motivo, nunca o valor achado. Sai com 1 se algo falhar.
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Um valor depois do prefixo: a chave secreta tem dezenas de caracteres.
const SEGREDO = /sb_secret_[A-Za-z0-9_-]{8,}/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const TEXTO = /\.(?:js|mjs|cjs|json|html|rsc|css|txt|map|body|meta)$/;

/**
 * Os arquivos de texto sob `pasta`, recursivo. Pasta ausente não tem o que achar.
 * @param {string} pasta
 * @returns {string[]}
 */
function arquivos(pasta) {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && TEXTO.test(d.name))
    .map((d) => join(d.parentPath, d.name));
}

/**
 * O `role` do payload de um JWT, ou null se ele não decodifica.
 * @param {string} jwt
 * @returns {string | null}
 */
export function papelDoJwt(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch (erro) {
    // Payload que não é JSON não é JWT de ninguém.
    if (erro instanceof SyntaxError) return null;
    throw erro;
  }
}

/**
 * GATE-11: "arquivo: motivo" de cada segredo achado.
 * @param {string} build a pasta `.next`
 * @returns {string[]}
 */
export function segredosNoBuild(build) {
  return ["static", "server/app"].flatMap((sub) =>
    arquivos(join(build, sub)).flatMap((arquivo) => {
      const texto = readFileSync(arquivo, "utf8");
      const onde = relative(build, arquivo);
      const achados = [...texto.matchAll(SEGREDO)].map(() => `${onde}: valor sb_secret_`);
      for (const [jwt] of texto.matchAll(JWT)) {
        const papel = papelDoJwt(jwt);
        if (papel !== null && papel !== "anon") achados.push(`${onde}: JWT com role ${papel}`);
      }
      return achados;
    }),
  );
}

/**
 * GATE-12: as classes `__variable_` do `<html>` dos HTML do servidor e se cada
 * uma aparece no CSS de `.next/static/css`.
 * @param {string} build
 * @returns {{ classes: string[], faltando: string[] }}
 */
export function classeDaFonte(build) {
  const classes = [
    ...new Set(
      arquivos(join(build, "server/app"))
        .filter((a) => a.endsWith(".html"))
        .flatMap((a) => [...(readFileSync(a, "utf8").match(/<html\b[^>]*\bclass="([^"]*)"/)?.[1] ?? "").split(/\s+/)].filter((c) => c.startsWith("__variable_"))),
    ),
  ];
  const css = arquivos(join(build, "static/css"))
    .filter((a) => a.endsWith(".css"))
    .map((a) => readFileSync(a, "utf8"))
    .join("\n");
  return { classes, faltando: classes.filter((c) => !css.includes(`.${c}`)) };
}

/**
 * @param {string} build
 * @returns {{ problemas: string[], classes: string[] }}
 */
export function verificar(build) {
  const { classes, faltando } = classeDaFonte(build);
  const problemas = [
    ...segredosNoBuild(build),
    ...(classes.length ? [] : ["nenhuma classe __variable_ no <html> dos HTML de server/app"]),
    ...faltando.map((c) => `classe ${c} do <html> ausente do CSS de static/css`),
  ];
  return { problemas, classes };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const build = process.argv[2] ?? ".next";
  if (!existsSync(build)) {
    console.error(`${build} não existe: rode pnpm build antes`);
    process.exit(2);
  }
  const { problemas, classes } = verificar(build);
  for (const p of problemas) console.error(p);
  console.log(problemas.length ? `${problemas.length} problema(s)` : `ok: sem segredo; ${classes.join(", ")} no CSS`);
  process.exit(problemas.length ? 1 : 0);
}
