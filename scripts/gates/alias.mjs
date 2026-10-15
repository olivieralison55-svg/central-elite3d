/* Os scripts de gate rodados no Node puro (sem o Vite do vitest) importam as
 * regras de src/ em TypeScript: `@/…` e o import relativo sem extensão. O Node
 * 24 já tira os tipos; este hook só resolve o caminho.
 *
 *   node --import ./scripts/gates/alias.mjs scripts/gates/<script>.mjs
 *
 * Carregado pelo --import, ele se registra como hook de resolve; na thread dos
 * hooks não se registra de novo.
 */
import { existsSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";

const SRC = new URL("../../src/", import.meta.url);
const COM_EXTENSAO = /\.[cm]?[jt]sx?$/;

if (isMainThread) register(import.meta.url);

/**
 * @param {string} especificador
 * @param {{ parentURL?: string }} contexto
 * @param {(especificador: string, contexto: object) => Promise<{ url: string, format?: string | null }>} proximo
 */
export async function resolve(especificador, contexto, proximo) {
  const doTs = contexto.parentURL?.endsWith(".ts") && /^\.\.?\//.test(especificador);
  const alvo = especificador.startsWith("@/") ? new URL(especificador.slice(2), SRC).href : doTs ? new URL(especificador, contexto.parentURL).href : null;
  if (alvo === null || COM_EXTENSAO.test(alvo)) return proximo(alvo ?? especificador, contexto);
  const achado = [".ts", ".tsx", "/index.ts"].map((ext) => alvo + ext).find((url) => existsSync(fileURLToPath(url)));
  if (!achado) throw new Error(`alias: ${especificador} não resolve em src/`);
  return { ...(await proximo(achado, contexto)), format: "module-typescript" };
}
