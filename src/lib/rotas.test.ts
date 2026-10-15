import { describe, expect, it } from "vitest";

import { datasetDeTeste, XSS } from "@/test/fixtures";

import type { Faturamento, MarcoDef, MentoradoMarco, Rota } from "./data/esquemas";
import {
  camposDoMarco,
  canaisDaRota,
  criteriosDe,
  estadoDoMarco,
  marcosDaRota,
  metaDoMarco,
  montarEvolucao,
  portoesDe,
  progressoMarco,
  reguaFaturamento,
  resumoFaturamento,
  rotaEscolhida,
  rotuloDoMes,
  serieDeMarcos,
  statusDaRota,
  textoVariacao,
  ultimosMeses,
} from "./rotas";

// O grupo "Rotas" do harness antigo (tests/testes.mjs:1680–1757) e as regras de renderRotas
// (index.html:2203–2606). As asserções saem dos ACs OPS-16 a OPS-19, não do código.

const { rotas, marcos, mentoradoMarcos, canais, faturamento } = datasetDeTeste();
const RICA = rotas[0];
const SIMPLES: Rota = { ...RICA, id: "r2", slug: "marketplace", modelo: "simples", unidade: "mes" };
const [MK1, MK2] = marcos;
const fat = (id: string, mentorado: string, mes: string, canal: string, valor: number | string): Faturamento => ({ id, mentorado_id: mentorado, mes, canal_id: canal, valor });

describe("régua de faturamento (OPS-19)", () => {
  // Fixture: R$ 10.000 em julho e R$ 5.000 em agosto de m1, no canal c1 da rota r1.
  it("unidade acumulado: soma a rota inteira, todos os meses (R$ 15.000, não o mês)", () => {
    expect(reguaFaturamento({ unidade: "acumulado" }, canais, faturamento, "m1", "2026-08")).toBe(15000);
  });

  it("unidade mes: soma só o mês corrente (R$ 5.000 em agosto, R$ 10.000 em julho, 0 em setembro)", () => {
    expect(reguaFaturamento({ unidade: "mes" }, canais, faturamento, "m1", "2026-08")).toBe(5000);
    expect(reguaFaturamento({ unidade: "mes" }, canais, faturamento, "m1", "2026-07")).toBe(10000);
    expect(reguaFaturamento({ unidade: "mes" }, canais, faturamento, "m1", "2026-09")).toBe(0);
  });

  it("soma todos os canais da rota e só eles: outro canal, outro mentorado e canal nulo ficam de fora; numeric em texto soma como número", () => {
    const dois = [...canais, { id: "c2", rota_id: "r1", nome: "Online", ordem: 2 }];
    const registros = [
      ...faturamento,
      fat("f3", "m1", "2026-08-01", "c2", "1500.50"),
      fat("f4", "m1", "2026-08-01", "c9", 99999), // canal de outra rota
      fat("f5", "m2", "2026-08-01", "c1", 77777), // outro mentorado
      { ...fat("f6", "m1", "2026-08-01", "c1", 88888), canal_id: null },
    ];
    expect(reguaFaturamento({ unidade: "mes" }, dois, registros, "m1", "2026-08")).toBe(6500.5);
    expect(reguaFaturamento({ unidade: "acumulado" }, dois, registros, "m1", "2026-08")).toBe(16500.5);
    // O canal c2 não é da rota quando a lista de canais dela não o traz.
    expect(reguaFaturamento({ unidade: "acumulado" }, canais, registros, "m1", "2026-08")).toBe(15000);
  });

  it("a meta mostra quanto falta, e meta batida não pede mais nada; sem meta, sem régua", () => {
    expect(metaDoMarco(MK1, 15000)).toEqual({ meta: 500, falta: 0 });
    expect(metaDoMarco(MK2, 15000)).toEqual({ meta: 20000, falta: 5000 });
    expect(metaDoMarco({ meta_valor: "20000.50" }, 0)).toEqual({ meta: 20000.5, falta: 20000.5 });
    expect(metaDoMarco({ meta_valor: null }, 15000)).toBeNull();
  });
});

describe("teste de passagem (OPS-16, OPS-18)", () => {
  it("os portões trazem o grupo e os itens; portão sem item some, e o grupo nulo vira bloco único", () => {
    expect(portoesDe(MK1).map((g) => g.grupo)).toEqual(["Portão A · Apto a vender", "Portão B · Primeira receita"]);
    expect(portoesDe(MK2)).toEqual([{ grupo: null, itens: ["Tenho calendário fechado para os próximos 3 meses"] }]);
    const vazio: Pick<MarcoDef, "criterios"> = { criterios: [{ grupo: "A", itens: [] }, { grupo: null, itens: ["x"] }] };
    expect(portoesDe(vazio)).toEqual([{ grupo: null, itens: ["x"] }]);
    expect(criteriosDe(MK1)).toEqual(["Tenho produto validado", "Conheço meu CMV", "Bati R$ 500 acumulados na rota", "Registrei " + XSS]);
  });

  it("o progresso conta o que está marcado do catálogo: 2 de 4 é 50%; texto que saiu do catálogo não conta; sem critério, null", () => {
    expect(progressoMarco(MK1, mentoradoMarcos[0])).toEqual({ feitos: 2, total: 4, pct: 50 });
    expect(progressoMarco(MK1, undefined)).toEqual({ feitos: 0, total: 4, pct: 0 });
    expect(progressoMarco(MK1, { criterios_ok: ["Tenho produto validado", "um texto que o catálogo não tem mais"] })).toEqual({ feitos: 1, total: 4, pct: 25 });
    expect(progressoMarco({ criterios: [] }, mentoradoMarcos[0])).toEqual({ feitos: 0, total: 0, pct: null });
    expect(progressoMarco(MK2, { criterios_ok: ["Tenho calendário fechado para os próximos 3 meses"] }).pct).toBe(100);
  });

  const campos = (extra: Partial<Parameters<typeof montarEvolucao>[2]> = {}) => ({
    status: "EM_ANDAMENTO",
    data: "2026-09-16",
    marcados: new Set(["Tenho produto validado", "Conheço meu CMV", "Bati R$ 500 acumulados na rota"]),
    proximaAcao: "  Fechar a inscrição  ",
    bloqueios: "Sem ponto de energia\n\n  Falta banner  ",
    ...extra,
  });

  it("OPS-18: salva o TEXTO dos critérios marcados; o pendente vira criterios_pendentes e o progresso é derivado (3 de 4 = 75)", () => {
    expect(montarEvolucao(RICA, MK1, campos())).toEqual({
      status: "EM_ANDAMENTO",
      data: "2026-09-16",
      criterios_ok: ["Tenho produto validado", "Conheço meu CMV", "Bati R$ 500 acumulados na rota"],
      criterios_pendentes: ["Registrei " + XSS],
      progresso: 75,
      bloqueios: ["Sem ponto de energia", "Falta banner"],
      proxima_acao: "Fechar a inscrição",
    });
  });

  it("OPS-18: o marcado que saiu do catálogo não entra, a lista segue a ordem do catálogo e nada marcado dá progresso 0", () => {
    const fora = montarEvolucao(RICA, MK1, campos({ marcados: new Set(["Conheço meu CMV", "texto antigo"]) }));
    expect(fora).toMatchObject({ criterios_ok: ["Conheço meu CMV"], progresso: 25 });
    expect(fora).toMatchObject({ criterios_pendentes: ["Tenho produto validado", "Bati R$ 500 acumulados na rota", "Registrei " + XSS] });
    expect(montarEvolucao(RICA, MK1, campos({ marcados: new Set() }))).toMatchObject({ criterios_ok: [], progresso: 0 });
  });

  it("marco sem critério grava progresso null, e data e próxima ação vazias vão nulas; bloqueio só com linhas em branco vira lista vazia", () => {
    expect(montarEvolucao(RICA, { criterios: [] }, campos({ data: "", proximaAcao: "   ", bloqueios: "\n  \n" }))).toEqual({
      status: "EM_ANDAMENTO",
      data: null,
      criterios_ok: [],
      criterios_pendentes: [],
      progresso: null,
      bloqueios: [],
      proxima_acao: null,
    });
  });

  it("rota simples grava só status e data: sem critério, sem progresso e sem próxima ação", () => {
    expect(montarEvolucao(SIMPLES, MK1, campos({ status: "passou" }))).toEqual({ status: "passou", data: "2026-09-16" });
    expect(montarEvolucao(SIMPLES, MK1, campos({ data: "" }))).toEqual({ status: "EM_ANDAMENTO", data: null });
  });

  it("os campos do registro abrem com o que está salvo; sem registro, o marco começa não iniciado e vazio", () => {
    const salvo = mentoradoMarcos[0];
    expect(camposDoMarco(RICA, salvo)).toEqual({
      status: "EM_ANDAMENTO",
      data: "2026-05-01",
      marcados: new Set(["Tenho produto validado", "Conheço meu CMV"]),
      proximaAcao: "Fechar inscrição da próxima feira",
      bloqueios: "Sem ponto de energia",
    });
    expect(camposDoMarco(RICA, undefined)).toEqual({ status: "NAO_INICIADO", data: "", marcados: new Set(), proximaAcao: "", bloqueios: "" });
    expect(camposDoMarco(SIMPLES, undefined).status).toBe("nao_passou");
    const nulos: MentoradoMarco = { ...salvo, data: null, bloqueios: null, proxima_acao: null, status: null };
    expect(camposDoMarco(RICA, nulos)).toEqual({ status: "NAO_INICIADO", data: "", marcados: new Set(salvo.criterios_ok), proximaAcao: "", bloqueios: "" });
  });
});

describe("estado do stepper", () => {
  it("rica: concluído é feito; em andamento, aguardando e bloqueado são o atual; o resto é futuro, inclusive NAO_APLICAVEL", () => {
    const fase = (status: string | null) => estadoDoMarco(RICA, { status }).fase;
    expect(fase("CONCLUIDO")).toBe("feito");
    for (const s of ["EM_ANDAMENTO", "AGUARDANDO_VALIDACAO", "BLOQUEADO"]) expect(fase(s), s).toBe("atual");
    for (const s of ["NAO_INICIADO", "NAO_APLICAVEL", "um status que o banco inventou"]) expect(fase(s), s).toBe("futuro");
    expect(estadoDoMarco(RICA, undefined)).toEqual({ status: "NAO_INICIADO", fase: "futuro" });
    expect(estadoDoMarco(RICA, { status: null })).toEqual({ status: "NAO_INICIADO", fase: "futuro" });
  });

  it("simples: passou é feito; sem registro, não passou e futuro", () => {
    expect(estadoDoMarco(SIMPLES, { status: "passou" })).toEqual({ status: "passou", fase: "feito" });
    expect(estadoDoMarco(SIMPLES, undefined)).toEqual({ status: "nao_passou", fase: "futuro" });
    expect(estadoDoMarco(SIMPLES, { status: "nao_passou" }).fase).toBe("futuro");
  });

  it("os status do select e os rótulos: seis na rica, dois na simples, e o status fora da lista aparece cru", () => {
    expect(statusDaRota(RICA).map((s) => s.value)).toEqual(["NAO_INICIADO", "EM_ANDAMENTO", "BLOQUEADO", "AGUARDANDO_VALIDACAO", "CONCLUIDO", "NAO_APLICAVEL"]);
    expect(statusDaRota(RICA).find((s) => s.value === "AGUARDANDO_VALIDACAO")?.label).toBe("Aguard. validação");
    expect(statusDaRota(SIMPLES)).toEqual([
      { value: "nao_passou", label: "Não passou" },
      { value: "passou", label: "Passou" },
    ]);
  });
});

describe("janela de meses, séries e faturamento do canal", () => {
  it("os 12 meses terminam no mês de hoje e atravessam a virada do ano", () => {
    const agosto = ultimosMeses("2026-08-15");
    expect(agosto).toHaveLength(12);
    expect(agosto[0]).toBe("2025-09");
    expect(agosto[11]).toBe("2026-08");
    expect(ultimosMeses("2026-01-31")).toEqual(["2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]);
    expect(ultimosMeses("2026-03-01", 3)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("o rótulo do mês é abreviado com o ano de 2 dígitos", () => {
    expect(rotuloDoMes("2026-08")).toBe("Ago/26");
    expect(rotuloDoMes("2025-01")).toBe("Jan/25");
  });

  it("a série de cada marco conta quem concluiu no mês da data: rica por CONCLUIDO, simples por passou; o resto não conta", () => {
    const meses = ["2026-04", "2026-05", "2026-06"];
    const registro = (mentorado: string, status: string, data: string | null): MentoradoMarco => ({ mentorado_id: mentorado, marco_id: "mk1", status, data, updated_at: null, criterios_ok: [], bloqueios: null, proxima_acao: null });
    const registros = [
      registro("m1", "CONCLUIDO", "2026-05-02"),
      registro("m2", "CONCLUIDO", "2026-05-30"),
      registro("m3", "CONCLUIDO", "2026-06-01"),
      registro("m4", "EM_ANDAMENTO", "2026-05-10"),
      registro("m5", "CONCLUIDO", null),
      { ...registro("m6", "CONCLUIDO", "2026-05-10"), marco_id: "mk2" },
    ];
    expect(serieDeMarcos(marcos, registros, RICA, meses).map((s) => [s.marco.id, s.pontos])).toEqual([
      ["mk1", [0, 2, 1]],
      ["mk2", [0, 1, 0]],
    ]);
    const simples = [registro("m1", "passou", "2026-04-01"), registro("m2", "CONCLUIDO", "2026-04-01")];
    expect(serieDeMarcos([MK1], simples, SIMPLES, meses)[0].pontos).toEqual([1, 0, 0]);
  });

  it("o faturamento do canal soma por mês, e a variação compara o mês corrente com o anterior; sem base, null", () => {
    const registros = [fat("a", "m1", "2026-07-01", "c1", 10000), fat("b", "m1", "2026-08-01", "c1", "3000.50"), fat("c", "m1", "2026-08-01", "c1", 2000)];
    const meses = ["2026-06", "2026-07", "2026-08"];
    expect(resumoFaturamento(registros, meses)).toEqual({ porMes: [0, 10000, 5000.5], atual: 5000.5, anterior: 10000, variacao: -49.995 });
    expect(resumoFaturamento([], meses)).toEqual({ porMes: [0, 0, 0], atual: 0, anterior: 0, variacao: null });
    expect(resumoFaturamento([fat("d", "m1", "2026-08-01", "c1", 100)], meses).variacao).toBeNull();
  });

  it("o texto da variação: sem base, positiva com sinal, negativa e zero", () => {
    expect(textoVariacao(null)).toBe("sem base de comparação");
    expect(textoVariacao(50)).toBe("+50% vs mês anterior");
    expect(textoVariacao(0)).toBe("+0% vs mês anterior");
    expect(textoVariacao(-20)).toBe("-20% vs mês anterior");
  });
});

describe("rota, marcos e canais da rota", () => {
  it("os marcos e os canais de uma rota vêm na ordem, sem os de outra", () => {
    const outros = [{ ...MK1, id: "x1", rota_id: "r2", ordem: 0 }, { ...MK2, ordem: 2 }, { ...MK1, id: "x2", ordem: 1 }];
    expect(marcosDaRota(outros, RICA).map((m) => m.id)).toEqual(["x2", "mk2"]);
    const cs = [
      { id: "c3", rota_id: "r1", nome: "B2B", ordem: 3 },
      { id: "c9", rota_id: "r2", nome: "Outra", ordem: 0 },
      { id: "c1", rota_id: "r1", nome: "Presencial", ordem: 1 },
    ];
    expect(canaisDaRota(cs, RICA).map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("a rota escolhida é a do slug; slug desconhecido, ausente ou rota apagada caem na primeira; sem rota nenhuma, null", () => {
    const duas = [RICA, SIMPLES];
    expect(rotaEscolhida(duas, "marketplace")?.id).toBe("r2");
    expect(rotaEscolhida(duas, null)?.id).toBe("r1");
    expect(rotaEscolhida(duas, "apagada")?.id).toBe("r1");
    expect(rotaEscolhida([], "feiras")).toBeNull();
  });
});
