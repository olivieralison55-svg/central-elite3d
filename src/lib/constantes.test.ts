import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ETAPA_ORD, ETAPAS, ETAPAS_GRUPO, MENTORES, MENTORES_HIST, ordemDaEtapa, TODOS_MENTORES } from "./constantes";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const SYNC = readFileSync(join(RAIZ, "supabase/functions/sync-google-calendar/index.ts"), "utf8");

// O valor de `const <nome> ... = [ ... ];` (ou `{ ... };`) no código da function. Importar o
// arquivo rodaria o `Deno.serve`; o literal é JavaScript puro, então é avaliado sozinho e passa
// pelo Zod antes de ser lido.
function literalDoSync<T>(nome: string, esquema: z.ZodType<T>): T {
  const achado = new RegExp(`^const ${nome}\\b[^=\\n]*=\\s*([[{][\\s\\S]*?^[\\]}]);`, "m").exec(SYNC);
  if (!achado) throw new Error(`${nome} não encontrado no sync-google-calendar`);
  const valor: unknown = new Function(`return (${achado[1]});`)();
  return esquema.parse(valor);
}

const TRILHA = literalDoSync("TRILHA", z.array(z.object({ etapa: z.string(), ordem: z.number() })));
const EMAIL_MENTOR = literalDoSync("EMAIL_MENTOR", z.record(z.string()));

describe("constantes de domínio (TEST-04, OPS-03)", () => {
  it("TEST-04: as etapas da TRILHA do sync-google-calendar são as de ETAPAS, na mesma ordem", () => {
    expect(TRILHA.map((t) => t.etapa)).toEqual([...ETAPAS]);
  });

  it("TEST-04: a ordem de cada etapa da TRILHA é a de ETAPA_ORD, de 1 a 12", () => {
    expect(TRILHA.map((t) => [t.etapa, t.ordem])).toEqual(ETAPAS.map((etapa) => [etapa, ETAPA_ORD[etapa]]));
    expect(TRILHA.map((t) => t.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("TEST-04: cada nome de MENTORES aparece como valor do EMAIL_MENTOR do sync", () => {
    const creditados = new Set(Object.values(EMAIL_MENTOR));
    expect(MENTORES.filter((mentor) => !creditados.has(mentor))).toEqual([]);
  });

  it("ETAPAS_GRUPO tem as ordens 90 e 91; etapa fora das duas listas fica com 99", () => {
    expect(ETAPAS_GRUPO.map((etapa) => ETAPA_ORD[etapa])).toEqual([90, 91]);
    expect(ETAPAS_GRUPO.map(ordemDaEtapa)).toEqual([90, 91]);
    expect(ordemDaEtapa("Checkup 10")).toBe(12);
    expect(ETAPA_ORD["Mentoria avulsa"]).toBeUndefined();
    expect(ordemDaEtapa("Mentoria avulsa")).toBe(99);
  });

  it("OPS-03: TODOS_MENTORES são os 7 de MENTORES e depois Israel e Evaldo, que ficaram fora de MENTORES", () => {
    expect(MENTORES).toEqual(["Luan", "Sergio", "Diovani", "Petare", "Michelle", "André", "Gabriella"]);
    expect(MENTORES_HIST).toEqual(["Israel", "Evaldo"]);
    expect(TODOS_MENTORES).toEqual([...MENTORES, ...MENTORES_HIST]);
    expect(MENTORES_HIST.filter((mentor) => MENTORES.includes(mentor))).toEqual([]);
  });
});
