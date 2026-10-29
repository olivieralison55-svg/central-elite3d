import { describe, expect, it } from "vitest";

import type { FaixaRemuneracao, Sessao, Validacao } from "./data/esquemas";
import {
  bloqueiosDaValidacao,
  calendario,
  competenciaAtual,
  competenciasDoSeletor,
  elegivelDasLojas,
  ehDiaUtil,
  faixaDe,
  faixaVigente,
  faltaParaProxima,
  foraDoPrazo,
  montarFechamento,
  passoDoDia,
  sessoesDoMes,
  sugestao,
} from "./faturamento";

const FAIXAS: FaixaRemuneracao[] = [
  { id: 1, piso: "10000.00", teto: "20000.00", valor_hora: "75.00" },
  { id: 2, piso: "20000.01", teto: "50000.00", valor_hora: "100.00" },
  { id: 3, piso: "50000.01", teto: "100000.00", valor_hora: "200.00" },
  { id: 4, piso: "100000.01", teto: "200000.00", valor_hora: "300.00" },
  { id: 5, piso: "200000.01", teto: "500000.00", valor_hora: "400.00" },
  { id: 6, piso: "500000.01", teto: null, valor_hora: "500.00" },
];

const sessao = (campos: Partial<Sessao> & { id: string }): Sessao => ({
  mentorado_id: "m1",
  etapa: "Checkup 1",
  ordem: 3,
  status: "Concluída",
  mentor: "Luan",
  data: "2026-10-10",
  hora: "10:00:00",
  link_meet: null,
  link_gravacao: null,
  link_anotacoes: null,
  google_event_id: null,
  etapa_deduzida: false,
  ...campos,
});

const validacao = (campos: Partial<Validacao> & { competencia: string }): Validacao => ({
  id: campos.competencia,
  mentor: "Luan",
  estado: "validado",
  enviado_em: null,
  alteracao_lojas: null,
  alteracao_lojas_obs: null,
  obs_mentor: null,
  checklist: {},
  motivo_ajuste: null,
  meet_motivo: null,
  meet_em: null,
  obs_admin: null,
  faturamento_elegivel: null,
  faixa_do_mes: null,
  faixa_vigente: null,
  faixa_seguinte: null,
  mudanca: null,
  comunicado_em: null,
  sessoes_ids: null,
  sessoes_qtd: null,
  valor_hora: null,
  valor_pagar: null,
  validado_em: null,
  pago_em: null,
  ...campos,
});

describe("calendário", () => {
  it("pula fim de semana e feriado nacional", () => {
    expect(ehDiaUtil("2026-11-02")).toBe(false); // Finados
    expect(ehDiaUtil("2026-11-01")).toBe(false); // domingo
    expect(ehDiaUtil("2026-11-03")).toBe(true);
    expect(ehDiaUtil("2027-02-08")).toBe(false); // Carnaval de 2027
  });

  it("outubro/2026 é processado de 3 a 9 de novembro", () => {
    const cal = calendario("2026-10");
    expect(cal.envio).toBe("2026-11-03");
    expect(cal.conferencia).toEqual(["2026-11-04", "2026-11-05"]);
    expect(cal.fechamento).toBe("2026-11-06");
    expect(cal.pagamento).toBe("2026-11-09");
    expect(cal.prazoEnvio).toBe("2026-11-03T15:00:00.000Z");
  });

  it("a competência em processo é a do mês anterior, também na virada do ano", () => {
    expect(competenciaAtual("2026-11-04")).toBe("2026-10");
    expect(competenciaAtual("2027-01-05")).toBe("2026-12");
  });

  it("o mês corrente entra no seletor só nos últimos 7 dias", () => {
    expect(competenciasDoSeletor("2026-10-24")[0]).toBe("2026-09");
    expect(competenciasDoSeletor("2026-10-25")).toEqual(["2026-10", "2026-09", "2026-08", "2026-07", "2026-06", "2026-05"]);
    expect(competenciasDoSeletor("2026-02-22")[0]).toBe("2026-02");
    expect(competenciasDoSeletor("2026-02-21")[0]).toBe("2026-01");
    expect(competenciasDoSeletor("2026-12-31")[0]).toBe("2026-12");
    expect(competenciasDoSeletor("2027-01-01")[0]).toBe("2026-12");
  });

  it("o passo do dia no calendário", () => {
    const cal = calendario("2026-10");
    expect(passoDoDia(cal, "2026-11-02")).toBe(0);
    expect(passoDoDia(cal, "2026-11-03")).toBe(1);
    expect(passoDoDia(cal, "2026-11-05")).toBe(3);
    expect(passoDoDia(cal, "2026-11-08")).toBe(4); // domingo entre o D4 e o D5
    expect(passoDoDia(cal, "2026-11-10")).toBe(6);
  });

  it("fora do prazo pelo carimbo do banco, ou pelo relógio quando não enviou", () => {
    const cal = calendario("2026-10");
    expect(foraDoPrazo({ enviado_em: "2026-11-03T14:59:00Z" }, cal, new Date("2026-11-10T00:00:00Z"))).toBe(false);
    expect(foraDoPrazo({ enviado_em: "2026-11-03T15:01:00Z" }, cal, new Date("2026-11-03T15:01:00Z"))).toBe(true);
    expect(foraDoPrazo(null, cal, new Date("2026-11-03T14:00:00Z"))).toBe(false);
    expect(foraDoPrazo(null, cal, new Date("2026-11-03T16:00:00Z"))).toBe(true);
  });
});

describe("faixas", () => {
  it("acha a faixa nos limites e devolve null abaixo de R$ 10 mil", () => {
    expect(faixaDe(10000, FAIXAS)?.id).toBe(1);
    expect(faixaDe(20000, FAIXAS)?.id).toBe(1);
    expect(faixaDe(20000.01, FAIXAS)?.id).toBe(2);
    expect(faixaDe(750000, FAIXAS)?.id).toBe(6);
    expect(faixaDe(9999.99, FAIXAS)).toBeNull();
  });

  it("quanto falta para a próxima faixa", () => {
    expect(faltaParaProxima(26310, faixaDe(26310, FAIXAS), FAIXAS)).toEqual({ faixa: FAIXAS[2], falta: 23690.01 });
    expect(faltaParaProxima(600000, faixaDe(600000, FAIXAS), FAIXAS)).toBeNull();
  });

  it("o elegível desconta cancelamentos, devoluções e reembolsos", () => {
    expect(elegivelDasLojas([{ vendas: "18400", cancelamentos: "400", devolucoes: 0, reembolsos: "100.5" }, { vendas: 9150, cancelamentos: 0, devolucoes: "150", reembolsos: 0 }])).toBe(26899.5);
  });
});

describe("sessões do mês", () => {
  const S = [
    sessao({ id: "a" }),
    // A mesma reunião gravada duas vezes conta uma.
    sessao({ id: "b", etapa: "Checkup 2", google_event_id: "ev" }),
    sessao({ id: "c", mentorado_id: "m2", status: "Aguardando confirmação" }),
    sessao({ id: "d", mentorado_id: "m3", status: "Não compareceu" }),
    sessao({ id: "e", mentorado_id: "m4", etapa: "Plantão de Dúvida Semanal" }), // grupo
    sessao({ id: "f", mentorado_id: "m5", data: "2026-09-30" }), // outro mês
    sessao({ id: "g", mentorado_id: "m6", mentor: "Sergio" }),
    sessao({ id: "h", mentorado_id: "m7", mentor: " luan " }), // outra grafia
  ];

  it("paga só as 1:1 concluídas do mentor no mês, sem contar a mesma reunião duas vezes", () => {
    const r = sessoesDoMes(S, "Luan", "2026-10");
    expect(r.pagas.map((s) => s.id).sort()).toEqual(["a", "h"]);
    expect(r.pendentes.map((s) => s.id)).toEqual(["c"]);
    expect(r.faltas.map((s) => s.id)).toEqual(["d"]);
  });
});

describe("mudança de faixa", () => {
  const hist = [
    validacao({ competencia: "2026-08-01", faixa_vigente: 2, faixa_do_mes: 3, faixa_seguinte: 2 }),
    validacao({ competencia: "2026-09-01", faixa_vigente: 2, faixa_do_mes: 4, faixa_seguinte: 2 }),
  ];

  it("a vigente vem do último mês fechado", () => {
    expect(faixaVigente(hist, "Luan", "2026-10")).toBe(2);
    expect(faixaVigente([], "Luan", "2026-10")).toBeNull();
    expect(faixaVigente([validacao({ competencia: "2026-09-01", faixa_vigente: 2, faixa_seguinte: 1, mudanca: "rebaixamento" })], "Luan", "2026-10")).toBe(1);
  });

  it("promove com 3 meses seguidos acima, para a menor faixa dos 3", () => {
    const s = sugestao(hist, "Luan", "2026-10", 2, 4, FAIXAS);
    expect(s.tipo).toBe("promocao");
    expect(s.tipo === "promocao" && s.faixaSeguinte).toBe(3);
  });

  it("não promove com um mês no meio na faixa vigente", () => {
    const quebrado = [hist[0], validacao({ competencia: "2026-09-01", faixa_vigente: 2, faixa_do_mes: 2, faixa_seguinte: 2 })];
    expect(sugestao(quebrado, "Luan", "2026-10", 2, 4, FAIXAS)).toEqual({ tipo: "manter", faixaSeguinte: 2 });
  });

  it("não conta mês ainda não validado", () => {
    const aberto = [hist[0], { ...hist[1], estado: "ajuste_pedido" }];
    expect(sugestao(aberto, "Luan", "2026-10", 2, 4, FAIXAS).tipo).toBe("manter");
  });

  it("rebaixa com um único mês abaixo do piso", () => {
    expect(sugestao(hist, "Luan", "2026-10", 3, 1, FAIXAS)).toEqual({ tipo: "rebaixamento", faixaSeguinte: 1 });
  });

  it("abaixo da tabela e primeiro mês pedem decisão do admin", () => {
    expect(sugestao(hist, "Luan", "2026-10", 2, null, FAIXAS).tipo).toBe("foraDaTabela");
    expect(sugestao([], "Luan", "2026-10", null, 2, FAIXAS).tipo).toBe("inicial");
  });
});

describe("fechamento", () => {
  it("paga valor hora vigente × sessões e grava a faixa seguinte", () => {
    const pagas = [sessao({ id: "a" }), sessao({ id: "b" })];
    expect(montarFechamento(26310, 2, { tipo: "rebaixamento", faixaSeguinte: 1 }, pagas, FAIXAS, 1)).toEqual({
      faturamento_elegivel: 26310,
      faixa_do_mes: 1,
      faixa_vigente: 2,
      faixa_seguinte: 1,
      mudanca: "rebaixamento",
      sessoes_ids: ["a", "b"],
      sessoes_qtd: 2,
      valor_hora: 100,
      valor_pagar: 200,
    });
  });

  it("lista o que impede validar", () => {
    const v = validacao({ competencia: "2026-10-01", estado: "em_conferencia" });
    expect(bloqueiosDaValidacao({ validacao: v, lojas: 1, pendentes: 0, checklist: { lojas_mes_inteiro: true, deducoes: true, sem_duplicidade: true, elegivel_registrado: true, historico: true }, sugestao: { tipo: "manter", faixaSeguinte: 2 }, vigente: 2 })).toEqual([]);
    expect(bloqueiosDaValidacao({ validacao: v, lojas: 0, pendentes: 2, checklist: {}, sugestao: { tipo: "promocao", faixaSeguinte: 3, ciclo: [] }, vigente: 2 })).toEqual([
      "Nenhuma loja informada",
      "2 sessão(ões) aguardando confirmação no mês",
      "5 item(ns) do checklist sem marcar",
      "Promoção exige o Meet de promoção antes",
    ]);
  });
});
