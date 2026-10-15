import { afterEach, describe, expect, it, vi } from "vitest";

import { ESQUEMAS } from "./esquemas";
import { type Consulta, lerPaginado, type Ordem } from "./paginar";

type Chamada = ["order", string, { ascending: boolean }] | ["range", number, number];

// Todas na mesma `ordem`: é o empate que, sem desempate, deixava o OFFSET repetir ou pular linha.
const sessao = (i: number) => ({
  id: `s${String(i).padStart(4, "0")}`,
  mentorado_id: "m1",
  etapa: "Checkup 1",
  ordem: 3,
  status: "Concluída",
  mentor: "Luan",
  data: "2026-01-01",
  hora: null,
  link_meet: null,
  link_gravacao: null,
  link_anotacoes: null,
  google_event_id: null,
  etapa_deduzida: false,
});
const sessoes = (n: number) => Array.from({ length: n }, (_, i) => sessao(i));

const ORDEM_SESSOES: Ordem[] = [
  ["ordem", true],
  ["id", true],
];

// Uma relação falsa: cada `consulta()` abre um pedido que anota as chamadas e responde a fatia do
// `range` sobre `linhas`, como o PostgREST. `erroNaPagina` (1, 2…) faz aquela página falhar.
function relacaoFalsa(linhas: unknown[], erroNaPagina?: number) {
  const paginas: Chamada[][] = [];
  const consulta = (): Consulta => {
    const chamadas: Chamada[] = [];
    const numero = paginas.push(chamadas);
    const pedido: Consulta = {
      order(coluna, opcoes) {
        chamadas.push(["order", coluna, opcoes]);
        return pedido;
      },
      range(de, ate) {
        chamadas.push(["range", de, ate]);
        if (numero === erroNaPagina) return Promise.resolve({ data: null, error: { message: "canceling statement due to statement timeout" } });
        return Promise.resolve({ data: linhas.slice(de, ate + 1), error: null });
      },
    };
    return pedido;
  };
  return { consulta, paginas };
}

const ranges = (paginas: Chamada[][]) => paginas.map((chamadas) => chamadas.filter((c) => c[0] === "range"));

describe("leitura paginada (DATA-03, DATA-04, DATA-05)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("DATA-05: com 2.500 linhas devolve as 2.500, cada uma uma vez, em 3 páginas", async () => {
    const linhas = sessoes(2500);
    const f = relacaoFalsa(linhas);
    const lido = await lerPaginado("sessoes", f.consulta, ORDEM_SESSOES, ESQUEMAS.sessoes);
    if (!lido.ok) throw new Error(lido.erro);
    expect(lido.dados).toHaveLength(2500);
    expect(new Set(lido.dados.map((s) => s.id)).size).toBe(2500);
    expect(lido.dados.map((s) => s.id)).toEqual(linhas.map((s) => s.id));
    expect(f.paginas).toHaveLength(3);
  });

  it("DATA-04: cada página acumula a coluna de hoje e o desempate no order, e o range anda de 1.000 em 1.000", async () => {
    const f = relacaoFalsa(sessoes(2500));
    await lerPaginado("sessoes", f.consulta, ORDEM_SESSOES, ESQUEMAS.sessoes);
    expect(f.paginas).toEqual(
      [
        [0, 999],
        [1000, 1999],
        [2000, 2999],
      ].map(([de, ate]) => [["order", "ordem", { ascending: true }], ["order", "id", { ascending: true }], ["range", de, ate]]),
    );

    const produtos = relacaoFalsa([]);
    const ordem: Ordem[] = [
      ["faturamento", false],
      ["email", true],
      ["marketplace", true],
      ["anuncio_id", true],
    ];
    await lerPaginado("stlseller_produtos_vendidos", produtos.consulta, ordem, ESQUEMAS.stlseller_produtos_vendidos);
    expect(produtos.paginas).toEqual([
      [
        ["order", "faturamento", { ascending: false }],
        ["order", "email", { ascending: true }],
        ["order", "marketplace", { ascending: true }],
        ["order", "anuncio_id", { ascending: true }],
        ["range", 0, 999],
      ],
    ]);
  });

  it("DATA-04: para na primeira página com menos de 1.000 linhas", async () => {
    const casos: Array<[number, Array<[number, number]>]> = [
      [0, [[0, 999]]],
      [999, [[0, 999]]],
      [
        1000,
        [
          [0, 999],
          [1000, 1999],
        ],
      ],
      [
        2000,
        [
          [0, 999],
          [1000, 1999],
          [2000, 2999],
        ],
      ],
    ];
    for (const [total, esperado] of casos) {
      const f = relacaoFalsa(sessoes(total));
      const lido = await lerPaginado("sessoes", f.consulta, ORDEM_SESSOES, ESQUEMAS.sessoes);
      expect(lido.ok && lido.dados.length, `${total} linhas`).toBe(total);
      expect(ranges(f.paginas), `${total} linhas`).toEqual(esperado.map(([de, ate]) => [["range", de, ate]]));
    }
  });

  it("erro numa página devolve { ok: false } com a mensagem, escreve no console e não pede a página seguinte", async () => {
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const f = relacaoFalsa(sessoes(2500), 2);
    expect(await lerPaginado("sessoes", f.consulta, ORDEM_SESSOES, ESQUEMAS.sessoes)).toEqual({
      ok: false,
      erro: "canceling statement due to statement timeout",
    });
    expect(f.paginas).toHaveLength(2);
    expect(erroNoConsole.mock.calls).toEqual([["[central-elite3d] sessoes", { message: "canceling statement due to statement timeout" }]]);
  });

  it("DATA-03: linha fora do schema escreve '[central-elite3d] <relação>: schema mismatch' com o problema e devolve falha", async () => {
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const linhas: unknown[] = sessoes(2500);
    linhas[1500] = { ...sessao(1500), etapa_deduzida: "sim" };
    const f = relacaoFalsa(linhas);
    expect(await lerPaginado("sessoes", f.consulta, ORDEM_SESSOES, ESQUEMAS.sessoes)).toEqual({ ok: false, erro: "sessoes: schema mismatch" });
    expect(f.paginas).toHaveLength(2);
    expect(erroNoConsole).toHaveBeenCalledTimes(1);
    const [mensagem, problemas] = erroNoConsole.mock.calls[0];
    expect(mensagem).toBe("[central-elite3d] sessoes: schema mismatch");
    expect(problemas).toEqual([expect.objectContaining({ path: [500, "etapa_deduzida"] })]);
  });
});
