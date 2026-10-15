import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { carregarTudo } from "@/lib/data/leituras";
import type { Dataset } from "@/lib/data/esquemas";
import { hojeSP } from "@/lib/datas";
import type { Papel } from "@/lib/papeis";

import { carregarLegado, clienteDoSnapshot, indexDoMergeBase } from "./legado.mjs";
import { METRICAS as LEGADO } from "./metricas-legado.mjs";
import { METRICAS } from "./metricas";
import { type Relacoes, relacoesDeTeste } from "./snapshot-de-teste";

// GATE-06, PAR-01…PAR-17: o lado novo, pelas regras de src/lib/, dá o mesmo valor que o app antigo
// em cada métrica e em cada papel que a vê, sobre os fixtures do harness antigo. O Dataset sai da
// porta de verdade (carregarTudo), lida pelo mesmo cliente falso que serve o app antigo.

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
let pasta = "";
let arquivo = "";

beforeAll(() => {
  pasta = mkdtempSync(join(tmpdir(), "metricas-"));
  arquivo = indexDoMergeBase({ cwd: RAIZ, destino: join(pasta, "index.html") }).arquivo;
});
afterAll(() => {
  vi.useRealTimers();
  rmSync(pasta, { recursive: true, force: true });
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-25T15:00:00Z"));
});

async function datasetDo(papel: Papel, relacoes: Relacoes): Promise<Dataset> {
  const perfil = { id: `paridade-${papel}`, role: papel, nome: "Paridade", email: `paridade-${papel}@example.invalid` };
  const carga = await carregarTudo(papel, perfil.id, clienteDoSnapshot(relacoes, perfil).db as unknown as SupabaseClient);
  if (!carga.ok) throw new Error(carga.erro);
  return carga.dados;
}

async function comparar(id: string, relacoes: Relacoes = relacoesDeTeste()) {
  const legado = LEGADO.find(([m]) => m === id);
  const novo = METRICAS.find(([m]) => m === id);
  if (!legado || !novo) throw new Error(`${id} sem os dois lados`);
  const [, antiga, papeis] = legado;
  for (const papel of papeis) {
    const app = await carregarLegado({ arquivo, relacoes, papel });
    const esperado = antiga(app);
    expect(Object.keys(esperado).length, `${id} ${papel}: o lado antigo leu algo`).toBeGreaterThan(0);
    expect(novo[1](await datasetDo(papel, relacoes), papel, hojeSP()), `${id} ${papel}`).toEqual(esperado);
  }
}

describe("métricas do lado novo (GATE-06)", () => {
  it("as 17 métricas, com os mesmos ids e na mesma ordem dos dois lados", () => {
    expect(METRICAS.map(([id]) => id)).toEqual(LEGADO.map(([id]) => id));
    expect(METRICAS).toHaveLength(17);
  });

  for (const [id] of METRICAS) {
    it(`${id}: o mesmo valor do app antigo em cada chave, em cada papel que vê a métrica`, async () => {
      await comparar(id);
    });
  }

  it("PAR-01 e PAR-16 nos casos que os fixtures não trazem: o aviso de adesão do mentor e a rodada sem leitura por mentorado", async () => {
    const relacoes = relacoesDeTeste();
    relacoes.experiencia_adesao = [{ respostas: 1, mentorados_com_sessao: 4 }];
    relacoes.nps_analises = [{ ...relacoes.nps_analises[0], mentorados: [] }];
    relacoes.analise_ia_mentor = [{ ...relacoes.analise_ia_mentor[0], mentorados: [] }];
    await comparar("PAR-01", relacoes);
    await comparar("PAR-16", relacoes);
  });
});
