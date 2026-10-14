import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  adotarOrfas,
  confirmarGrupo,
  confirmarSessao,
  criarMentorado,
  criarSessaoGrupo,
  delSessao,
  type EncontroGrupo,
  excluirFaturamento,
  excluirMentorado,
  type ResultadoEscrita,
  salvarCanalMentorado,
  salvarFaturamento,
  salvarMarco,
  salvarMentorado,
  salvarNota,
  salvarSessao,
  salvarSituacao,
} from "./escritas";

type Resposta = { data: unknown; error: { message: string } | null };

// Um cliente falso: anota cada pedido (from ou rpc) com as chamadas encadeadas, na ordem, e
// responde do cenário quando o pedido é aguardado. Relação sem resposta no cenário devolve uma
// linha. Nenhuma rede.
function clienteFalso(respostas: Partial<Record<string, Resposta>> = {}) {
  const pedidos: unknown[][][] = [];
  const responder = (alvo: string, padrao: Resposta) => Promise.resolve(respostas[alvo] ?? padrao);
  const db = {
    from(alvo: string) {
      const chamadas: unknown[][] = [["from", alvo]];
      pedidos.push(chamadas);
      const anotar =
        (nome: string) =>
        (...args: unknown[]) => {
          chamadas.push([nome, ...args]);
          return pedido;
        };
      const pedido = {
        insert: anotar("insert"),
        update: anotar("update"),
        upsert: anotar("upsert"),
        delete: anotar("delete"),
        eq: anotar("eq"),
        in: anotar("in"),
        select: anotar("select"),
        single: anotar("single"),
        then: (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) => responder(alvo, linhas(1)).then(ok, falha),
      };
      return pedido;
    },
    rpc(nome: string, args: unknown) {
      pedidos.push([["rpc", nome, args]]);
      return responder(nome, { data: null, error: null });
    },
  };
  return { db: db as unknown as SupabaseClient, pedidos };
}

const linhas = (n: number): Resposta => ({ data: Array.from({ length: n }, (_, i) => ({ id: `l${i}` })), error: null });
const falha = (message: string): Resposta => ({ data: null, error: { message } });

const ENCONTRO: EncontroGrupo = {
  etapa: "Plantão de Dúvida Semanal",
  status: "Concluída",
  mentor: "Sergio",
  data: "2026-08-06",
  hora: "19:00",
  link_meet: "https://meet.google.com/abc",
  link_gravacao: "https://exemplo.com/g1",
};

const SESSAO = {
  mentorado_id: "m1",
  etapa: "Checkup 2",
  status: "Agendada",
  mentor: "Luan",
  data: "2026-10-20",
  hora: "14:00",
  link_meet: "https://meet.google.com/xyz",
  link_gravacao: "",
  link_anotacoes: "",
};

// O payload do W03 para SESSAO: `ordem` de ETAPA_ORD, vazios como null e a etapa confirmada.
const PAYLOAD_SESSAO = {
  mentorado_id: "m1",
  etapa: "Checkup 2",
  ordem: 4,
  etapa_deduzida: false,
  status: "Agendada",
  mentor: "Luan",
  data: "2026-10-20",
  hora: "14:00",
  link_meet: "https://meet.google.com/xyz",
  link_gravacao: null,
  link_anotacoes: null,
};

// Cada escrita de sessão, chamada com o cliente que o teste passa.
const SESSOES: Array<[string, (db: SupabaseClient) => Promise<ResultadoEscrita>]> = [
  ["W01", (db) => confirmarGrupo(["g1", "g2"], "Sergio", db)],
  ["W02", (db) => criarSessaoGrupo(["m1", "m2"], ENCONTRO, db)],
  ["W03 cria", (db) => salvarSessao(null, SESSAO, db)],
  ["W03 atualiza", (db) => salvarSessao("s4", SESSAO, db)],
  ["W04", (db) => confirmarSessao("s3", "Luan", db)],
  ["W05", (db) => delSessao("s3", db)],
];

describe("escritas de sessão W01–W05 (WRITE-01, WRITE-02, OPS-06, OPS-08)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("W01: update({ status: 'Concluída', mentor }).in('id', ids).select('id'), e as N linhas voltam como sucesso", async () => {
    const f = clienteFalso({ sessoes: linhas(3) });
    expect(await confirmarGrupo(["g1", "g2", "g3"], "Sergio", f.db)).toEqual({ ok: true, linhas: 3 });
    expect(f.pedidos).toEqual([
      [["from", "sessoes"], ["update", { status: "Concluída", mentor: "Sergio" }], ["in", "id", ["g1", "g2", "g3"]], ["select", "id"]],
    ]);
  });

  it("W02 e OPS-06: insert de N linhas com a mesma etapa, data, hora, mentor e status, `ordem` de ETAPA_ORD e vazios como null", async () => {
    const f = clienteFalso({ sessoes: linhas(3) });
    const encontro = { ...ENCONTRO, mentor: "", hora: "", link_meet: "" };
    expect(await criarSessaoGrupo(["m1", "m2", "m4"], encontro, f.db)).toEqual({ ok: true, linhas: 3 });
    const linha = {
      etapa: "Plantão de Dúvida Semanal",
      ordem: 90,
      status: "Concluída",
      mentor: null,
      data: "2026-08-06",
      hora: null,
      link_meet: null,
      link_gravacao: "https://exemplo.com/g1",
    };
    expect(f.pedidos).toEqual([
      [
        ["from", "sessoes"],
        ["insert", [{ mentorado_id: "m1", ...linha }, { mentorado_id: "m2", ...linha }, { mentorado_id: "m4", ...linha }]],
        ["select", "id"],
      ],
    ]);
  });

  it("W02: `ordem` é a de ETAPA_ORD para cada etapa de grupo, e 99 para etapa fora da lista", async () => {
    for (const [etapa, ordem] of [
      ["Plantão de Dúvida Semanal", 90],
      ["Sessão de Implementação Mensal", 91],
      ["Mentoria extra", 99],
    ] as const) {
      const f = clienteFalso();
      await criarSessaoGrupo(["m1"], { ...ENCONTRO, etapa }, f.db);
      expect(f.pedidos[0][1], etapa).toEqual(["insert", [{ mentorado_id: "m1", ...ENCONTRO, etapa, ordem }]]);
    }
  });

  it("W03 e OPS-08: sem id é insert e com id é update por id, os dois com `etapa_deduzida: false`, `ordem` de ETAPA_ORD e vazios como null", async () => {
    const cria = clienteFalso();
    expect(await salvarSessao(null, SESSAO, cria.db)).toEqual({ ok: true, linhas: 1 });
    expect(cria.pedidos).toEqual([[["from", "sessoes"], ["insert", PAYLOAD_SESSAO], ["select", "id"]]]);

    const atualiza = clienteFalso();
    expect(await salvarSessao("s4", SESSAO, atualiza.db)).toEqual({ ok: true, linhas: 1 });
    expect(atualiza.pedidos).toEqual([[["from", "sessoes"], ["update", PAYLOAD_SESSAO], ["eq", "id", "s4"], ["select", "id"]]]);

    // Registro antigo com etapa fora das listas fica com 99.
    const antiga = clienteFalso();
    await salvarSessao("s9", { ...SESSAO, etapa: "Mentoria avulsa" }, antiga.db);
    expect(antiga.pedidos[0][1]).toEqual(["update", { ...PAYLOAD_SESSAO, etapa: "Mentoria avulsa", ordem: 99 }]);
  });

  it("W04 e OPS-08: update({ status: 'Concluída', mentor }).eq('id', id), sem `etapa_deduzida`", async () => {
    const f = clienteFalso();
    expect(await confirmarSessao("s3", "Luan", f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([[["from", "sessoes"], ["update", { status: "Concluída", mentor: "Luan" }], ["eq", "id", "s3"], ["select", "id"]]]);
  });

  it("W05: delete().eq('id', id).select('id')", async () => {
    const f = clienteFalso();
    expect(await delSessao("s3", f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([[["from", "sessoes"], ["delete"], ["eq", "id", "s3"], ["select", "id"]]]);
  });

  it("WRITE-02: resposta sem erro e com 0 linhas é { ok: false, zeroLinhas: true }, em W01–W05", async () => {
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [w, escrever] of SESSOES) {
      expect(await escrever(clienteFalso({ sessoes: linhas(0) }).db), w).toEqual({ ok: false, zeroLinhas: true });
      expect(erroNoConsole.mock.calls.at(-1)?.[0], w).toBe("[central-elite3d] sessoes");
    }
  });

  it("WRITE-02 e THREAT-11: W01 e W02 com menos linhas que as pedidas devolvem { ok: false, linhas, esperadas }", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await confirmarGrupo(["g1", "g2", "g3"], "Sergio", clienteFalso({ sessoes: linhas(2) }).db)).toEqual({ ok: false, linhas: 2, esperadas: 3 });
    expect(await criarSessaoGrupo(["m1", "m2", "m4"], ENCONTRO, clienteFalso({ sessoes: linhas(1) }).db)).toEqual({ ok: false, linhas: 1, esperadas: 3 });
  });

  it("erro do banco em W01–W05 devolve { ok: false, erro } com a mensagem e escreve no console", async () => {
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [w, escrever] of SESSOES) {
      const mensagem = `new row violates row-level security policy (${w})`;
      expect(await escrever(clienteFalso({ sessoes: falha(mensagem) }).db), w).toEqual({ ok: false, erro: mensagem });
      expect(erroNoConsole.mock.calls.at(-1), w).toEqual(["[central-elite3d] sessoes", { message: mensagem }]);
    }
  });
});

// O teste de passagem de um marco de rota rica, já derivado por quem monta a evolução (OPS-18).
const EVOLUCAO_RICA = {
  status: "EM_ANDAMENTO",
  data: "2026-10-01",
  criterios_ok: ["Banca montada na feira"],
  criterios_pendentes: ["Primeira venda", "Cartão de visita"],
  progresso: 33,
  bloqueios: ["Sem alvará"],
  proxima_acao: "Pedir o alvará na prefeitura",
};

// Cada escrita de rotas e nota, a relação dela e a chamada com o cliente que o teste passa.
const ROTAS_E_NOTA: Array<[string, string, (db: SupabaseClient) => Promise<ResultadoEscrita>]> = [
  ["W06", "mentorado_canais", (db) => salvarCanalMentorado("m1", "r1", "c2", db)],
  ["W07", "faturamento_mensal", (db) => salvarFaturamento("m1", "2026-09", "c2", 1500, db)],
  ["W08", "faturamento_mensal", (db) => excluirFaturamento("f1", db)],
  ["W09", "mentorado_marcos", (db) => salvarMarco("m1", "mk1", EVOLUCAO_RICA, db)],
  ["W10", "mentorado_notas", (db) => salvarNota("m1", "<p>Plano</p>", "2026-10-14T13:00:00.000Z", db)],
];

describe("escritas de rotas e nota W06–W10 (WRITE-01, WRITE-02, OPS-18, NOTE-04)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("W06: upsert de mentorado_id, rota_id e canal_id com onConflict 'mentorado_id,rota_id'", async () => {
    const f = clienteFalso();
    expect(await salvarCanalMentorado("m1", "r1", "c2", f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([
      [
        ["from", "mentorado_canais"],
        ["upsert", { mentorado_id: "m1", rota_id: "r1", canal_id: "c2" }, { onConflict: "mentorado_id,rota_id" }],
        ["select", "mentorado_id"],
      ],
    ]);
  });

  it("W07: upsert com `mes` AAAA-MM-01 e onConflict 'mentorado_id,mes,canal_id'; valor vazio vale 0", async () => {
    const f = clienteFalso();
    expect(await salvarFaturamento("m1", "2026-09", "c2", 1234.56, f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([
      [
        ["from", "faturamento_mensal"],
        ["upsert", { mentorado_id: "m1", mes: "2026-09-01", canal_id: "c2", valor: 1234.56 }, { onConflict: "mentorado_id,mes,canal_id" }],
        ["select", "id"],
      ],
    ]);
    const vazio = clienteFalso();
    await salvarFaturamento("m1", "2026-10", "c2", null, vazio.db);
    expect(vazio.pedidos[0][1]).toEqual(["upsert", { mentorado_id: "m1", mes: "2026-10-01", canal_id: "c2", valor: 0 }, { onConflict: "mentorado_id,mes,canal_id" }]);
  });

  it("W08: delete por id", async () => {
    const f = clienteFalso();
    expect(await excluirFaturamento("f1", f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([[["from", "faturamento_mensal"], ["delete"], ["eq", "id", "f1"], ["select", "id"]]]);
  });

  it("W09: a rota simples grava só mentorado_id, marco_id, status e data, com onConflict 'mentorado_id,marco_id'", async () => {
    const f = clienteFalso();
    expect(await salvarMarco("m1", "mk2", { status: "passou", data: "" }, f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([
      [
        ["from", "mentorado_marcos"],
        ["upsert", { mentorado_id: "m1", marco_id: "mk2", status: "passou", data: null }, { onConflict: "mentorado_id,marco_id" }],
        ["select", "mentorado_id"],
      ],
    ]);
  });

  it("W09 e OPS-18: a rota rica leva também criterios_ok com o texto, criterios_pendentes, progresso, bloqueios e proxima_acao", async () => {
    const f = clienteFalso();
    expect(await salvarMarco("m1", "mk1", EVOLUCAO_RICA, f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([
      [
        ["from", "mentorado_marcos"],
        [
          "upsert",
          {
            mentorado_id: "m1",
            marco_id: "mk1",
            status: "EM_ANDAMENTO",
            data: "2026-10-01",
            criterios_ok: ["Banca montada na feira"],
            criterios_pendentes: ["Primeira venda", "Cartão de visita"],
            progresso: 33,
            bloqueios: ["Sem alvará"],
            proxima_acao: "Pedir o alvará na prefeitura",
          },
          { onConflict: "mentorado_id,marco_id" },
        ],
        ["select", "mentorado_id"],
      ],
    ]);
  });

  it("W10 e NOTE-04: upsert de mentorado_id, conteudo e atualizado_em pela chave da tabela, sem onConflict", async () => {
    const f = clienteFalso();
    expect(await salvarNota("m1", "<h1>Plano</h1>", "2026-10-14T13:00:00.000Z", f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([
      [["from", "mentorado_notas"], ["upsert", { mentorado_id: "m1", conteudo: "<h1>Plano</h1>", atualizado_em: "2026-10-14T13:00:00.000Z" }], ["select", "mentorado_id"]],
    ]);
  });

  it("WRITE-02: resposta sem erro e com 0 linhas é { ok: false, zeroLinhas: true }, em W06–W10", async () => {
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [w, rel, escrever] of ROTAS_E_NOTA) {
      expect(await escrever(clienteFalso({ [rel]: linhas(0) }).db), w).toEqual({ ok: false, zeroLinhas: true });
      expect(erroNoConsole.mock.calls.at(-1)?.[0], w).toBe(`[central-elite3d] ${rel}`);
    }
  });

  it("erro do banco em W06–W10 devolve { ok: false, erro } com a mensagem e escreve no console", async () => {
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [w, rel, escrever] of ROTAS_E_NOTA) {
      const mensagem = `permission denied for table ${rel} (${w})`;
      expect(await escrever(clienteFalso({ [rel]: falha(mensagem) }).db), w).toEqual({ ok: false, erro: mensagem });
      expect(erroNoConsole.mock.calls.at(-1), w).toEqual([`[central-elite3d] ${rel}`, { message: mensagem }]);
    }
  });
});

const CADASTRO = {
  aba: "cadastro",
  nome: "Ana Clara",
  email: "ana.clara@exemplo.com",
  data_fechamento: "2026-01-10",
  link_drive: "https://drive.google.com/x",
  link_mapa_mental: "",
  link_whatsapp: "",
} as const;

const NOVO = {
  nome: "ZZQ Migracao Xyzzy",
  email: "zzq-migracao@example.invalid",
  data_fechamento: "2026-10-14",
  entrada_status: "Pago",
  entrada_forma_pgto: "",
  contrato_status: "Ainda não",
  restante_status: "Ainda não",
};

// Cada escrita de mentorado que confere linhas, chamada com o cliente que o teste passa.
const MENTORADOS: Array<[string, (db: SupabaseClient) => Promise<ResultadoEscrita>]> = [
  ["W11 cadastro", (db) => salvarMentorado("m1", CADASTRO, db)],
  [
    "W11 financeiro",
    (db) =>
      salvarMentorado("m1", { aba: "financeiro", contrato_status: "Assinado", entrada_status: null, entrada_forma_pgto: null, restante_status: null, restante_forma_pgto: null }, db),
  ],
  ["W12", (db) => salvarSituacao("m1", { situacao: "ativo", pausado_em: null, retorno_previsto: null }, "2026-10-14", db)],
  ["W13", (db) => excluirMentorado("m1", db)],
];

describe("escritas de mentorado W11–W14 (WRITE-01, WRITE-02, OPS-13, OPS-15)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("W11 aba Cadastro e OPS-13: update por id de nome, cadastro_incompleto: false, email, data_fechamento e os 3 links, vazios como null", async () => {
    const f = clienteFalso();
    expect(await salvarMentorado("m1", CADASTRO, f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([
      [
        ["from", "mentorados"],
        [
          "update",
          {
            nome: "Ana Clara",
            cadastro_incompleto: false,
            email: "ana.clara@exemplo.com",
            data_fechamento: "2026-01-10",
            link_drive: "https://drive.google.com/x",
            link_mapa_mental: null,
            link_whatsapp: null,
          },
        ],
        ["eq", "id", "m1"],
        ["select", "id"],
      ],
    ]);
  });

  it("W11 aba Financeiro e OPS-15: só os 5 campos de status e forma, com o status nulo gravado nulo", async () => {
    const f = clienteFalso();
    const financeiro = {
      aba: "financeiro",
      contrato_status: null,
      entrada_status: "Pago parcial",
      entrada_forma_pgto: "pix",
      restante_status: null,
      restante_forma_pgto: "",
    } as const;
    expect(await salvarMentorado("m2", financeiro, f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([
      [
        ["from", "mentorados"],
        ["update", { contrato_status: null, entrada_status: "Pago parcial", entrada_forma_pgto: "pix", restante_status: null, restante_forma_pgto: null }],
        ["eq", "id", "m2"],
        ["select", "id"],
      ],
    ]);
  });

  it("OPS-15: cada um dos 5 campos do financeiro que chega nulo vai nulo no update, e os outros 4 vão com o valor que têm", async () => {
    const preenchido = { contrato_status: "Assinado", entrada_status: "Pago", entrada_forma_pgto: "pix", restante_status: "Pago parcial", restante_forma_pgto: "boleto" };
    for (const campo of ["contrato_status", "entrada_status", "entrada_forma_pgto", "restante_status", "restante_forma_pgto"] as const) {
      const campos = { ...preenchido, [campo]: null };
      const f = clienteFalso();
      expect(await salvarMentorado("m2", { aba: "financeiro", ...campos }, f.db), campo).toEqual({ ok: true, linhas: 1 });
      expect(f.pedidos, campo).toEqual([[["from", "mentorados"], ["update", campos], ["eq", "id", "m2"], ["select", "id"]]]);
    }
  });

  it("W11b e OPS-13: rpc('lia_adotar_orfas', { p_mentorado }), e o erro dela volta para quem chama", async () => {
    const f = clienteFalso();
    expect(await adotarOrfas("m1", f.db)).toEqual({ ok: true, dados: null });
    expect(f.pedidos).toEqual([[["rpc", "lia_adotar_orfas", { p_mentorado: "m1" }]]]);

    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const comErro = clienteFalso({ lia_adotar_orfas: falha("permission denied for table lia_cobrancas") });
    expect(await adotarOrfas("m1", comErro.db)).toEqual({ ok: false, erro: "permission denied for table lia_cobrancas" });
    expect(erroNoConsole.mock.calls.at(-1)).toEqual(["[central-elite3d] lia_adotar_orfas", { message: "permission denied for table lia_cobrancas" }]);
  });

  it("W12: situacao, pausado_em (hoje se vazio) e retorno_previsto; fora de 'pausado', as duas datas vão nulas", async () => {
    const casos = [
      [{ situacao: "pausado", pausado_em: "", retorno_previsto: "" }, { situacao: "pausado", pausado_em: "2026-10-14", retorno_previsto: null }],
      [
        { situacao: "pausado", pausado_em: "2026-09-01", retorno_previsto: "2026-12-01" },
        { situacao: "pausado", pausado_em: "2026-09-01", retorno_previsto: "2026-12-01" },
      ],
      [{ situacao: "ativo", pausado_em: "2026-09-01", retorno_previsto: "2026-12-01" }, { situacao: "ativo", pausado_em: null, retorno_previsto: null }],
    ] as const;
    for (const [campos, payload] of casos) {
      const f = clienteFalso();
      expect(await salvarSituacao("m4", campos, "2026-10-14", f.db), campos.situacao).toEqual({ ok: true, linhas: 1 });
      expect(f.pedidos, JSON.stringify(campos)).toEqual([[["from", "mentorados"], ["update", payload], ["eq", "id", "m4"], ["select", "id"]]]);
    }
  });

  it("W13: delete().eq('id', id).select('id')", async () => {
    const f = clienteFalso();
    expect(await excluirMentorado("m3", f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([[["from", "mentorados"], ["delete"], ["eq", "id", "m3"], ["select", "id"]]]);
  });

  it("W14: insert de nome, email, data_fechamento, os status, a forma da entrada e cancelado: false, com .select().single()", async () => {
    const f = clienteFalso({ mentorados: { data: { id: "m9", nome: "ZZQ Migracao Xyzzy" }, error: null } });
    expect(await criarMentorado(NOVO, f.db)).toEqual({ ok: true, linhas: 1 });
    expect(f.pedidos).toEqual([
      [
        ["from", "mentorados"],
        [
          "insert",
          {
            nome: "ZZQ Migracao Xyzzy",
            email: "zzq-migracao@example.invalid",
            data_fechamento: "2026-10-14",
            entrada_status: "Pago",
            entrada_forma_pgto: null,
            contrato_status: "Ainda não",
            restante_status: "Ainda não",
            cancelado: false,
          },
        ],
        ["select"],
        ["single"],
      ],
    ]);
  });

  it("WRITE-02: resposta sem erro e com 0 linhas é { ok: false, zeroLinhas: true }, em W11, W12 e W13", async () => {
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [w, escrever] of MENTORADOS) {
      expect(await escrever(clienteFalso({ mentorados: linhas(0) }).db), w).toEqual({ ok: false, zeroLinhas: true });
      expect(erroNoConsole.mock.calls.at(-1)?.[0], w).toBe("[central-elite3d] mentorados");
    }
  });

  it("erro do banco em W11–W14 devolve { ok: false, erro } com a mensagem e escreve no console", async () => {
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const mensagem = 'duplicate key value violates unique constraint "mentorados_email_unico"';
    for (const [w, escrever] of [...MENTORADOS, ["W14", (db: SupabaseClient) => criarMentorado(NOVO, db)] as const]) {
      expect(await escrever(clienteFalso({ mentorados: falha(mensagem) }).db), w).toEqual({ ok: false, erro: mensagem });
      expect(erroNoConsole.mock.calls.at(-1), w).toEqual(["[central-elite3d] mentorados", { message: mensagem }]);
    }
  });
});
