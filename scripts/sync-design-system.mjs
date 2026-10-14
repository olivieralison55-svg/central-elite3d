/* Cópia do design system da plataforma-product-ops (AD-006, AD-007).
 *
 *   node scripts/sync-design-system.mjs <repo-da-plataforma> <sha>
 *   node scripts/sync-design-system.mjs --verificar <repo-da-plataforma>
 *
 * Lê tudo pelos objetos do git (`ls-tree`, `cat-file`), nunca pelo working tree
 * da plataforma: ele pode estar noutra branch, com trabalho não mesclado.
 * A cópia escreve os arquivos nos mesmos caminhos, o `src/app/globals.css` sem
 * o import do `report.css` e o `src/design-system/SNAPSHOT`. O `--verificar`
 * (G2.10) confere cada `blob` do SNAPSHOT contra a árvore da plataforma.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Os pacotes de STACK-01: versões iguais às do lockfile da plataforma. */
export const PACOTES = ["next", "react", "react-dom", "tailwindcss", "zod", "vitest", "lucide-react", "react-hot-toast"];

const FONTE = "src/public/fonts/InterVariable.woff2";
const RAIZES = ["src/design-system/", "src/components/ui/"];
// Pedem react-markdown, @dnd-kit e o domínio da plataforma (@/lib/sector-colors).
const FORA = ["src/components/ui/chat/", "src/components/ui/kanban.tsx", "src/components/ui/tag.tsx"];
const RELATORIO = '@import "../components/reports/report.css";';

/**
 * Hash git de um blob: sha1 de "blob <tamanho>\0" seguido dos bytes.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function hashGit(bytes) {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

/**
 * @param {string} caminho caminho no repo da plataforma
 * @returns {boolean}
 */
export function deveCopiar(caminho) {
  if (FORA.some((f) => (f.endsWith("/") ? caminho.startsWith(f) : caminho === f))) return false;
  return caminho === FONTE || RAIZES.some((r) => caminho.startsWith(r));
}

/**
 * Versão resolvida de uma dependência direta no importer raiz do pnpm-lock.yaml,
 * sem o sufixo de peers: `15.5.21(react-dom@…)` vira `15.5.21`.
 * @param {string} lockfile
 * @param {string} pacote
 * @returns {string}
 */
export function versaoResolvida(lockfile, pacote) {
  const raiz = lockfile.match(/\nimporters:\n\n {2}\.:\n((?: {4}.*\n)+)/);
  if (!raiz) throw new Error("pnpm-lock.yaml: importer raiz não encontrado");
  const nome = pacote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = raiz[1].match(new RegExp(`\\n {6}'?${nome}'?:\\n {8}specifier: .*\\n {8}version: ([^(\\s]+)`));
  if (!m) throw new Error(`pnpm-lock.yaml: ${pacote} não é dependência do importer raiz`);
  return m[1];
}

/**
 * O globals.css da plataforma sem a linha do report.css, que fica fora da cópia.
 * @param {string} css
 * @returns {string}
 */
export function semRelatorio(css) {
  const linhas = css.split("\n");
  const resto = linhas.filter((l) => l.trim() !== RELATORIO);
  if (resto.length !== linhas.length - 1) throw new Error(`globals.css: esperava uma linha ${RELATORIO}`);
  return resto.join("\n");
}

/**
 * @typedef {{ versao: string, aviso: string }} Excecao
 * @typedef {{ sha: string, versoes: Map<string, string>, blobs: Map<string, string>, excecoes: Map<string, Excecao> }} Snapshot
 */

/**
 * @param {string} texto conteúdo de src/design-system/SNAPSHOT
 * @returns {Snapshot}
 */
export function lerSnapshot(texto) {
  /** @type {Snapshot} */
  const s = { sha: "", versoes: new Map(), blobs: new Map(), excecoes: new Map() };
  for (const linha of texto.split("\n")) {
    if (linha === "") continue;
    const [tipo, a = "", b = "", ...resto] = linha.split(" ");
    if (tipo === "sha" && !s.sha && /^[0-9a-f]{40}$/.test(a) && !b) s.sha = a;
    else if (tipo === "versao" && a && b && !resto.length) s.versoes.set(a, b);
    else if (tipo === "blob" && /^[0-9a-f]{40}$/.test(a) && b) s.blobs.set([b, ...resto].join(" "), a);
    else if (tipo === "excecao" && a && b && resto.length) s.excecoes.set(a, { versao: b, aviso: resto.join(" ") });
    else throw new Error(`SNAPSHOT: linha inválida: ${linha}`);
  }
  if (!s.sha) throw new Error("SNAPSHOT: falta a linha sha");
  if (!s.blobs.size) throw new Error("SNAPSHOT: nenhuma linha blob");
  return s;
}

/**
 * Saída de `git ls-tree -r -z` como caminho → hash, só os blobs.
 * @param {string} saida
 * @returns {Map<string, string>}
 */
function lerArvore(saida) {
  const arvore = new Map();
  for (const entrada of saida.split("\0")) {
    if (!entrada) continue;
    const tab = entrada.indexOf("\t");
    const [, tipo, hash] = entrada.slice(0, tab).split(" ");
    if (tipo === "blob") arvore.set(entrada.slice(tab + 1), hash);
  }
  return arvore;
}

/**
 * Cada `blob` do SNAPSHOT contra a árvore da plataforma (`git ls-tree -r -z <sha>`).
 * @param {string} snapshot
 * @param {string} lsTree
 * @returns {string[]} uma linha por diferença; vazio quando confere
 */
export function diferencasDoSnapshot(snapshot, lsTree) {
  const arvore = lerArvore(lsTree);
  const diferencas = [];
  for (const [caminho, hash] of lerSnapshot(snapshot).blobs) {
    const daPlataforma = arvore.get(caminho);
    if (daPlataforma === undefined) diferencas.push(`${caminho}: ausente na plataforma`);
    else if (daPlataforma !== hash) diferencas.push(`${caminho}: hash diferente`);
  }
  return diferencas;
}

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const SNAPSHOT = join(RAIZ, "src/design-system/SNAPSHOT");

/**
 * @param {string} repo
 * @param {string[]} args
 */
function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], { maxBuffer: 64 * 1024 * 1024 });
}

/**
 * @param {string} destino caminho relativo à raiz deste repo
 * @param {Uint8Array | string} conteudo
 */
function escrever(destino, conteudo) {
  mkdirSync(dirname(join(RAIZ, destino)), { recursive: true });
  writeFileSync(join(RAIZ, destino), conteudo);
}

/**
 * @param {string} repo
 * @param {string} ref
 */
function copiar(repo, ref) {
  const sha = git(repo, ["rev-parse", "--verify", `${ref}^{commit}`]).toString().trim();
  const ancestral = spawnSync("git", ["-C", repo, "merge-base", "--is-ancestor", sha, "origin/main"], { encoding: "utf8" });
  if (ancestral.status !== 0) {
    // Não recusa: quem barra é o G0.3. A Fase 0 anda antes do push da plataforma.
    console.error(`aviso: ${sha} não é ancestral da origin/main da plataforma ${ancestral.stderr.trim()}`.trim());
  }
  const arvore = lerArvore(git(repo, ["ls-tree", "-r", "-z", sha, "--", "src/design-system", "src/components/ui", FONTE]).toString());
  const linhas = [`sha ${sha}`];
  const lockfile = git(repo, ["cat-file", "blob", `${sha}:pnpm-lock.yaml`]).toString();
  for (const p of PACOTES) linhas.push(`versao ${p} ${versaoResolvida(lockfile, p)}`);
  for (const [caminho, hash] of arvore) {
    if (!deveCopiar(caminho)) continue;
    const bytes = git(repo, ["cat-file", "blob", hash]);
    if (hashGit(bytes) !== hash) throw new Error(`${caminho}: o hash lido não confere com ${hash}`);
    escrever(caminho, bytes);
    linhas.push(`blob ${hash} ${caminho}`);
  }
  escrever("src/app/globals.css", semRelatorio(git(repo, ["cat-file", "blob", `${sha}:src/app/globals.css`]).toString()));
  escrever("src/design-system/SNAPSHOT", linhas.join("\n") + "\n");
  console.log(`${linhas.length - 1 - PACOTES.length} arquivos copiados de ${sha}`);
}

/** @param {string} repo */
function verificar(repo) {
  const snapshot = readFileSync(SNAPSHOT, "utf8");
  const { sha, blobs } = lerSnapshot(snapshot);
  const diferencas = diferencasDoSnapshot(snapshot, git(repo, ["ls-tree", "-r", "-z", sha]).toString());
  if (diferencas.length) {
    console.error(`SNAPSHOT não confere com ${sha}:\n${diferencas.join("\n")}`);
    process.exit(1);
  }
  console.log(`SNAPSHOT confere com ${sha}: ${blobs.size} arquivos`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [a, b] = process.argv.slice(2);
  if (a === "--verificar" && b) verificar(b);
  else if (a && b && !a.startsWith("--")) copiar(a, b);
  else {
    console.error("uso: node scripts/sync-design-system.mjs <repo-da-plataforma> <sha>\n" +
      "     node scripts/sync-design-system.mjs --verificar <repo-da-plataforma>");
    process.exit(2);
  }
}
