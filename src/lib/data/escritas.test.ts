import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { confirmarGrupo, confirmarSessao, criarSessaoGrupo, delSessao, type EncontroGrupo, type ResultadoEscrita, salvarSessao } from "./escritas";

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
