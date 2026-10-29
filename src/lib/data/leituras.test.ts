import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { datasetDeTeste } from "@/test/fixtures";

import { PAGINADAS } from "../../../scripts/parity/snapshot.mjs";
import type { Dataset, Relacao } from "./esquemas";
import { carregarTudo, lerNota, linksAssinados } from "./leituras";

type Resposta = { data: unknown; error: { message: string } | null };

interface Construtor {
  select(colunas: string): Construtor;
  order(coluna: string, opcoes: unknown): Construtor;
  eq(coluna: string, valor: unknown): Construtor;
  insert(valores: unknown): Construtor;
  update(valores: unknown): Construtor;
  upsert(valores: unknown): Construtor;
  delete(): Construtor;
  range(de: number, ate: number): Promise<Resposta>;
  limit(n: number): Promise<Resposta>;
  maybeSingle(): Promise<Resposta>;
}

interface Cenario {
  usuario?: string | null; // o id da sessão do supabase-js; null é sem sessão
  tabelas?: Partial<Record<string, unknown[]>>; // as linhas de cada relação ou rpc
  falhas?: Partial<Record<string, string>>; // relação ou rpc que responde erro, com a mensagem
}

// Um cliente falso: anota cada pedido (from ou rpc) com as chamadas e responde do cenário num
// setTimeout, como a rede. `naPrimeiraResposta` conta os pedidos que já tinham saído quando a
// primeira resposta chegou. Nenhuma rede.
function clienteFalso({ usuario = "u1", tabelas = {}, falhas = {} }: Cenario = {}) {
  const pedidos: Array<{ alvo: string; chamadas: unknown[][] }> = [];
  const marca: { naPrimeiraResposta?: number } = {};
  const responder = (alvo: string, data: unknown) =>
    new Promise<Resposta>((resolve) =>
      setTimeout(() => {
        marca.naPrimeiraResposta ??= pedidos.length;
        const falha = falhas[alvo];
        resolve(falha === undefined ? { data, error: null } : { data: null, error: { message: falha } });
      }, 0),
    );
  const db = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: usuario === null ? null : { user: { id: usuario } } }, error: null }),
    },
    from(alvo: string): Construtor {
      const chamadas: unknown[][] = [["from", alvo]];
      pedidos.push({ alvo, chamadas });
      const linhas = tabelas[alvo] ?? [];
      const pedido: Construtor = {
        select: (colunas) => (chamadas.push(["select", colunas]), pedido),
        order: (coluna, opcoes) => (chamadas.push(["order", coluna, opcoes]), pedido),
        eq: (coluna, valor) => (chamadas.push(["eq", coluna, valor]), pedido),
        insert: (valores) => (chamadas.push(["insert", valores]), pedido),
        update: (valores) => (chamadas.push(["update", valores]), pedido),
        upsert: (valores) => (chamadas.push(["upsert", valores]), pedido),
        delete: () => (chamadas.push(["delete"]), pedido),
        range: (de, ate) => (chamadas.push(["range", de, ate]), responder(alvo, linhas.slice(de, ate + 1))),
        limit: (n) => (chamadas.push(["limit", n]), responder(alvo, linhas.slice(0, n))),
        maybeSingle: () => (chamadas.push(["maybeSingle"]), responder(alvo, linhas[0] ?? null)),
      };
      return pedido;
    },
    rpc(nome: string, args?: unknown) {
      pedidos.push({ alvo: nome, chamadas: [["rpc", nome, args]] });
      return responder(nome, tabelas[nome] ?? []);
    },
  };
  return { db: db as unknown as SupabaseClient, pedidos, marca };
}

// Os fixtures deixam órfãs, transcrições e adesão vazias: aqui cada uma ganha uma linha, para
// toda relação cair num campo que dá para conferir.
const ORFA = { id: "s9", mentorado_id: "m2", mentorado_nome: "Bruno Dias", etapa: "Checkup 2", mentor: null, data: "2026-09-01", hora: "15:00:00", status: "Agendada" };
const TRANSCRICAO = { drive_id: "d1", mentor: "Luan", status: "aceita", realizada_em: "2026-10-01T13:00:00Z", mentorado_id: "m1" };
const ADESAO = { respostas: 3, mentorados_com_sessao: 10 };

function cenario() {
  const d = datasetDeTeste();
  if (!d.analise) throw new Error("o fixture traz a análise de admin e diretoria");
  // AD-005: o recorte do mentor sai da mesma análise, sem resumo e sem leitura por mentor.
  const { resumo: _resumo, mentores: _mentores, ...analiseMentor } = d.analise;
  const tabelas: Record<string, unknown[]> = {
    mentorados: d.mentorados,
    mentorados_basic: d.mentorados,
    parcelas: d.parcelas,
    lia_cobrancas: d.cobrancas,
    sessoes: d.sessoes,
    rotas: d.rotas,
    marcos_definicao: d.marcos,
    mentorado_marcos: d.mentoradoMarcos,
    faturamento_mensal: d.faturamento,
    canais: d.canais,
    mentorado_canais: d.mentoradoCanais,
    sessoes_orfas: [ORFA],
    stlseller_mentorados: d.stlseller,
    stlseller_pedidos_marketplace: d.stlPedidos,
    stlseller_produtos_vendidos: d.stlProdutos,
    nps_respostas: d.nps,
    experiencia_respostas: d.experiencia,
    nps_analises: [d.analise],
    experiencia_adesao: [ADESAO],
    analise_ia_mentor: [analiseMentor],
    transcricoes: [TRANSCRICAO],
  };
  const completo: Dataset = { ...d, orfas: [ORFA], adesao: ADESAO, transcricoes: [TRANSCRICAO] };
  // A view do mentor não tem as colunas financeiras, e ele não recebe nada do que só admin e diretoria leem.
  const doMentor: Dataset = {
    ...completo,
    mentorados: d.mentorados.map(
      ({ cadastro_incompleto: _c, contrato_status: _cs, entrada_status: _e, entrada_forma_pgto: _ef, restante_status: _r, restante_forma_pgto: _rf, ...basico }) => basico,
    ),
    parcelas: [],
    cobrancas: [],
    stlseller: [],
    stlPedidos: [],
    stlProdutos: [],
    nps: [],
    experiencia: [],
    analise: analiseMentor,
    transcricoes: [],
  };
  return { tabelas, completo, doMentor };
}

const DO_COMPLETO = [
  "mentorados",
  "parcelas",
  "lia_cobrancas",
  "sessoes",
  "rotas",
  "marcos_definicao",
  "mentorado_marcos",
  "faturamento_mensal",
  "canais",
  "mentorado_canais",
  "sessoes_orfas",
  "stlseller_mentorados",
  "stlseller_pedidos_marketplace",
  "stlseller_produtos_vendidos",
  "nps_respostas",
  "experiencia_respostas",
  "nps_analises",
  "experiencia_adesao",
  "transcricoes",
  "faixas_remuneracao",
  "mentor_lojas",
  "validacao_faturamento",
  "validacao_lojas",
  "validacao_eventos",
];
const DO_MENTOR = [
  "mentorados_basic",
  "sessoes",
  "rotas",
  "marcos_definicao",
  "mentorado_marcos",
  "faturamento_mensal",
  "canais",
  "mentorado_canais",
  "sessoes_orfas",
  "experiencia_adesao",
  "analise_ia_mentor",
  "faixas_remuneracao",
  "mentor_lojas",
  "validacao_faturamento",
  "validacao_lojas",
  "validacao_eventos",
];
const ADESAO_ARGS = { p_desde: "2026-10-13", p_prazo_dias: 2 };

// Cada relação que não derruba a carga, o campo dela no Dataset e o vazio que fica no lugar.
const COMPLEMENTARES: Array<[Relacao, keyof Dataset, [] | null]> = [
  ["lia_cobrancas", "cobrancas", []],
  ["rotas", "rotas", []],
  ["marcos_definicao", "marcos", []],
  ["mentorado_marcos", "mentoradoMarcos", []],
  ["faturamento_mensal", "faturamento", []],
  ["canais", "canais", []],
  ["mentorado_canais", "mentoradoCanais", []],
  ["sessoes_orfas", "orfas", []],
  ["stlseller_mentorados", "stlseller", []],
  ["stlseller_pedidos_marketplace", "stlPedidos", []],
  ["stlseller_produtos_vendidos", "stlProdutos", []],
  ["nps_respostas", "nps", []],
  ["experiencia_respostas", "experiencia", []],
  ["nps_analises", "analise", null],
  ["experiencia_adesao", "adesao", null],
  ["transcricoes", "transcricoes", []],
  ["faixas_remuneracao", "faixas", []],
  ["mentor_lojas", "mentorLojas", []],
  ["validacao_faturamento", "validacoes", []],
  ["validacao_lojas", "validacaoLojas", []],
  ["validacao_eventos", "validacaoEventos", []],
];

describe("carga inteira e nota (DATA-02, DATA-04, DATA-06, DATA-07, DATA-08, GATE-08, SEC-06)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("DATA-02: cada relação chega validada ao seu campo do Dataset, para os 3 papéis", async () => {
    const { tabelas, completo, doMentor } = cenario();
    for (const papel of ["admin", "diretoria"] as const) {
      expect(await carregarTudo(papel, "u1", clienteFalso({ tabelas }).db), papel).toEqual({ ok: true, dados: completo, erros: {} });
    }
    expect(await carregarTudo("mentor", "u1", clienteFalso({ tabelas }).db)).toEqual({ ok: true, dados: doMentor, erros: {} });
  });

  it("as leituras saem em paralelo: todas foram pedidas antes da primeira resposta", async () => {
    const { tabelas } = cenario();
    for (const [papel, total] of [["admin", DO_COMPLETO.length], ["mentor", DO_MENTOR.length]] as const) {
      const f = clienteFalso({ tabelas });
      await carregarTudo(papel, "u1", f.db);
      expect([f.pedidos.length, f.marca.naPrimeiraResposta], papel).toEqual([total, total]);
    }
  });

  it("DATA-04: cada relação paginada pede a ordem de hoje e o desempate da tabela do design, do snapshot do G0.2", async () => {
    const { tabelas } = cenario();
    const admin = clienteFalso({ tabelas });
    await carregarTudo("admin", "u1", admin.db);
    const mentor = clienteFalso({ tabelas });
    await carregarTudo("mentor", "u1", mentor.db);
    expect(PAGINADAS).toHaveLength(23);
    for (const { nome, select = "*", ordem, chave } of PAGINADAS) {
      const pedidos = (nome === "mentorados_basic" ? mentor : admin).pedidos.filter((p) => p.alvo === nome);
      expect(
        pedidos.map((p) => p.chamadas),
        nome,
      ).toEqual([
        [
          ["from", nome],
          ["select", select],
          ...ordem.map(([coluna, ascending]) => ["order", coluna, { ascending }]),
          ...chave.map((coluna) => ["order", coluna, { ascending: true }]),
          ["range", 0, 999],
        ],
      ]);
    }
    expect(admin.pedidos.find((p) => p.alvo === "nps_analises")?.chamadas).toEqual([
      ["from", "nps_analises"],
      ["select", "*"],
      ["order", "gerado_em", { ascending: false }],
      ["limit", 1],
    ]);
  });

  it("admin e diretoria leem mentorados, R04, R05, R14–R19 e R22; o mentor lê mentorados_basic e R21 e não pede R04, R05, R14–R19 nem R22", async () => {
    const { tabelas } = cenario();
    for (const [papel, esperado] of [
      ["admin", DO_COMPLETO],
      ["diretoria", DO_COMPLETO],
      ["mentor", DO_MENTOR],
    ] as const) {
      const f = clienteFalso({ tabelas });
      await carregarTudo(papel, "u1", f.db);
      expect(f.pedidos.map((p) => p.alvo).sort(), papel).toEqual([...esperado].sort());
    }
  });

  it("DATA-08 e GATE-08: R20 para os 3 papéis, nenhuma outra rpc e nenhuma escrita", async () => {
    const { tabelas } = cenario();
    const rpcsDe = (f: ReturnType<typeof clienteFalso>) => f.pedidos.flatMap((p) => p.chamadas.filter((c) => c[0] === "rpc"));
    const metodosDe = (f: ReturnType<typeof clienteFalso>) => [...new Set(f.pedidos.flatMap((p) => p.chamadas.map((c) => c[0])))].sort();
    for (const papel of ["admin", "diretoria"] as const) {
      const f = clienteFalso({ tabelas });
      await carregarTudo(papel, "u1", f.db);
      expect(rpcsDe(f), papel).toEqual([["rpc", "experiencia_adesao", ADESAO_ARGS]]);
      expect(metodosDe(f), papel).toEqual(["from", "limit", "order", "range", "rpc", "select"]);
    }
    const mentor = clienteFalso({ tabelas });
    await carregarTudo("mentor", "u1", mentor.db);
    expect(rpcsDe(mentor)).toEqual([
      ["rpc", "analise_ia_mentor", undefined],
      ["rpc", "experiencia_adesao", ADESAO_ARGS],
    ]);
    expect(metodosDe(mentor)).toEqual(["from", "order", "range", "rpc", "select"]);
  });

  it("DATA-06: falha de R02/R03, R04 ou R06 devolve { ok: false } com a mensagem do erro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { tabelas } = cenario();
    const casos = [
      ["admin", "mentorados"],
      ["diretoria", "parcelas"],
      ["admin", "sessoes"],
      ["mentor", "mentorados_basic"],
      ["mentor", "sessoes"],
    ] as const;
    for (const [papel, rel] of casos) {
      const f = clienteFalso({ tabelas, falhas: { [rel]: `falhou ${rel}` } });
      expect(await carregarTudo(papel, "u1", f.db), `${papel} ${rel}`).toEqual({ ok: false, erro: `falhou ${rel}` });
    }
    // DATA-03: linha fora do schema numa delas também derruba a carga.
    const foraDoSchema = clienteFalso({ tabelas: { ...tabelas, sessoes: [{ id: "s1", status: "Concluída" }] } });
    expect(await carregarTudo("admin", "u1", foraDoSchema.db)).toEqual({ ok: false, erro: "sessoes: schema mismatch" });
  });

  it("DATA-07: falha de outra relação vai para erros[rel] e o resto carrega", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { tabelas, completo, doMentor } = cenario();
    for (const [rel, campo, vazio] of COMPLEMENTARES) {
      const f = clienteFalso({ tabelas, falhas: { [rel]: `falhou ${rel}` } });
      expect(await carregarTudo("admin", "u1", f.db), rel).toEqual({ ok: true, dados: { ...completo, [campo]: vazio }, erros: { [rel]: `falhou ${rel}` } });
    }
    const mentor = clienteFalso({ tabelas, falhas: { analise_ia_mentor: "falhou analise_ia_mentor" } });
    expect(await carregarTudo("mentor", "u1", mentor.db)).toEqual({
      ok: true,
      dados: { ...doMentor, analise: null },
      erros: { analise_ia_mentor: "falhou analise_ia_mentor" },
    });
    // DATA-03: a análise fora do schema é falha só dela.
    const foraDoSchema = clienteFalso({ tabelas: { ...tabelas, nps_analises: [{ gerado_em: "2026-10-08T11:00:00Z" }] } });
    expect(await carregarTudo("admin", "u1", foraDoSchema.db)).toEqual({
      ok: true,
      dados: { ...completo, analise: null },
      erros: { nps_analises: "nps_analises: schema mismatch" },
    });
  });

  it("SEC-06: sem sessão, ou com a de outro usuário, nenhuma leitura sai e a carga diz que a sessão mudou", async () => {
    const { tabelas } = cenario();
    for (const usuario of [null, "u2"]) {
      const f = clienteFalso({ usuario, tabelas });
      expect(await carregarTudo("admin", "u1", f.db), String(usuario)).toEqual({ ok: false, erro: "A sessão mudou.", sessaoMudou: true });
      expect(f.pedidos).toEqual([]);
    }
  });

  it("R23: lerNota faz select('conteudo,atualizado_em').eq('mentorado_id', id).maybeSingle() e devolve a nota, ou null sem linha", async () => {
    const nota = { conteudo: "<h1>Plano</h1>", atualizado_em: "2026-10-13T12:00:00Z" };
    const comNota = clienteFalso({ tabelas: { mentorado_notas: [nota] } });
    expect(await lerNota("m1", "u1", comNota.db)).toEqual({ ok: true, dados: nota });
    expect(comNota.pedidos.map((p) => p.chamadas)).toEqual([
      [["from", "mentorado_notas"], ["select", "conteudo,atualizado_em"], ["eq", "mentorado_id", "m1"], ["maybeSingle"]],
    ]);
    expect(await lerNota("m2", "u1", clienteFalso().db)).toEqual({ ok: true, dados: null });
  });

  it("R23: erro ou linha fora do schema na nota devolve falha e escreve no console", async () => {
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const comErro = clienteFalso({ falhas: { mentorado_notas: "permission denied for table mentorado_notas" } });
    expect(await lerNota("m1", "u1", comErro.db)).toEqual({ ok: false, erro: "permission denied for table mentorado_notas" });
    expect(erroNoConsole.mock.calls.at(-1)?.[0]).toBe("[central-elite3d] mentorado_notas");

    const foraDoSchema = clienteFalso({ tabelas: { mentorado_notas: [{ conteudo: null, atualizado_em: "2026-10-13T12:00:00Z" }] } });
    expect(await lerNota("m1", "u1", foraDoSchema.db)).toEqual({ ok: false, erro: "mentorado_notas: schema mismatch" });
    expect(erroNoConsole.mock.calls.at(-1)?.[0]).toBe("[central-elite3d] mentorado_notas: schema mismatch");
  });

  it("SEC-06: sem sessão, ou com a de outro usuário, a nota não é pedida e a leitura diz que a sessão mudou; com a do usuário da tela, o pedido sai como antes", async () => {
    const nota = { conteudo: "<h1>Plano</h1>", atualizado_em: "2026-10-13T12:00:00Z" };
    for (const usuario of [null, "u2"]) {
      const f = clienteFalso({ usuario, tabelas: { mentorado_notas: [nota] } });
      expect(await lerNota("m1", "u1", f.db), String(usuario)).toEqual({ ok: false, erro: "A sessão mudou.", sessaoMudou: true });
      expect(f.pedidos, String(usuario)).toEqual([]);
    }
    const doUsuario = clienteFalso({ usuario: "u1", tabelas: { mentorado_notas: [nota] } });
    expect(await lerNota("m1", "u1", doUsuario.db)).toEqual({ ok: true, dados: nota });
    expect(doUsuario.pedidos.map((p) => p.chamadas)).toEqual([
      [["from", "mentorado_notas"], ["select", "conteudo,atualizado_em"], ["eq", "mentorado_id", "m1"], ["maybeSingle"]],
    ]);
  });
});

// O Storage falso dos links: anota bucket e argumentos e responde do cenário. Nenhuma rede.
function assinador(resposta: Resposta) {
  const pedidos: unknown[][] = [];
  const db = {
    storage: {
      from(bucket: string) {
        pedidos.push(["from", bucket]);
        return {
          createSignedUrls: (...args: unknown[]) => {
            pedidos.push(["createSignedUrls", ...args]);
            return Promise.resolve(resposta);
          },
        };
      },
    },
  };
  return { db: db as unknown as SupabaseClient, pedidos };
}

describe("links dos anexos das notas (AD-010)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("linksAssinados: createSignedUrls(caminhos, 3600) no bucket notas-anexos, e o mapa caminho → URL, sem os que o Storage recusou", async () => {
    const f = assinador({
      data: [
        { path: "m1/u1-a.png", signedUrl: "https://x/storage/v1/object/sign/notas-anexos/m1/u1-a.png?token=t1", signedURL: "/object/sign/notas-anexos/m1/u1-a.png?token=t1", error: null },
        { path: "m1/u2-b.pdf", signedUrl: null, signedURL: null, error: "Either the object does not exist or you do not have access to it" },
        { path: null, signedUrl: null, signedURL: null, error: "not found" },
      ],
      error: null,
    });
    const lido = await linksAssinados(["m1/u1-a.png", "m1/u2-b.pdf", "m1/u3-c.pdf"], f.db);
    expect(lido.ok && [...lido.dados]).toEqual([["m1/u1-a.png", "https://x/storage/v1/object/sign/notas-anexos/m1/u1-a.png?token=t1"]]);
    expect(f.pedidos).toEqual([
      ["from", "notas-anexos"],
      ["createSignedUrls", ["m1/u1-a.png", "m1/u2-b.pdf", "m1/u3-c.pdf"], 3600],
    ]);
  });

  it("linksAssinados: lista vazia não pede nada; erro e resposta fora do formato voltam como falha, no console", async () => {
    const vazio = assinador({ data: [], error: null });
    const lido = await linksAssinados([], vazio.db);
    expect(lido.ok && lido.dados.size).toBe(0);
    expect(vazio.pedidos).toEqual([]);
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await linksAssinados(["m1/u1-a.png"], assinador({ data: null, error: { message: "permission denied" } }).db)).toEqual({ ok: false, erro: "permission denied" });
    expect(erroNoConsole.mock.calls.at(-1)).toEqual(["[central-elite3d] notas-anexos", { message: "permission denied" }]);
    expect(await linksAssinados(["m1/u1-a.png"], assinador({ data: [{ path: 1 }], error: null }).db)).toEqual({ ok: false, erro: "notas-anexos: schema mismatch" });
    expect(erroNoConsole.mock.calls.at(-1)?.[0]).toBe("[central-elite3d] notas-anexos: schema mismatch");
  });
});
