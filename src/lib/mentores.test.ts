import { describe, expect, it } from "vitest";

import { datasetDeTeste, MENTORES_CADASTRO } from "@/test/fixtures";

import type { Mentorado, NpsResposta, Sessao, Transcricao } from "./data/esquemas";
import { atividadePorMes, haDias, mentoresDaTela, resumoDoMentor, resumosDosMentores, ultimaNotaDe, ultimasRespostas, ultimosMeses, visaoMentores } from "./mentores";

// GER-07: as regras da tela Mentores. Os dados são montados à mão; "hoje" é 15/10/2026, então o
// corte dos 30 dias é 15/09/2026 (inclusive).
const HOJE = "2026-10-15";

const base = datasetDeTeste();
const ficha = (id: string, extra: Partial<Mentorado> = {}): Mentorado => ({ ...base.mentorados[0], id, nome: `Mentorado ${id}`, situacao: "ativo", cancelado: false, ...extra });
let seq = 0;
const sessao = (mentorado: string, mentor: string | null, status: string, data: string | null, extra: Partial<Sessao> = {}): Sessao => ({
  ...base.sessoes[0],
  id: `s${++seq}`,
  mentorado_id: mentorado,
  etapa: "Plano de Ação",
  mentor,
  status,
  data,
  hora: "10:00:00",
  ...extra,
});
const resp = (id: string, mentor: string, nota: number, em: string | null, extra: Partial<NpsResposta> = {}): NpsResposta => ({
  ...base.nps[0],
  id,
  mentor,
  nota,
  respondido_em: em,
  mentorado_id: null,
  nome_informado: null,
  comentario: null,
  ...extra,
});
const call = (drive: string, mentor: string | null, status: string): Transcricao => ({ drive_id: drive, mentor, status, realizada_em: "2026-10-01T12:00:00Z", mentorado_id: null });
const dados = (parcial: Partial<Parameters<typeof resumoDoMentor>[0]> = {}) => ({ sessoes: [], mentorados: [], nps: [], transcricoes: [], analise: null, mentores: [...MENTORES_CADASTRO], ...parcial });
const nomes = (r: { carteira: { m: Mentorado }[] }) => r.carteira.map((c) => c.m.id);

describe("carteira: ativos cuja última 1:1 concluída foi com o mentor (GER-07)", () => {
  const mentorados = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => ficha(id, id === "d" ? { situacao: "pausado" } : {}));
  const sessoes = [
    // a: a concluída mais nova é com a Luan; a mais antiga, com o Diovani.
    sessao("a", "Diovani", "Concluída", "2026-08-01"),
    sessao("a", "Luan", "Concluída", "2026-09-01"),
    // b: o contrário; a mais antiga é da Luan, a mais nova do Diovani.
    sessao("b", "Luan", "Concluída", "2026-08-01"),
    sessao("b", "Diovani", "Concluída", "2026-09-02"),
    // c: a última 1:1 (agendada, com o Diovani) não está concluída e não desloca a concluída da Luan.
    sessao("c", "Luan", "Concluída", "2026-07-01"),
    sessao("c", "Diovani", "Agendada", "2026-11-01"),
    // d: pausado não entra.
    sessao("d", "Luan", "Concluída", "2026-09-03"),
    // e: a mais nova não tem mentor, a seguinte não tem data: valem só as completas.
    sessao("e", "Luan", "Concluída", "2026-06-01"),
    sessao("e", null, "Concluída", "2026-09-04"),
    sessao("e", "Diovani", "Concluída", null),
    // f: a mais nova é de grupo, não 1:1.
    sessao("f", "Luan", "Concluída", "2026-05-01"),
    sessao("f", "Sergio", "Concluída", "2026-09-05", { etapa: "Plantão de Dúvida Semanal" }),
    // g: empate de data entre dois mentores: fica a primeira que apareceu.
    sessao("g", "Diovani", "Concluída", "2026-09-06"),
    sessao("g", "Luan", "Concluída", "2026-09-06"),
    // h: sem 1:1 concluída nenhuma.
    sessao("h", "Luan", "Agendada", "2026-11-02"),
  ];
  const d = dados({ sessoes, mentorados });

  it("a carteira da Luan é a, c, e e f; a do Diovani é b e g; pausado, sem sessão e agendada ficam de fora", () => {
    expect(nomes(resumoDoMentor(d, HOJE, "Luan")).sort()).toEqual(["a", "c", "e", "f"]);
    expect(nomes(resumoDoMentor(d, HOJE, "Diovani")).sort()).toEqual(["b", "g"]);
    expect(nomes(resumoDoMentor(d, HOJE, "Sergio"))).toEqual([]);
  });

  it("o mais tempo sem sessão vem primeiro, e a linha traz a sessão que a decidiu", () => {
    const luan = resumoDoMentor(d, HOJE, "Luan");
    expect(luan.carteira.map((c) => [c.m.id, c.ultima.data])).toEqual([
      ["f", "2026-05-01"],
      ["e", "2026-06-01"],
      ["c", "2026-07-01"],
      ["a", "2026-09-01"],
    ]);
  });

  it("um mentorado fora da carga (sem cadastro) não aparece, e o mentor sem nenhum fica com a carteira vazia", () => {
    expect(nomes(resumoDoMentor(dados({ sessoes }), HOJE, "Luan"))).toEqual([]);
  });
});

describe("1:1, grupo e agenda (GER-07)", () => {
  it("a 1:1 conta por reunião: duas linhas da mesma reunião valem uma, e o corte dos 30 dias é inclusivo", () => {
    const sessoes = [
      sessao("a", "Luan", "Concluída", "2026-10-01", { id: "x1", google_event_id: "g1" }),
      sessao("a", "Luan", "Concluída", "2026-10-01", { id: "x2", google_event_id: null, etapa: "Diagnóstico de Negócio" }),
      sessao("a", "Luan", "Concluída", "2026-09-15"),
      sessao("a", "Luan", "Concluída", "2026-09-14"),
      sessao("a", "Luan", "Agendada", "2026-10-20"),
      sessao("a", "Diovani", "Concluída", "2026-10-02"),
    ];
    const r = resumoDoMentor(dados({ sessoes }), HOJE, "Luan");
    // Três reuniões concluídas (a do dia 01 é uma só); duas nos últimos 30 dias (15/09 entra, 14/09 não).
    expect(r.r1.length).toBe(3);
    expect(r.r1_30.length).toBe(2);
  });

  it("o encontro em grupo conta uma vez por encontro, não por presença, e só os concluídos", () => {
    const grupo = (m: string, status: string, data: string, mentor = "Sergio") => sessao(m, mentor, status, data, { etapa: "Plantão de Dúvida Semanal", hora: "19:00:00" });
    const sessoes = [
      grupo("a", "Concluída", "2026-10-06"),
      grupo("b", "Concluída", "2026-10-06"),
      grupo("c", "Bloqueada", "2026-10-06"),
      grupo("a", "Concluída", "2026-09-15"),
      grupo("a", "Concluída", "2026-09-14"),
      grupo("a", "Agendada", "2026-10-20"),
      grupo("a", "Concluída", "2026-10-07", "Luan"),
    ];
    const r = resumoDoMentor(dados({ sessoes }), HOJE, "Sergio");
    expect(r.grupos.map((g) => g.data).sort()).toEqual(["2026-09-14", "2026-09-15", "2026-10-06"]);
    expect(r.grupos30.length).toBe(2);
    // O de outro mentor não entra, e o 1:1 do Sergio não é contado como grupo.
    expect(r.r1).toEqual([]);
  });

  it("a agenda é das agendadas de hoje em diante, a mais próxima primeiro; hoje entra, ontem e sem data não", () => {
    const sessoes = [
      sessao("a", "Luan", "Agendada", "2026-10-20", { hora: "09:00:00" }),
      sessao("b", "Luan", "Agendada", "2026-10-15", { hora: "15:00:00" }),
      sessao("c", "Luan", "Agendada", "2026-10-15", { hora: "08:00:00" }),
      sessao("d", "Luan", "Agendada", "2026-10-14"),
      sessao("e", "Luan", "Agendada", null),
      sessao("f", "Luan", "Concluída", "2026-10-25"),
      sessao("g", "Luan", "Aguardando confirmação", "2026-10-26"),
      sessao("h", "Diovani", "Agendada", "2026-10-16"),
      sessao("i", "Luan", "Agendada", "2026-10-31", { etapa: "Sessão de Implementação Mensal" }),
    ];
    expect(resumoDoMentor(dados({ sessoes }), HOJE, "Luan").agenda.map((s) => s.mentorado_id)).toEqual(["c", "b", "a", "i"]);
  });

  it("a última atividade é a data mais recente entre as 1:1 e os encontros em grupo; sem nenhuma, nula", () => {
    const sessoes = [
      sessao("a", "Luan", "Concluída", "2026-09-01"),
      sessao("b", "Luan", "Concluída", "2026-09-20", { etapa: "Plantão de Dúvida Semanal" }),
      sessao("c", "Luan", "Agendada", "2026-12-01"),
    ];
    expect(resumoDoMentor(dados({ sessoes }), HOJE, "Luan").ultima).toBe("2026-09-20");
    expect(resumoDoMentor(dados({ sessoes }), HOJE, "Diovani").ultima).toBeNull();
  });
});

describe("NPS de 30 dias, calls e leitura da IA (GER-07)", () => {
  it("o NPS de 30 dias conta o dia de Brasília: 22h do dia 15/09 em Brasília (01h de 16/09 em UTC) entra; 22h do dia 14 não", () => {
    const nps = [
      resp("a", "Luan", 10, "2026-09-16T01:00:00Z"),
      resp("b", "Luan", 2, "2026-09-15T01:00:00Z"),
      resp("c", "Luan", 8, null),
      resp("d", "Luan", 6, "2026-10-14T12:00:00Z"),
      resp("e", "Diovani", 9, "2026-10-14T12:00:00Z"),
    ];
    const r = resumoDoMentor(dados({ nps }), HOJE, "Luan");
    expect(r.nps.length).toBe(4);
    expect(r.nps30.map((x) => x.id)).toEqual(["a", "d"]);
  });

  it("as calls são as aceitas do mentor, e só elas", () => {
    const transcricoes = [call("1", "Luan", "aceita"), call("2", "Luan", "aceita"), call("3", "Luan", "rejeitada"), call("4", "Luan", "pendente"), call("5", "Diovani", "aceita"), call("6", null, "aceita")];
    expect(resumoDoMentor(dados({ transcricoes }), HOJE, "Luan").calls).toBe(2);
    expect(resumoDoMentor(dados({ transcricoes }), HOJE, "Diovani").calls).toBe(1);
    expect(resumoDoMentor(dados({ transcricoes }), HOJE, "Sergio").calls).toBe(0);
  });

  it("a leitura da IA vem pelo nome do mentor; sem análise, ou no recorte do mentor (sem `mentores`), é nula", () => {
    const analise = base.analise;
    if (!analise) throw new Error("o fixture não traz análise");
    expect(resumoDoMentor(dados({ analise }), HOJE, "Diovani").leitura?.mentor).toBe("Diovani");
    expect(resumoDoMentor(dados({ analise }), HOJE, "Luan").leitura).toBeNull();
    expect(resumoDoMentor(dados({ analise: null }), HOJE, "Diovani").leitura).toBeNull();
    const { mentores: _mentores, ...recorte } = analise;
    expect(resumoDoMentor(dados({ analise: recorte }), HOJE, "Diovani").leitura).toBeNull();
  });
});

describe("a visão geral e a lista de mentores (GER-07)", () => {
  it("os da lista atual vêm primeiro e depois quem só aparece nas sessões, em ordem do português", () => {
    const sessoes = [sessao("a", "Israel", "Concluída", "2026-01-01"), sessao("b", "Evaldo", "Concluída", "2026-01-01"), sessao("c", "Álvaro", "Agendada", null), sessao("d", null, "Concluída", "2026-01-01"), sessao("e", "Luan", "Concluída", "2026-01-01")];
    const lista = mentoresDaTela(sessoes, MENTORES_CADASTRO);
    expect(lista.slice(0, 7)).toEqual(["Luan", "Sergio", "Diovani", "Petare", "Michelle", "André", "Gabriella"]);
    expect(lista.slice(7)).toEqual(["Álvaro", "Evaldo", "Israel"]);
  });

  it("é ativo o mentor atual, ou quem teve 1:1 em 30 dias ou tem agenda; os outros são histórico, e os totais somam todos", () => {
    const sessoes = [
      sessao("a", "Israel", "Concluída", "2026-10-01"),
      sessao("b", "Evaldo", "Concluída", "2026-03-01"),
      sessao("c", "Álvaro", "Agendada", "2026-11-01"),
      sessao("d", "Luan", "Concluída", "2026-10-02"),
      sessao("e", "Sergio", "Concluída", "2026-10-03", { etapa: "Plantão de Dúvida Semanal" }),
    ];
    const d = dados({ sessoes });
    const v = visaoMentores(resumosDosMentores(d, HOJE), d.nps, HOJE, MENTORES_CADASTRO);
    expect(v.ativos.map((r) => r.nome)).toEqual(["Luan", "Sergio", "Diovani", "Petare", "Michelle", "André", "Gabriella", "Álvaro", "Israel"]);
    expect(v.historico.map((r) => r.nome)).toEqual(["Evaldo"]);
    // 1:1: Israel (01/10), Evaldo (março) e Luan (02/10): três no total e duas em 30 dias. Grupo: um. Agenda: um.
    expect(v.totais).toEqual({ r1_30: 2, r1: 3, grupos30: 1, grupos: 1, agenda: 1 });
  });

  it("o NPS de 30 dias do card é de todas as respostas, de qualquer mentor", () => {
    const nps = [resp("a", "Luan", 10, "2026-10-01T12:00:00Z"), resp("b", "Quem não está na lista", 4, "2026-10-02T12:00:00Z"), resp("c", "Luan", 9, "2026-08-01T12:00:00Z")];
    const v = visaoMentores([], nps, HOJE, []);
    expect(v.nps30).toEqual({ media: 7, nps: 0 });
    expect(visaoMentores([], [], HOJE, []).nps30).toEqual({ media: null, nps: null });
  });
});

describe("os 6 meses e as 10 respostas (GER-07)", () => {
  it("haDias conta em dias de calendário, virando mês e ano", () => {
    expect([haDias("2026-10-15", 30), haDias("2026-03-01", 30), haDias("2026-01-10", 30), haDias("2026-10-15", 0)]).toEqual(["2026-09-15", "2026-01-30", "2025-12-11", "2026-10-15"]);
  });

  it("os 6 últimos meses terminam no mês de hoje e viram o ano, do mais recente para o mais antigo", () => {
    expect(ultimosMeses("2026-02-10")).toEqual(["2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09"]);
    expect(ultimosMeses("2026-10-31")).toEqual(["2026-10", "2026-09", "2026-08", "2026-07", "2026-06", "2026-05"]);
    expect(ultimosMeses("2026-03-31", 2)).toEqual(["2026-03", "2026-02"]);
  });

  it("a atividade por mês: 1:1 e grupo pelo dia da sessão, respostas e média pelo dia de Brasília; fora dos 6 meses não entra", () => {
    const sessoes = [
      sessao("a", "Luan", "Concluída", "2026-10-02"),
      sessao("b", "Luan", "Concluída", "2026-10-09"),
      sessao("c", "Luan", "Concluída", "2026-08-20"),
      sessao("d", "Luan", "Concluída", "2026-03-20"),
      sessao("e", "Luan", "Concluída", "2026-09-10", { etapa: "Plantão de Dúvida Semanal" }),
    ];
    // 23h do dia 30/09 em Brasília é 02h de 01/10 em UTC: a resposta é de setembro.
    const nps = [resp("a", "Luan", 10, "2026-10-01T02:00:00Z"), resp("b", "Luan", 6, "2026-09-12T12:00:00Z"), resp("c", "Luan", 9, "2026-10-05T12:00:00Z"), resp("d", "Luan", 3, "2026-03-05T12:00:00Z")];
    const a = atividadePorMes(resumoDoMentor(dados({ sessoes, nps }), HOJE, "Luan"), HOJE);
    expect(a.map((x) => x.mes)).toEqual(["2026-10", "2026-09", "2026-08", "2026-07", "2026-06", "2026-05"]);
    expect(a[0]).toEqual({ mes: "2026-10", r1: 2, grupos: 0, respostas: 1, media: 9 });
    expect(a[1]).toEqual({ mes: "2026-09", r1: 0, grupos: 1, respostas: 2, media: 8 });
    expect(a[2]).toEqual({ mes: "2026-08", r1: 1, grupos: 0, respostas: 0, media: null });
    expect(a.reduce((s, x) => s + x.r1, 0)).toBe(3);
  });

  it("as últimas respostas são 10, da mais recente para a mais antiga, e a última nota de um mentorado é a mais nova dele", () => {
    const nps = Array.from({ length: 12 }, (_, i) => resp(`r${i}`, "Luan", 8, new Date(Date.UTC(2026, 8, 1 + i, 15)).toISOString(), { mentorado_id: i % 2 ? "a" : "b", nota: i }));
    const r = resumoDoMentor(dados({ nps }), HOJE, "Luan");
    expect(ultimasRespostas(r).map((x) => x.id)).toEqual(["r11", "r10", "r9", "r8", "r7", "r6", "r5", "r4", "r3", "r2"]);
    expect(ultimaNotaDe(r, "a")?.id).toBe("r11");
    expect(ultimaNotaDe(r, "b")?.id).toBe("r10");
    expect(ultimaNotaDe(r, "ninguém")).toBeNull();
    expect(ultimasRespostas(resumoDoMentor(dados(), HOJE, "Luan"))).toEqual([]);
  });
});
