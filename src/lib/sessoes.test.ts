import { describe, expect, it } from "vitest";

import { datasetDeTeste } from "@/test/fixtures";

import type { Sessao } from "./data/esquemas";
import { agruparGrupo, blocos1a1, casaEncontro, eh1a1, ehGrupo, resumoStatusGrupo, sessoes1a1De, sessoesGrupoDe, statusGrupo, trilhaDe } from "./sessoes";

// Os fixtures do harness antigo: m1 tem s1, s2 (1:1) e g1, g4 (grupo); o plantão de 06/08 reúne
// g1, g2 e g3 (uma presença bloqueada); a implementação de 2099 reúne g4 e g5.
const DADOS = datasetDeTeste();
const SESSOES = DADOS.sessoes;
const NOMES = new Map(DADOS.mentorados.map((m) => [m.id, m.nome ?? "—"]));
const nomeDe = (id: string | null) => (id !== null && NOMES.get(id)) || "—";

const sessao = (campos: Partial<Sessao> & { id: string }): Sessao => ({
  mentorado_id: "m1",
  etapa: "Checkup 1",
  ordem: 3,
  status: "Concluída",
  mentor: "Luan",
  data: null,
  hora: null,
  link_meet: null,
  link_gravacao: null,
  link_anotacoes: null,
  google_event_id: null,
  etapa_deduzida: false,
  ...campos,
});
const plantao = (id: string, campos: Partial<Sessao> = {}) =>
  sessao({ id, etapa: "Plantão de Dúvida Semanal", ordem: 90, data: "2026-01-07", hora: "19:00:00", mentor: "Sergio", ...campos });

describe("sessões 1:1 e em grupo (OPS-05, OPS-07, OPS-09, EDGE-05)", () => {
  it("1:1 × grupo: plantão e implementação são grupo; checkup e etapa fora do catálogo são 1:1; nulo não é grupo", () => {
    expect(ehGrupo({ etapa: "Plantão de Dúvida Semanal" })).toBe(true);
    expect(ehGrupo({ etapa: "Sessão de Implementação Mensal" })).toBe(true);
    expect(ehGrupo({ etapa: "Checkup 3" })).toBe(false);
    expect(eh1a1({ etapa: "Checkup 3" })).toBe(true);
    expect(eh1a1({ etapa: "Checkup extra" })).toBe(true);
    expect(eh1a1({ etapa: "Plantão de Dúvida Semanal" })).toBe(false);
    expect(ehGrupo(null)).toBe(false);
    expect(ehGrupo({ etapa: null })).toBe(false);
  });

  it("OPS-07: o encontro é a chave (etapa, data, hora): datas ou horas diferentes partem o encontro, e o mentor fica fora da chave", () => {
    expect(agruparGrupo([])).toEqual([]);
    const ids = (lista: Sessao[]) => agruparGrupo(lista).map((e) => e.itens.map((s) => s.id));
    expect(ids([plantao("a"), plantao("b", { data: "2026-01-14" })])).toEqual([["a"], ["b"]]);
    expect(ids([plantao("a"), plantao("b", { hora: "20:00:00" })])).toEqual([["a"], ["b"]]);
    expect(ids([plantao("a"), plantao("b", { etapa: "Sessão de Implementação Mensal" })])).toEqual([["a"], ["b"]]);
    expect(ids([plantao("a", { mentor: "Sergio" }), plantao("b", { mentor: "Luan" }), plantao("c", { mentorado_id: "m2" })])).toEqual([["a", "b", "c"]]);
  });

  it("OPS-07: o encontro herda o primeiro mentor e o primeiro link não nulos dos participantes", () => {
    const [encontro] = agruparGrupo([
      plantao("a", { mentor: null }),
      plantao("b", { mentor: "Luan", link_meet: "https://meet.google.com/b" }),
      plantao("c", { mentor: "Sergio", link_meet: "https://meet.google.com/c", link_gravacao: "https://exemplo.com/c", link_anotacoes: "https://exemplo.com/notas-c" }),
    ]);
    expect(encontro).toMatchObject({
      etapa: "Plantão de Dúvida Semanal",
      data: "2026-01-07",
      hora: "19:00:00",
      mentor: "Luan",
      link_meet: "https://meet.google.com/b",
      link_gravacao: "https://exemplo.com/c",
      link_anotacoes: "https://exemplo.com/notas-c",
    });
  });

  it("1:1 × grupo nos fixtures: 5 presenças viram 2 encontros; o plantão tem 3 participantes, herda o link de quem tem e resume as presenças", () => {
    const encontros = agruparGrupo(SESSOES.filter(ehGrupo));
    expect(encontros.map((e) => [e.etapa, e.itens.length])).toEqual([
      ["Plantão de Dúvida Semanal", 3],
      ["Sessão de Implementação Mensal", 2],
    ]);
    const [plantaoDosFixtures, implementacao] = encontros;
    expect(plantaoDosFixtures.link_gravacao).toBe("https://exemplo.com/g1");
    expect(statusGrupo(plantaoDosFixtures)).toBe("Concluída");
    expect(resumoStatusGrupo(plantaoDosFixtures)).toBe("2 concluídas · 1 bloqueada");
    expect(statusGrupo(implementacao)).toBe("Agendada");
    expect(resumoStatusGrupo(implementacao)).toBe("2 agendadas");
  });

  it("OPS-05: a trilha é só 1:1, na ordem da trilha: sessoes1a1De ignora grupo e sessoesGrupoDe traz só grupo", () => {
    expect(sessoes1a1De(SESSOES, "m1").map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(sessoesGrupoDe(SESSOES, "m1").map((s) => s.id)).toEqual(["g1", "g4"]);
    expect(sessoes1a1De([...SESSOES].reverse(), "m2").map((s) => s.id)).toEqual(["s3", "s4"]);
    expect(sessoesGrupoDe([...SESSOES].reverse(), "m2").map((s) => s.id)).toEqual(["g2", "g5"]);
    expect(sessoes1a1De(SESSOES, "m3")).toEqual([]);
  });

  it("OPS-05: a trilha de 12 segmentos tem um segmento por 1:1, com o tom do status e 'etapa: status'", () => {
    expect(trilhaDe(SESSOES, "m1")).toEqual([
      { tone: "success", label: "Diagnóstico de Negócio: Concluída" },
      { tone: "primary", label: "Plano de Ação: Agendada" },
    ]);
    expect(trilhaDe(SESSOES, "m2")).toEqual([
      { tone: "neutral", label: "Diagnóstico de Negócio: Aguardando confirmação" },
      { tone: "danger", label: "Checkup 1: Bloqueada" },
    ]);
    expect(trilhaDe(SESSOES, "m3")).toEqual([]);
  });

  // 35 concluídas com data, a de menor `ordem` sendo a mais antiga (o corte de hoje, por ordem,
  // mostraria as 30 mais antigas), uma concluída sem data e uma de cada outro status.
  const DIA = 86_400_000;
  const datadas = Array.from({ length: 35 }, (_, i) =>
    sessao({ id: `c${i}`, ordem: i, data: new Date(Date.UTC(2026, 0, 1) + i * DIA).toISOString().slice(0, 10), hora: "10:00:00" }),
  );
  const outras = [
    sessao({ id: "sem-data", data: null }),
    sessao({ id: "aguardando", status: "Aguardando confirmação", data: "2026-03-01" }),
    sessao({ id: "agendada", status: "Agendada", data: "2099-01-01" }),
    sessao({ id: "bloqueada", status: "Bloqueada" }),
    sessao({ id: "nao-iniciada", status: "Não iniciada" }),
  ];
  // Fora de ordem de propósito: a entrada não decide quem fica.
  const lista = [...datadas.filter((_, i) => i % 2 === 0), ...outras, ...datadas.filter((_, i) => i % 2 === 1)];

  it("OPS-09: fora de foco, 'Concluídas (últimas 30)' são as 30 concluídas de data mais recente, entre os quatro blocos", () => {
    const blocos = blocos1a1(lista, false);
    expect(blocos.map((b) => [b.chave, b.titulo])).toEqual([
      ["aguardando", "Aguardando confirmação"],
      ["agendadas", "Agendadas"],
      ["concluidas", "Concluídas (últimas 30)"],
      ["bloqueadas", "Bloqueadas"],
    ]);
    expect(blocos.map((b) => b.itens.length)).toEqual([1, 1, 30, 1]);
    expect(blocos[0].itens[0].id).toBe("aguardando");
    expect(blocos[1].itens[0].id).toBe("agendada");
    expect(blocos[3].itens[0].id).toBe("bloqueada");
    expect(new Set(blocos[2].itens.map((s) => s.id))).toEqual(new Set(datadas.slice(5).map((s) => s.id)));
  });

  it("OPS-09: sob foco não há corte: o bloco é 'Concluídas', com todas as concluídas", () => {
    const concluidas = blocos1a1(lista, true)[2];
    expect(concluidas.titulo).toBe("Concluídas");
    expect(new Set(concluidas.itens.map((s) => s.id))).toEqual(new Set([...datadas.map((s) => s.id), "sem-data"]));
  });

  it("OPS-07: a busca vem depois de agrupar: o encontro casa por qualquer participante, mentor, etapa ou data, e continua com todos", () => {
    const encontros = agruparGrupo(SESSOES.filter(ehGrupo));
    const casam = (termo: string) => encontros.filter((e) => casaEncontro(e, termo, nomeDe)).map((e) => [e.etapa, e.itens.length]);
    // Carla (m4) só está no plantão: o encontro aparece inteiro, com os 3 participantes.
    expect(casam("carla")).toEqual([["Plantão de Dúvida Semanal", 3]]);
    expect(casam("bruno")).toEqual([
      ["Plantão de Dúvida Semanal", 3],
      ["Sessão de Implementação Mensal", 2],
    ]);
    expect(casam("michelle")).toEqual([["Sessão de Implementação Mensal", 2]]);
    expect(casam("06/08/2026")).toEqual([["Plantão de Dúvida Semanal", 3]]);
    expect(casam("implementacao")).toEqual([["Sessão de Implementação Mensal", 2]]);
    expect(casam("zzz")).toEqual([]);
    expect(casam("")).toHaveLength(2);
  });

  it("EDGE-05: status fora de S_STATUS ou nulo não quebra: vem cru no encontro, no resumo e na trilha, e não entra em bloco", () => {
    const [encontro] = agruparGrupo([plantao("x1", { status: "Remarcada" }), plantao("x2", { status: null }), plantao("x3", { status: "Remarcada" })]);
    expect(statusGrupo(encontro)).toBe("Remarcada");
    expect(resumoStatusGrupo(encontro)).toBe("2 remarcada · 1 —");
    expect(trilhaDe([sessao({ id: "y1", mentorado_id: "m9", etapa: "Checkup 2", status: "Remarcada" })], "m9")).toEqual([
      { tone: "neutral", label: "Checkup 2: Remarcada" },
    ]);
    const blocos = blocos1a1([sessao({ id: "y1", status: "Remarcada" }), sessao({ id: "y2", status: null })], false);
    expect(blocos.map((b) => b.itens.length)).toEqual([0, 0, 0, 0]);
  });
});
