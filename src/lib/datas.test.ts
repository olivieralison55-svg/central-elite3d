import { afterEach, describe, expect, it, vi } from "vitest";

import { diasAte, diaSP, dpLabel, fmtD, hojeSP, mesDe, prazoTexto, segundaDe } from "./datas";

// Brasília é UTC−3 o ano inteiro: 02:30 UTC é 23:30 do dia anterior lá.
const relogio = (instante: string) => vi.setSystemTime(new Date(instante));

afterEach(() => {
  vi.useRealTimers();
});

describe("hoje e prazos em America/Sao_Paulo (TEST-05, FIN-06, EDGE-03)", () => {
  it("TEST-05: hojeSP() às 23:30 de Brasília (02:30 UTC do dia seguinte) devolve a data de Brasília", () => {
    relogio("2027-03-10T02:30:00Z");
    expect(hojeSP()).toBe("2027-03-09");
  });

  it("EDGE-03: dois hojeSP() com o relógio virando a meia-noite de Brasília devolvem dias diferentes", () => {
    relogio("2027-03-10T02:59:00Z");
    const antes = hojeSP();
    relogio("2027-03-10T03:01:00Z");
    const depois = hojeSP();
    expect([antes, depois]).toEqual(["2027-03-09", "2027-03-10"]);
  });

  it("FIN-06: prazoTexto diz 'venceu há N dias', 'venceu ontem', 'vence hoje', 'vence amanhã' e 'vence em N dias'", () => {
    relogio("2027-03-09T15:00:00Z");
    expect(prazoTexto("2027-03-04")).toBe("venceu há 5 dias");
    expect(prazoTexto("2027-03-07")).toBe("venceu há 2 dias");
    expect(prazoTexto("2027-03-08")).toBe("venceu ontem");
    expect(prazoTexto("2027-03-09")).toBe("vence hoje");
    expect(prazoTexto("2027-03-10")).toBe("vence amanhã");
    expect(prazoTexto("2027-03-11")).toBe("vence em 2 dias");
    expect(prazoTexto("2027-03-12")).toBe("vence em 3 dias");
  });

  it("FIN-06: às 23:30 de Brasília o prazo conta o dia de Brasília, não o de UTC", () => {
    relogio("2027-03-10T02:30:00Z");
    expect(diasAte("2027-03-09")).toBe(0);
    expect(prazoTexto("2027-03-09")).toBe("vence hoje");
    expect(prazoTexto("2027-03-10")).toBe("vence amanhã");
  });

  it("EDGE-03: com a aba aberta depois da meia-noite de Brasília, o prazo seguinte usa a data nova", () => {
    relogio("2027-03-10T02:59:00Z");
    expect(prazoTexto("2027-03-10")).toBe("vence amanhã");
    relogio("2027-03-10T03:01:00Z");
    expect(prazoTexto("2027-03-10")).toBe("vence hoje");
  });

  it("FIN-06: diasAte conta dias de calendário na virada do mês e do ano", () => {
    relogio("2026-12-31T15:00:00Z");
    expect(diasAte("2027-01-01")).toBe(1);
    expect(diasAte("2026-11-30")).toBe(-31);
    expect(diasAte("2027-03-01")).toBe(60);
  });

  it("sem data, diasAte é null e prazoTexto não inventa prazo", () => {
    expect(diasAte(null)).toBeNull();
    expect(diasAte("")).toBeNull();
    expect(prazoTexto(null)).toBe("");
    expect(prazoTexto(undefined)).toBe("");
  });
});

describe("formatadores de data (grupo 'Formatadores e campo de data')", () => {
  it("fmtD monta DD/MM/AAAA; sem data, '—'", () => {
    expect(fmtD("2026-08-20")).toBe("20/08/2026");
    expect(fmtD(null)).toBe("—");
    expect(fmtD("")).toBe("—");
  });

  it("dpLabel: o modo mês rotula Mês/Ano, o modo dia é o fmtD, e vazio fica vazio", () => {
    expect(dpLabel("2026-08", "month")).toBe("Ago/2026");
    expect(dpLabel("2026-01", "month")).toBe("Jan/2026");
    expect(dpLabel("2026-12", "month")).toBe("Dez/2026");
    expect(dpLabel("2026-08-20")).toBe("20/08/2026");
    expect(dpLabel("2026-08-20", "day")).toBe("20/08/2026");
    expect(dpLabel("", "month")).toBe("");
    expect(dpLabel(null)).toBe("");
  });

  it("OPS-04: mesDe dá o AAAA-MM da data que a matriz usa como mês; sem data, vazio", () => {
    expect(mesDe("2026-08-20")).toBe("2026-08");
    expect(mesDe(null)).toBe("");
  });
});

describe("semana do NPS (GER-02)", () => {
  it("diaSP conta o dia em Brasília: resposta de domingo à noite fica no domingo", () => {
    expect(diaSP("2026-09-14T01:00:00Z")).toBe("2026-09-13");
    expect(diaSP("2026-09-16T13:00:00Z")).toBe("2026-09-16");
  });

  it("segundaDe: a semana vai de segunda a domingo", () => {
    expect(segundaDe("2026-09-07")).toBe("2026-09-07");
    expect(segundaDe("2026-09-13")).toBe("2026-09-07");
    expect(segundaDe("2026-09-14")).toBe("2026-09-14");
    expect(segundaDe("2026-09-16")).toBe("2026-09-14");
    expect(segundaDe("2026-09-20")).toBe("2026-09-14");
    expect(segundaDe(diaSP("2026-09-14T01:00:00Z"))).toBe("2026-09-07");
  });
});
