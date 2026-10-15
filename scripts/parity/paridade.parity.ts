import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it, vi } from "vitest";
import { z } from "zod";

import { indexDoLegado } from "./legado.mjs";
import { codigoDeSaida, divergenciasDoSnapshot, gravarDivergencias, linhasDoRelatorio } from "./relatorio";

// G2.5 (GATE-06, GATE-07, SEC-02): o app antigo (commit LEGADO) e o novo sobre o mesmo snapshot, com
// o relógio no "hoje" do snapshot, nos 3 papéis.
//
//   pnpm parity                                   # o snapshot mais novo de ~/.central-elite3d-paridade
//   PARIDADE_SNAPSHOT=<arquivo> pnpm parity
//
// Quem roda é o Lucas: o snapshot é dado de produção, e o agente não o lê (SEC-02). O impresso só
// tem `métrica | chave | tipo`; os valores vão para divergencias-<data>.json (0600) ao lado do
// snapshot. Sai com 1 se houver divergência fora do Apêndice A.

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const PASTA = join(homedir(), ".central-elite3d-paridade");

const SNAPSHOT = z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), relacoes: z.record(z.array(z.record(z.unknown()))) });

function arquivoDoSnapshot(): string {
  const pedido = process.env.PARIDADE_SNAPSHOT;
  if (pedido) return pedido;
  const nomes = readdirSync(PASTA).filter((n) => /^snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  const ultimo = nomes.at(-1);
  if (!ultimo) throw new Error(`nenhum snapshot em ${PASTA}: rode pnpm parity:snapshot`);
  return join(PASTA, ultimo);
}

const temporaria = mkdtempSync(join(tmpdir(), "paridade-"));
afterAll(() => {
  vi.useRealTimers();
  rmSync(temporaria, { recursive: true, force: true });
});

it("paridade com o app antigo (commit LEGADO)", async () => {
  const caminho = arquivoDoSnapshot();
  const { data, relacoes } = SNAPSHOT.parse(JSON.parse(readFileSync(caminho, "utf8")));
  // O "hoje" do snapshot ao meio-dia em Brasília, antes de carregar os dois apps: o antigo fixa o
  // HOJE no carregamento.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${data}T15:00:00Z`));
  const { arquivo, sha } = indexDoLegado({ cwd: RAIZ, destino: join(temporaria, "index.html") });

  const divergencias = await divergenciasDoSnapshot({ relacoes, data, arquivo });

  const gravado = gravarDivergencias(dirname(caminho), data, divergencias);
  console.log([`legado ${sha} · snapshot de ${data} · ${divergencias.length} divergência(s)`, ...linhasDoRelatorio(divergencias), `valores: ${gravado}`].join("\n"));
  // Só a contagem na falha: o diff do expect imprimiria os valores.
  expect(codigoDeSaida(divergencias), `${divergencias.length} divergência(s) fora do Apêndice A`).toBe(0);
});
