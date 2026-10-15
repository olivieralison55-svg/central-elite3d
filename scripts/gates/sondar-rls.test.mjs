import { describe, expect, it } from "vitest";

import { conferirAlvo, EMAIL_ALVO, ESCRITAS, executar, NOME_ALVO, proibidas, sondar } from "./sondar-rls.mjs";

// GATE-08 e SEC-02: a sonda do RLS com um cliente falso. Nenhuma rede.

const ALVO = { id: "zzq1", nome: NOME_ALVO, email: EMAIL_ALVO, data_fechamento: "2099-12-31", link_drive: null, link_mapa_mental: null, link_whatsapp: null };

/**
 * Cliente supabase-js falso. Guarda cada pedido; `mentorados`/`mentorados_basic` devolvem
 * `registros`, as outras leituras uma linha com id, e as escritas `gravaram` (a lista de relações
 * em que o RLS "deixa") ou 0 linhas.
 */
function clienteFalso({ registros = [ALVO], gravaram = [] } = {}) {
  const pedidos = [];
  const from = (relacao) => {
    const pedido = { relacao, operacao: "select", filtros: [] };
    pedidos.push(pedido);
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      eq: (coluna, valor) => (pedido.filtros.push([coluna, valor]), q),
      in: (coluna, valor) => (pedido.filtros.push([coluna, valor]), q),
      single: () => q,
      maybeSingle: () => q,
      ...Object.fromEntries(["insert", "update", "upsert", "delete"].map((op) => [op, (dados) => ((pedido.operacao = op), (pedido.dados = dados), q)])),
      then(resolver) {
        if (pedido.operacao !== "select") return resolver({ data: gravaram.includes(relacao) ? [{ id: "novo" }] : [], error: null });
        if (relacao === "mentorados" || relacao === "mentorados_basic") return resolver({ data: registros, error: null });
        return resolver({ data: [{ id: `${relacao}-1` }], error: null });
      },
    };
    return q;
  };
  return { db: { from, rpc: async () => ({ data: 0, error: null }) }, pedidos };
}

const ws = (lista) => lista.map((e) => e.w);

describe("sonda do RLS (GATE-08, SEC-02)", () => {
  it("a lista de escritas proibidas sai das capacidades de cada papel, com a capacidade do mapeamento §4.2", () => {
    expect(Object.fromEntries(ESCRITAS.map((e) => [e.w, e.cap]))).toEqual({
      W01: "escreverSessao",
      W02: "criarSessao",
      W03: "escreverSessao",
      W04: "escreverSessao",
      W05: "excluir",
      W06: "escreverRotas",
      W07: "escreverRotas",
      W08: "excluir",
      W09: "escreverRotas",
      W10: "escreverNotas",
      W11: "editarMentorado",
      W12: "editarMentorado",
      W13: "excluir",
      W14: "criarMentorado",
      W15: "editarFinanceiro",
      W16: "editarFinanceiro",
      W17: "editarFinanceiro",
      W18: "editarFinanceiro",
      W19: "editarFinanceiro",
      W20: "editarFinanceiro",
      W21: "editarFinanceiro",
    });
    // A diretoria não tem escrita nenhuma; o mentor tem as de sessão, rotas e notas; o admin, todas.
    const todas = ["W01", "W02", "W03", "W04", "W05", "W06", "W07", "W08", "W09", "W10", "W11", "W12", "W14", "W15", "W16", "W17", "W18", "W19", "W20", "W21", "W13"];
    expect(ws(proibidas("diretoria"))).toEqual(todas);
    expect(ws(proibidas("mentor"))).toEqual(["W02", "W05", "W08", "W11", "W12", "W14", "W15", "W16", "W17", "W18", "W19", "W20", "W21", "W13"]);
    expect(proibidas("admin")).toEqual([]);
    // Papel fora da lista não tem capacidade: tudo é proibido, e a W13 fica por último.
    expect(ws(proibidas("visitante"))).toEqual(todas);
  });

  it("o alvo só pode ser o registro zzq-migracao@example.invalid; qualquer outro é recusado antes de tentar", async () => {
    expect(conferirAlvo([ALVO])).toBe(ALVO);
    for (const linhas of [[], [ALVO, { ...ALVO, id: "zzq2" }], [{ ...ALVO, email: "ana.clara@exemplo.com" }], [{ ...ALVO, nome: "Ana Clara" }], null]) {
      expect(() => conferirAlvo(linhas), JSON.stringify(linhas)).toThrow(/registro de teste/);
    }
    const { db, pedidos } = clienteFalso({ registros: [{ ...ALVO, email: "ana.clara@exemplo.com" }] });
    const linhas = [];
    await expect(sondar({ db, papel: "diretoria", escrever: (l) => linhas.push(l), silenciar: false })).rejects.toThrow(/registro de teste/);
    expect(pedidos.filter((p) => p.operacao !== "select")).toEqual([]);
    expect(linhas).toEqual([]);
    // A leitura procura pelo e-mail do UAT, na relação que o papel lê.
    expect(pedidos[0]).toEqual({ relacao: "mentorados", operacao: "select", filtros: [["email", EMAIL_ALVO]] });
  });

  it("cada escrita proibida vai ao registro de teste e às linhas dele; a saída é só Wnn | recusada ou GRAVOU, sem nome, e-mail nem valor", async () => {
    const { db, pedidos } = clienteFalso({ gravaram: ["parcelas"] });
    const linhas = [];
    await sondar({ db, papel: "mentor", escrever: (l) => linhas.push(l) });
    expect(linhas).toEqual([
      "W02 | recusada",
      "W05 | recusada",
      "W08 | recusada",
      "W11 | recusada",
      "W12 | recusada",
      "W14 | recusada",
      "W15 | recusada",
      "W16 | recusada",
      "W17 | recusada",
      "W18 | GRAVOU",
      "W19 | GRAVOU",
      "W20 | GRAVOU",
      "W21 | GRAVOU",
      "W13 | recusada",
    ]);
    for (const linha of linhas) expect(linha).toMatch(/^W\d{2} \| (?:recusada|GRAVOU)$/);
    const saida = linhas.join("\n");
    for (const proibido of [NOME_ALVO, EMAIL_ALVO, "zzq1", "2099"]) expect(saida).not.toContain(proibido);
    // O mentor lê a view; as escritas miram o registro de teste e as linhas que a sonda achou dele.
    expect(pedidos[0].relacao).toBe("mentorados_basic");
    const escritas = pedidos.filter((p) => p.operacao !== "select");
    expect(escritas.find((p) => p.relacao === "mentorados" && p.operacao === "delete")?.filtros).toEqual([["id", "zzq1"]]);
    expect(escritas.find((p) => p.relacao === "sessoes" && p.operacao === "delete")?.filtros).toEqual([["id", "sessoes-1"]]);
    expect(escritas.find((p) => p.relacao === "parcelas" && p.operacao === "update")?.filtros).toEqual([["id", "parcelas-1"]]);
    expect(escritas.find((p) => p.relacao === "mentorados" && p.operacao === "update")?.dados).toMatchObject({ nome: NOME_ALVO, email: EMAIL_ALVO });
    expect(escritas.find((p) => p.relacao === "sessoes" && p.operacao === "insert")?.dados).toEqual([expect.objectContaining({ mentorado_id: "zzq1", data: "2099-12-31", hora: "23:59" })]);
  });

  it("entra com persistSession desligado, recusa a conta de admin e encerra só a sessão local", async () => {
    const { db } = clienteFalso();
    const auth = { opcoes: null, signOut: [] };
    const criarCliente = (_url, _chave, opcoes) => {
      auth.opcoes = opcoes;
      return {
        ...db,
        from: (relacao) => (relacao === "profiles" ? { select: () => ({ eq: () => ({ single: async () => ({ data: { role: "admin" }, error: null }) }) }) } : db.from(relacao)),
        auth: {
          signInWithPassword: async () => ({ data: { user: { id: "u1" } }, error: null }),
          signOut: async (o) => (auth.signOut.push(o), { error: null }),
        },
      };
    };
    const linhas = [];
    await expect(executar({ criarCliente, perguntar: async () => "x", escrever: (l) => linhas.push(l) })).rejects.toThrow(/diretoria e de mentor/);
    expect(auth.opcoes).toEqual({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    expect(auth.signOut).toEqual([{ scope: "local" }]);
    expect(linhas).toEqual([]);
  });
});
