import { z } from "zod";

import type { Resultado } from "./esquemas";

const PASSO = 1000;

// Uma coluna do `order`: o nome e se é ascendente.
export type Ordem = [coluna: string, ascendente: boolean];

// O pedaço do query builder do postgrest-js que a paginação usa. O `order` acumula colunas
// (postgrest-js/dist/index.mjs:902–906) e o `range` vira offset e limit (:1068–1073).
export interface Consulta {
  order(coluna: string, opcoes: { ascending: boolean }): Consulta;
  range(de: number, ate: number): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

// DATA-03: linha fora do schema escreve o problema no console e vira falha da relação.
export function validarLinhas<T>(rel: string, esquema: z.ZodType<T>, linhas: unknown): Resultado<T[]> {
  const lido = z.array(esquema).safeParse(linhas);
  if (lido.success) return { ok: true, dados: lido.data };
  console.error(`[central-elite3d] ${rel}: schema mismatch`, lido.error.issues);
  return { ok: false, erro: `${rel}: schema mismatch` };
}

// DATA-04 e DATA-05: páginas de 1.000 linhas, na ordem de hoje e depois na chave única, até vir
// uma página menor. O `paginado` do index.html (:726–735) ordenava sem desempate, e o OFFSET
// entre páginas podia repetir ou pular linha.
export async function lerPaginado<T>(rel: string, consulta: () => Consulta, ordem: Ordem[], esquema: z.ZodType<T>): Promise<Resultado<T[]>> {
  const todas: T[] = [];
  for (let de = 0; ; de += PASSO) {
    let pedido = consulta();
    for (const [coluna, ascending] of ordem) pedido = pedido.order(coluna, { ascending });
    const { data, error } = await pedido.range(de, de + PASSO - 1);
    if (error) {
      console.error(`[central-elite3d] ${rel}`, error);
      return { ok: false, erro: error.message };
    }
    const pagina = validarLinhas(rel, esquema, data);
    if (!pagina.ok) return pagina;
    todas.push(...pagina.dados);
    if (pagina.dados.length < PASSO) return { ok: true, dados: todas };
  }
}
