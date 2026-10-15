import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ESQUEMAS } from "@/lib/data/esquemas";
import { carregarTudo } from "@/lib/data/leituras";
import { PAPEIS } from "@/lib/papeis";

import type { Valores } from "./chaves";
import { carregarLegado, clienteDoSnapshot } from "./legado.mjs";
import { METRICAS as LEGADO } from "./metricas-legado.mjs";
import { METRICAS } from "./metricas";

// A comparação e o relatório da paridade (GATE-06, GATE-07, SEC-02). O impresso leva só a métrica,
// a chave e o tipo: os valores carregam R$ e nome de mentor, e o que sai na tela entra no
// transcript de quem roda. Os dois valores vão para um arquivo 0600 na pasta do snapshot.

export type Tipo = "falta" | "sobra" | "valor diferente";

export interface Divergencia {
  metrica: string; // PAR-xx, ou SCHEMA para linha do snapshot fora do schema
  chave: string; // `<papel>/<chave da métrica>`
  tipo: Tipo;
  antigo: unknown;
  novo: unknown;
}

// Apêndice A: o bloco Concluídas de PAR-09 diverge por desenho (OPS-09, as 30 mais recentes).
// Ele é conferido pelo teste de OPS-09, não pela comparação com o app antigo.
export const EXCECOES: Readonly<Record<string, readonly string[]>> = { "PAR-09": ["concluidas"] };

// "falta" é a chave que o app antigo tem e o novo não; "sobra", o contrário.
export function comparar(metrica: string, papel: string, antigo: Valores, novo: Valores): Divergencia[] {
  const fora = new Set(EXCECOES[metrica] ?? []);
  const chaves = [...new Set([...Object.keys(antigo), ...Object.keys(novo)])].filter((c) => !fora.has(c)).sort();
  return chaves.flatMap((c): Divergencia[] => {
    const base = { metrica, chave: `${papel}/${c}`, antigo: antigo[c], novo: novo[c] };
    if (!(c in novo)) return [{ ...base, tipo: "falta" }];
    if (!(c in antigo)) return [{ ...base, tipo: "sobra" }];
    return isDeepStrictEqual(antigo[c], novo[c]) ? [] : [{ ...base, tipo: "valor diferente" }];
  });
}

// GATE-06: a linha do snapshot que não passa no schema da porta conta como divergência. No
// arquivo vão o caminho e o código de cada problema, nunca o valor da linha.
export function foraDoSchema(relacoes: Readonly<Record<string, readonly unknown[]>>): Divergencia[] {
  return Object.entries(ESQUEMAS).flatMap(([relacao, esquema]) =>
    (relacoes[relacao] ?? []).flatMap((linha, i): Divergencia[] => {
      const lido = esquema.safeParse(linha);
      return lido.success
        ? []
        : [{ metrica: "SCHEMA", chave: `${relacao}#${i}`, tipo: "valor diferente", antigo: lido.error.issues.map((p) => `${p.path.join(".")}: ${p.code}`), novo: null }];
    }),
  );
}

export const linhasDoRelatorio = (divergencias: readonly Divergencia[]): string[] => divergencias.map((d) => `${d.metrica} | ${d.chave} | ${d.tipo}`);

// divergencias-<data>.json, 0600, na pasta do snapshot (0700, conferida pelo snapshot.mjs).
export function gravarDivergencias(pasta: string, data: string, divergencias: readonly Divergencia[]): string {
  const arquivo = join(pasta, `divergencias-${data}.json`);
  writeFileSync(arquivo, JSON.stringify(divergencias, null, 2), { mode: 0o600 });
  chmodSync(arquivo, 0o600);
  return arquivo;
}

export const codigoDeSaida = (divergencias: readonly Divergencia[]): 0 | 1 => (divergencias.length ? 1 : 0);

// A corrida: o schema de cada linha, depois as 17 métricas nos 3 papéis, cada métrica do lado
// antigo numa instância nova do app. Quem chama já fixou o relógio no `data` do snapshot.
export async function divergenciasDoSnapshot({ relacoes, data, arquivo }: { relacoes: Record<string, Record<string, unknown>[]>; data: string; arquivo: string }): Promise<Divergencia[]> {
  const divergencias = foraDoSchema(relacoes);
  for (const papel of PAPEIS) {
    const perfil = { id: `paridade-${papel}`, role: papel, nome: "Paridade", email: `paridade-${papel}@example.invalid` };
    const carga = await carregarTudo(papel, perfil.id, clienteDoSnapshot(relacoes, perfil).db as unknown as SupabaseClient);
    if (!carga.ok) {
      // A porta recusou a carga: o lado novo inteiro falta. O motivo vai só para o arquivo.
      divergencias.push({ metrica: "CARGA", chave: papel, tipo: "falta", antigo: null, novo: carga.erro });
      continue;
    }
    for (const [id, antiga, papeis] of LEGADO) {
      if (!(papeis as readonly string[]).includes(papel)) continue;
      const nova = METRICAS.find(([m]) => m === id)?.[1];
      if (!nova) throw new Error(`${id} sem o lado novo`);
      const app = await carregarLegado({ arquivo, relacoes, papel });
      divergencias.push(...comparar(id, papel, antiga(app), nova(carga.dados, papel, data)));
    }
  }
  return divergencias;
}
