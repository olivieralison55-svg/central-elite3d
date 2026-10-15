import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { carregarLegado, indexDoLegado } from "./legado.mjs";
import { METRICAS, par01, par02, par03, par04, par05, par06, par07, par08, par09, par10, par11, par12, par13, par14, par15, par16, par17 } from "./metricas-legado.mjs";
import { relacoesDeTeste } from "./snapshot-de-teste";

// GATE-06, PAR-01…PAR-17: as métricas do app antigo (o index.html do commit LEGADO) sobre os fixtures
// do harness antigo, com "hoje" fixo em 25/09/2026 ao meio-dia de Brasília. Os valores esperados
// saem das regras do mapeamento §3 aplicadas aos fixtures, à mão.

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
let pasta = "";
let arquivo = "";

beforeAll(() => {
  pasta = mkdtempSync(join(tmpdir(), "metricas-legado-"));
  arquivo = indexDoLegado({ cwd: RAIZ, destino: join(pasta, "index.html") }).arquivo;
});
afterAll(() => {
  vi.useRealTimers();
  rmSync(pasta, { recursive: true, force: true });
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-25T15:00:00Z"));
});

const app = (papel = "admin") => carregarLegado({ arquivo, relacoes: relacoesDeTeste(), papel });

describe("métricas do app antigo (GATE-06)", () => {
  it("PAR-01: os contadores do painel por rótulo; o financeiro só para quem vê, e o mentor sem os do contrato", async () => {
    expect(par01(await app())).toEqual({
      "Contratos pendentes de assinatura": 1,
      "Parcelas vencidas em aberto": 1,
      "Mentorados criados pela Lia, sem cadastro completo": 1,
      "Mentorados sem sessão há +30 dias": 2,
      "Mentorados sem subir de marco há +30 dias": 2,
      "Mentorados que ainda não fizeram a sessão de implementação": 3,
      "Sessões aguardando confirmação": 1,
      "Cobranças da Lia sem mentorado identificado": 2,
      "Pesquisa de satisfação da sessão não respondida": 0,
      "Pesquisa de Experiência não respondida": 0,
    });
    expect(par01(await app("mentor"))).toEqual({
      "Mentorados criados pela Lia, sem cadastro completo": 0,
      "Mentorados sem sessão há +30 dias": 2,
      "Mentorados sem subir de marco há +30 dias": 0,
      "Mentorados que ainda não fizeram a sessão de implementação": 3,
      "Sessões aguardando confirmação": 1,
    });
    // O aviso de adesão do mentor (o 12º item): 1 resposta para 4 com sessão, abaixo da meta de 70%.
    const relacoes = relacoesDeTeste();
    relacoes.experiencia_adesao = [{ respostas: 1, mentorados_com_sessao: 4 }];
    const mentor = await carregarLegado({ arquivo, relacoes, papel: "mentor" });
    expect(par01(mentor)["Poucas respostas na Pesquisa de Experiência"]).toBe("1/4");
  });

  it("PAR-02: os ids das listas, na ordem da tela, e os dias de quem não sobe de marco", async () => {
    expect(par02(await app())).toEqual({ orfas: [], risco: ["m2", "m3"], "sem-implementacao": ["m1", "m2", "m3"], "sem-subida": ["m3:359", "m1:258"], "nps-pend": [] });
    expect(par02(await app("mentor"))["sem-subida"]).toEqual([]);
  });

  it("PAR-03: os 4 números gerais", async () => {
    expect(par03(await app())).toEqual({ ativos: 3, pausados: 1, cancelados: 0, concluidas1a1: 2, agendadas1a1: 1, encontros: 1, presencas: 2, encontrosAgendados: 1 });
  });

  it("PAR-04: as próximas sessões na ordem, a 1:1 pelo mentorado com data e hora e o encontro pela chave", async () => {
    expect(par04(await app())).toEqual({ proximas: ["1:1|m1|2099-09-01|14:00:00", "grupo|Sessão de Implementação Mensal|2099-10-15|20:00:00"] });
  });

  it("PAR-05: nível e total de quem tem faturamento", async () => {
    expect(par05(await app())).toEqual({ m1: { nivel: "Prata", total: 15000 } });
  });

  it("PAR-06: a matriz de cada mês do seletor e de Todos, por mentor normalizado", async () => {
    const zero = { "Diagnóstico de Negócio": 0, "Plano de Ação": 0, "Checkup 1": 0 };
    const valores = par06(await app());
    expect(Object.keys(valores).filter((k) => k.endsWith("|__meses__"))).toEqual(["todos|__meses__", "2026-09|__meses__", "2026-08|__meses__", "2026-02|__meses__", "2025-12|__meses__"]);
    expect(valores["todos|evaldo"]).toEqual({ porEtapa: { ...zero, "Diagnóstico de Negócio": 1 }, total1a1: 1, grupo: 0, presencas: 0 });
    expect(valores["todos|sergio"]).toEqual({ porEtapa: zero, total1a1: 0, grupo: 1, presencas: 2 });
    expect(valores["2025-12|israel"]).toEqual({ porEtapa: { ...zero, "Plano de Ação": 1 }, total1a1: 1, grupo: 0, presencas: 0 });
    expect(Object.keys(valores).filter((k) => k.startsWith("2026-09|"))).toEqual(["2026-09|__meses__"]);
  });

  it("PAR-07: os ids de cada aviso da matriz", async () => {
    expect(par07(await app())).toEqual({ dobradas: [], semData: [], semMentor: ["s3"], etapaDeduzida: ["s2"] });
  });

  it("PAR-08: os ids por filtro de Mentorados; o mentor sem contrato pendente e sem incompletos", async () => {
    expect(par08(await app())).toEqual({ todos: ["m1", "m2", "m3", "m4"], ativos: ["m1", "m2", "m3"], pausados: ["m4"], incompletos: ["m3"], contrato: ["m2"] });
    expect(par08(await app("mentor"))).toEqual({ todos: ["m1", "m2", "m3", "m4"], ativos: ["m1", "m2", "m3"], pausados: ["m4"], incompletos: [] });
  });

  it("PAR-09: os ids dos blocos 1:1 e as chaves dos encontros por categoria", async () => {
    expect(par09(await app())).toEqual({
      aguardando: ["s3"],
      agendadas: ["s2"],
      concluidas: ["s1", "s5"],
      bloqueadas: ["s4"],
      "grupo|Plantão de Dúvida Semanal": ["Plantão de Dúvida Semanal|2026-08-06|19:00:00"],
      "grupo|Sessão de Implementação Mensal": ["Sessão de Implementação Mensal|2099-10-15|20:00:00"],
    });
  });

  it("PAR-10: o topo da ficha de cada mentorado; o mentor não vê as parcelas", async () => {
    const vazio = { pagas: null, parcelas: null, concluidas: null, trilha: null, implementacao: null, plantoes: 0 };
    expect(par10(await app())).toEqual({
      m1: { pagas: 0, parcelas: 1, concluidas: 1, trilha: 2, implementacao: null, plantoes: 1 },
      m2: { pagas: 1, parcelas: 2, concluidas: 0, trilha: 2, implementacao: null, plantoes: 1 },
      m3: vazio,
      m4: { ...vazio, concluidas: 1, trilha: 1 },
    });
    expect(par10(await app("mentor")).m2).toEqual({ pagas: null, parcelas: null, concluidas: 0, trilha: 2, implementacao: null, plantoes: 1 });
    // A implementação concluída aparece com a data da tela.
    const relacoes = relacoesDeTeste();
    relacoes.sessoes.push({ ...relacoes.sessoes[0], id: "i1", etapa: "Sessão de Implementação Mensal", ordem: 91, status: "Concluída", data: "2026-09-10", hora: "20:00:00" });
    expect(par10(await carregarLegado({ arquivo, relacoes, papel: "admin" })).m1.implementacao).toBe("10/09/2026");
  });

  it("PAR-11: os cards, as vencidas, os próximos vencimentos, o motivo das órfãs e as descartadas", async () => {
    expect(par11(await app())).toEqual({
      "cards.vencidas": 1,
      "cards.restanteAberto": 1,
      "cards.restanteParcial": 0,
      "cards.assinados": 2,
      "cards.ativos": 3,
      vencidas: ["p1"],
      proximos: ["p3"],
      "orfa|orf1": "o cadastro existe — clique em vincular",
      "orfa|orf2": "a cobrança veio sem e-mail",
      descartadas: ["desc1"],
    });
  });

  it("PAR-12: estado, critérios, régua e falta por rota, mentorado ativo e marco", async () => {
    const valores = par12(await app());
    expect(Object.keys(valores)).toEqual(["r1|m1|mk1", "r1|m1|mk2", "r1|m2|mk1", "r1|m2|mk2", "r1|m3|mk1", "r1|m3|mk2"]);
    expect(valores["r1|m1|mk1"]).toEqual({ fase: "atual", feitos: 2, total: 4, regua: 15000, falta: 0 });
    expect(valores["r1|m1|mk2"]).toEqual({ fase: "futuro", feitos: 0, total: 1, regua: 15000, falta: 5000 });
    expect(valores["r1|m2|mk1"]).toEqual({ fase: "futuro", feitos: 0, total: 4, regua: 0, falta: 500 });
  });

  it("PAR-13: STLSeller nos recortes Ativos e Todos", async () => {
    const valores = par13(await app());
    expect(valores).toMatchObject({
      "ativos|bruto": 1500,
      "ativos|receita": 1234.5,
      "ativos|pedidos": 12,
      "ativos|cancelados": 2,
      "ativos|vendendo": "1/2",
      "ativos|plano": "2/2",
      "ativos|semConta": 0,
      "ativos|concentracao": [1500],
      "ativos|outros": null,
      "ativos|status|pago": 2,
      "ativos|chip|email": 1,
      "ativos|anuncios": ["shopee|SP1", "mercadolivre|MLB1"],
      "todos|vendendo": "1/3",
      "todos|semConta": 1,
      "todos|status|sem_pedido_lia": 1,
      "todos|chip|parado": 2,
      "todos|chip|email": 2,
    });
    expect(Object.keys(valores).filter((k) => k.startsWith("ativos|chip|"))).toEqual(["todos", "vende", "parado", "plano", "fora", "email"].map((c) => `ativos|chip|${c}`));
  });

  it("PAR-14: NPS geral e por mentor, e cada célula por semana e por mês", async () => {
    const valores = par14(await app());
    expect(valores.geral).toEqual({ media: "8,0", nps: "+25", respostas: 4 });
    expect(valores["mentor|diovani"]).toEqual({ media: "9,0", nps: "+67", respostas: 3 });
    // n1 é das 22h de domingo em Brasília: conta na semana de 07/09.
    expect(valores["semana|07/09 a 13/09|todos"]).toEqual({ respostas: 1, media: "10,0", nps: "+100" });
    expect(valores["semana|14/09 a 20/09|todos"]).toEqual({ respostas: 2, media: "6,5", nps: "-50" });
    expect(valores["semana|14/09 a 20/09|diovani"]).toBe("8,0 (1)");
    expect(valores["mes|setembro de 2026|todos"]).toEqual({ respostas: 3, media: "7,7", nps: "0" });
    expect(valores["mes|agosto de 2026|diovani"]).toBe("9,0 (1)");
    expect(Object.keys(valores).filter((k) => k.startsWith("semana|") && k.endsWith("|todos"))).toHaveLength(3);
  });

  it("PAR-15: NPS da mentoria, índice, clareza e o índice de cada item", async () => {
    expect(par15(await app())).toEqual({
      nps: "0",
      respostas: 2,
      media: "7,5",
      indice: "50",
      clareza: "50%",
      "item|Organização dos agendamentos": { indice: 13, respostas: 2 },
      "item|Qualidade das sessões": { indice: 88, respostas: 2 },
    });
  });

  it("PAR-16: a ordem por risco, a contagem e, para quem vê, média e NPS por mentor", async () => {
    const admin = par16(await app());
    expect(admin.ordem).toEqual(["m1", expect.stringMatching(/^nome#[0-9a-f]{12}$/), "inventado"]);
    expect(admin).toMatchObject({ "risco|total": 3, "risco|alto": 1, "risco|medio": 1, "risco|baixo": 1, "mentor|diovani": { media: "9,0", nps: "+67" } });
    const mentor = par16(await app("mentor"));
    expect(mentor.ordem).toEqual(admin.ordem);
    expect(Object.keys(mentor).filter((k) => k.startsWith("mentor|"))).toEqual([]);
    // Uma rodada sem leitura por mentorado: a ordem é vazia e as contagens, 0.
    const relacoes = relacoesDeTeste();
    relacoes.nps_analises = [{ ...relacoes.nps_analises[0], mentorados: [] }];
    expect(par16(await carregarLegado({ arquivo, relacoes, papel: "admin" }))).toMatchObject({ ordem: [], "risco|total": 0, "risco|alto": 0, "risco|medio": 0, "risco|baixo": 0 });
  });

  it("PAR-17: a carteira, as contagens, o NPS de 30 dias e a última atividade de cada mentor", async () => {
    const valores = par17(await app());
    expect(valores.evaldo).toEqual({ carteira: ["m1"], r1_30: 0, r1: 1, grupos30: 0, grupos: 0, agenda: 1, media30: "—", nps30: "—", calls: 0, ultima: "2026-02-01" });
    // Diovani: as duas respostas desde 26/08 (10 e 8); a de 20/08 fica fora dos 30 dias.
    expect(valores.diovani).toMatchObject({ media30: "9,0", nps30: "+50" });
    expect(valores.michelle).toMatchObject({ agenda: 2 });
    expect(valores.israel).toMatchObject({ carteira: [], r1: 1, ultima: "2025-12-05" });
  });

  it("nenhuma métrica devolve nome, e-mail ou comentário de mentorado, em papel nenhum", async () => {
    const r = relacoesDeTeste();
    const pessoais = [
      ...r.mentorados.flatMap((m) => [m.nome, m.email]),
      ...r.nps_respostas.flatMap((n) => [n.nome_informado, n.comentario]),
      ...r.stlseller_mentorados.flatMap((s) => [s.nome, s.email, s.email_stlflix, s.loja_email]),
      ...r.lia_cobrancas.map((c) => c.contact_email),
      "Ana Clara",
    ].filter((v) => typeof v === "string" && v.length > 0);
    for (const [id, metrica, papeis] of METRICAS) {
      for (const papel of papeis) {
        const json = JSON.stringify(metrica(await app(papel)));
        for (const valor of pessoais) expect(json.includes(String(valor)), `${id} ${papel}`).toBe(false);
      }
    }
  });
});
