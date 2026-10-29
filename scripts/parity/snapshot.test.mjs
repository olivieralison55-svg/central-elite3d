import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PAGINADAS, conferirChave, executar, gravarSnapshot, lerPaginado, lerTudo } from "./snapshot.mjs";

/** Cliente supabase-js falso: guarda cada consulta e responde das linhas de `tabelas`. */
function clienteFalso({ tabelas = {}, erros = {}, perfil = { id: "u1", role: "admin" } } = {}) {
  const consultas = [];
  const rpcs = [];
  const auth = { login: null, signOut: [] };
  const db = {
    auth: {
      signInWithPassword: async (credenciais) => {
        auth.login = credenciais;
        return { data: { user: { id: perfil.id } }, error: null };
      },
      signOut: async (opcoes) => {
        auth.signOut.push(opcoes);
        return { error: null };
      },
    },
    from(tabela) {
      const c = { tabela, select: null, ordens: [], ranges: [], eq: null, limit: null, single: false };
      consultas.push(c);
      const q = {
        select: (s) => ((c.select = s), q),
        order: (coluna, { ascending }) => (c.ordens.push([coluna, ascending]), q),
        eq: (coluna, valor) => ((c.eq = [coluna, valor]), q),
        range: (de, ate) => (c.ranges.push([de, ate]), q),
        limit: (n) => ((c.limit = n), q),
        single: () => ((c.single = true), q),
        then(resolver) {
          if (erros[tabela]) return resolver({ data: null, error: { message: erros[tabela] } });
          if (tabela === "profiles") return resolver({ data: perfil, error: null });
          let linhas = tabelas[tabela] ?? [];
          for (const [de, ate] of c.ranges) linhas = linhas.slice(de, ate + 1);
          if (c.limit !== null) linhas = linhas.slice(0, c.limit);
          return resolver({ data: linhas, error: null });
        },
      };
      return q;
    },
    rpc: async (nome, args) => {
      rpcs.push([nome, args]);
      return { data: [], error: null };
    },
  };
  return { db, consultas, rpcs, auth };
}

// Uma linha com todas as colunas de desempate, em cada relação paginada.
function umaLinhaPorTabela() {
  const linha = { id: 1, mentorado_id: 1, marco_id: 1, rota_id: 1, email: "e", marketplace: "m", anuncio_id: "a", origem_id: "o", drive_id: "d" };
  return Object.fromEntries(PAGINADAS.map(({ nome }) => [nome, [linha]]));
}

function pastaTemporaria() {
  return mkdtempSync(join(tmpdir(), "paridade-"));
}

describe("snapshot de paridade (GATE-05, DATA-04, GATE-03)", () => {
  it("lê de 1.000 em 1.000 até vir uma página menor, cada linha uma vez", async () => {
    const linhas = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const { db, consultas } = clienteFalso({ tabelas: { sessoes: linhas } });
    expect(await lerPaginado("sessoes", () => db.from("sessoes").select("*"))).toEqual(linhas);
    expect(consultas.map((c) => c.ranges)).toEqual([[[0, 999]], [[1000, 1999]], [[2000, 2999]]]);

    const exatas = clienteFalso({ tabelas: { sessoes: Array.from({ length: 2000 }, (_, i) => ({ id: i })) } });
    expect(await lerPaginado("sessoes", () => exatas.db.from("sessoes").select("*"))).toHaveLength(2000);
    expect(exatas.consultas.map((c) => c.ranges)).toEqual([[[0, 999]], [[1000, 1999]], [[2000, 2999]]]);
  });

  it("lê R01–R22 com a ordem de hoje e depois a chave de desempate", async () => {
    const { db, consultas, rpcs } = clienteFalso({ tabelas: umaLinhaPorTabela() });
    const relacoes = await lerTudo(db, "u1");

    expect(Object.keys(relacoes).sort()).toEqual([
      "analise_ia_mentor", "canais", "experiencia_adesao", "experiencia_respostas", "faturamento_mensal",
      "lia_cobrancas", "marcos_definicao", "mentorado_canais", "mentorado_marcos", "mentorados", "mentorados_basic",
      "nps_analises", "nps_respostas", "parcelas", "profiles", "rotas", "sessoes", "sessoes_orfas",
      "stlseller_mentorados", "stlseller_pedidos_marketplace", "stlseller_produtos_vendidos", "transcricoes",
      "faixas_remuneracao", "mentor_lojas", "validacao_eventos", "validacao_faturamento", "validacao_lojas",
    ].sort());
    expect(consultas[0]).toMatchObject({ tabela: "profiles", eq: ["id", "u1"], single: true });
    expect(Object.fromEntries(consultas.slice(1).map((c) => [c.tabela, c.ordens]))).toEqual({
      mentorados: [["data_fechamento", true], ["id", true]],
      mentorados_basic: [["data_fechamento", true], ["id", true]],
      parcelas: [["numero", true], ["id", true]],
      lia_cobrancas: [["due_date", true], ["id", true]],
      sessoes: [["ordem", true], ["id", true]],
      rotas: [["ordem", true], ["id", true]],
      marcos_definicao: [["ordem", true], ["id", true]],
      mentorado_marcos: [["mentorado_id", true], ["marco_id", true]],
      faturamento_mensal: [["id", true]],
      canais: [["ordem", true], ["id", true]],
      mentorado_canais: [["mentorado_id", true], ["rota_id", true]],
      sessoes_orfas: [["id", true]],
      stlseller_mentorados: [["email", true]],
      stlseller_pedidos_marketplace: [["email", true], ["marketplace", true]],
      stlseller_produtos_vendidos: [["faturamento", false], ["email", true], ["marketplace", true], ["anuncio_id", true]],
      nps_respostas: [["respondido_em", false], ["id", true]],
      experiencia_respostas: [["respondido_em", false], ["origem_id", true]],
      transcricoes: [["drive_id", true]],
      faixas_remuneracao: [["id", true]],
      mentor_lojas: [["mentor", true], ["id", true]],
      validacao_faturamento: [["competencia", false], ["id", true]],
      validacao_lojas: [["validacao_id", true], ["id", true]],
      validacao_eventos: [["criado_em", true], ["id", true]],
      nps_analises: [["gerado_em", false]],
    });
    expect(consultas.find((c) => c.tabela === "transcricoes").select).toBe("mentor,status,realizada_em,mentorado_id,drive_id");
    expect(consultas.find((c) => c.tabela === "nps_analises").limit).toBe(1);
    expect(rpcs).toEqual([
      ["experiencia_adesao", { p_desde: "2026-10-13", p_prazo_dias: 2 }],
      ["analise_ia_mentor", undefined],
    ]);
  });

  it("falha com chave de desempate repetida, sem mostrar o valor dela", async () => {
    const tabelas = umaLinhaPorTabela();
    tabelas.stlseller_mentorados = [{ email: "zzq-migracao@example.invalid" }, { email: "zzq-migracao@example.invalid" }];
    await expect(lerTudo(clienteFalso({ tabelas }).db, "u1")).rejects.toThrow(
      /^stlseller_mentorados: 1 linha\(s\) repetem a chave de desempate \(email\)$/,
    );
    // Chave composta: repetir só a primeira coluna não é repetir a chave.
    expect(() => conferirChave("mentorado_marcos", [{ mentorado_id: 1, marco_id: 1 }, { mentorado_id: 1, marco_id: 2 }], ["mentorado_id", "marco_id"])).not.toThrow();
  });

  it("falha com coluna de desempate ausente, nula ou desconhecida do banco", async () => {
    const semId = umaLinhaPorTabela();
    semId.sessoes = [{ ordem: 1 }];
    await expect(lerTudo(clienteFalso({ tabelas: semId }).db, "u1")).rejects.toThrow("sessoes: coluna de desempate ausente ou nula (id)");
    expect(() => conferirChave("mentorado_canais", [{ mentorado_id: 1, rota_id: null }], ["mentorado_id", "rota_id"])).toThrow(
      "mentorado_canais: coluna de desempate ausente ou nula (mentorado_id, rota_id)",
    );
    // Tabela vazia não tem linha para conferir: quem acusa a coluna é o `order` no banco.
    const erros = { parcelas: "column parcelas.id does not exist" };
    await expect(lerTudo(clienteFalso({ tabelas: umaLinhaPorTabela(), erros }).db, "u1")).rejects.toThrow(
      "parcelas: column parcelas.id does not exist",
    );
  });

  it("grava numa pasta nova 0700, excluída do backup, com o arquivo 0600", () => {
    const base = pastaTemporaria();
    const pasta = join(base, "snapshots");
    const excluidas = [];
    const arquivo = gravarSnapshot(pasta, "snapshot-2026-10-14.json", "{}", (p) => excluidas.push(p));
    expect(statSync(pasta).mode & 0o777).toBe(0o700);
    expect(statSync(arquivo).mode & 0o777).toBe(0o600);
    expect(readFileSync(arquivo, "utf8")).toBe("{}");
    expect(excluidas).toEqual([pasta]);

    // Regravar no mesmo dia devolve o arquivo a 0600.
    chmodSync(arquivo, 0o644);
    gravarSnapshot(pasta, "snapshot-2026-10-14.json", "{}", () => {});
    expect(statSync(arquivo).mode & 0o777).toBe(0o600);
    rmSync(base, { recursive: true });
  });

  it("recusa gravar numa pasta que já existe com outro modo", () => {
    const base = pastaTemporaria();
    const pasta = join(base, "snapshots");
    mkdirSync(pasta);
    chmodSync(pasta, 0o755);
    expect(() => gravarSnapshot(pasta, "snapshot-2026-10-14.json", "{}", () => {})).toThrow("0700");
    expect(existsSync(join(pasta, "snapshot-2026-10-14.json"))).toBe(false);
    rmSync(base, { recursive: true });
  });

  it("abre o cliente com persistSession: false, encerra só a própria sessão e só imprime contagens", async () => {
    const base = pastaTemporaria();
    const pasta = join(base, "snapshots");
    const falso = clienteFalso({ tabelas: umaLinhaPorTabela() });
    const respostas = [" zzq-migracao@example.invalid ", "s3nha-de-teste"];
    let opcoes;
    const saida = [];
    await executar({
      criarCliente: (_url, _chave, o) => ((opcoes = o), falso.db),
      perguntar: async () => respostas.shift(),
      pasta,
      agora: new Date("2026-10-15T02:30:00Z"), // 23:30 de 14/10 em Brasília
      escrever: (linha) => saida.push(linha),
      excluirDoBackup: () => {},
    });
    expect(opcoes.auth.persistSession).toBe(false);
    expect(falso.auth.login).toEqual({ email: "zzq-migracao@example.invalid", password: "s3nha-de-teste" });
    expect(falso.auth.signOut).toEqual([{ scope: "local" }]);
    expect(saida).toHaveLength(27);
    expect(saida.filter((linha) => !/^[a-z_]+: \d+$/.test(linha))).toEqual([]);
    const gravado = readFileSync(join(pasta, "snapshot-2026-10-14.json"), "utf8");
    expect(JSON.parse(gravado).data).toBe("2026-10-14");
    expect(gravado).not.toContain("zzq-migracao");
    expect(gravado).not.toContain("s3nha-de-teste");

    // Sessão que não é de admin: nada gravado, e a sessão é encerrada mesmo assim.
    const mentor = clienteFalso({ tabelas: umaLinhaPorTabela(), perfil: { id: "u2", role: "mentor" } });
    const outra = join(base, "outra");
    await expect(
      executar({ criarCliente: () => mentor.db, perguntar: async () => "x", pasta: outra, escrever: () => {}, excluirDoBackup: () => {} }),
    ).rejects.toThrow("admin");
    expect(mentor.auth.signOut).toEqual([{ scope: "local" }]);
    expect(existsSync(outra)).toBe(false);
    rmSync(base, { recursive: true });
  });
});
