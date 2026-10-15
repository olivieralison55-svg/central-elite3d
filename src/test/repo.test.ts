import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));

// Só o .gitignore do repo conta. O arquivo de exclusão global da máquina
// (`core.excludesFile`) já cobre `.env*` aqui, e faria um padrão ausente
// parecer coberto. `--no-index` decide pelos padrões mesmo em arquivo versionado.
function ignorado(caminho: string): boolean {
  const r = spawnSync(
    "git",
    ["-c", "core.excludesFile=/dev/null", "check-ignore", "-q", "--no-index", caminho],
    { cwd: RAIZ, encoding: "utf8" },
  );
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  throw new Error(`git check-ignore ${caminho}: exit ${r.status}: ${r.stderr}`);
}

describe("repo (STACK-04)", () => {
  it("o .gitignore cobre node_modules/, .next/, .vercel/, .env* e supabase/.temp/, menos o .env.example", () => {
    // Sondas que não existem em disco: no layout do pnpm `node_modules/<pacote>`
    // é symlink, e o git recusa caminho que atravessa symlink.
    const devemSerIgnorados = [
      "node_modules/sonda/index.js",
      ".next/sonda.json",
      ".vercel/sonda.json",
      ".env",
      ".env.local",
      ".env.production.local",
      "supabase/.temp/sonda",
    ];
    expect(devemSerIgnorados.filter((c) => !ignorado(c))).toEqual([]);
    expect(ignorado(".env.example")).toBe(false);
  });

  it("git ls-files não lista nenhum .env* além do .env.example", () => {
    const versionados = execFileSync("git", ["ls-files", "-z"], { cwd: RAIZ, encoding: "utf8" }).split("\0");
    const envs = versionados.filter((f) => /(^|\/)\.env/.test(f) && !/(^|\/)\.env\.example$/.test(f));
    expect(envs).toEqual([]);
  });
});
