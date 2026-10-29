import { describe, expect, it } from "vitest";

import { datasetDeTeste, MENTORES_CADASTRO } from "@/test/fixtures";

import type { Sessao } from "./data/esquemas";
import { AVISOS, focoDoAviso, marcadorDeLinhas, matrizMentores, reunioesConcluidas1a1 } from "./matriz";

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

// O cenário do grupo "Matriz por mentor" (tests/testes.mjs:813–829).
const MATRIZ: Sessao[] = [
  // Uma reunião, duas linhas: o sync chamou de "Plano de Ação" o que a trilha registrou como "Checkup 5".
  sessao({ id: "d1", etapa: "Plano de Ação", ordem: 2, mentor: "Evaldo", data: "2026-07-16", hora: "14:00:00", google_event_id: "ev1" }),
  sessao({ id: "d2", etapa: "Checkup 5", ordem: 7, mentor: "Evaldo", data: "2026-07-16", hora: "14:00:00" }),
  // Mesmo dia e mentor, horas diferentes: duas reuniões.
  sessao({ id: "d3", mentorado_id: "m2", etapa: "Checkup 1", mentor: "Luan", data: "2026-07-20", hora: "10:00:00" }),
  sessao({ id: "d4", mentorado_id: "m2", etapa: "Checkup 2", ordem: 4, mentor: "Luan", data: "2026-07-20", hora: "15:00:00" }),
  // Duas grafias do mesmo mentor.
  sessao({ id: "d5", mentorado_id: "m3", etapa: "Checkup 1", mentor: " Sérgio ", data: "2026-07-21", hora: "09:00:00" }),
  sessao({ id: "d6", mentorado_id: "m3", etapa: "Checkup 2", ordem: 4, mentor: "Sergio", data: "2026-07-22", hora: "09:00:00" }),
  // Agosto.
  sessao({ id: "d7", mentorado_id: "m2", etapa: "Checkup 3", ordem: 5, mentor: "Luan", data: "2026-08-04", hora: "10:00:00" }),
  // Concluída sem data: não entra em mês nenhum.
  sessao({ id: "d8", etapa: "Checkup 6", ordem: 8, mentor: "Luan" }),
];

const HOJE = "2026-10-14";
const linhaDe = (sessoes: Sessao[], mes: string | null, mentor: string) => matrizMentores(sessoes, mes, HOJE, MENTORES_CADASTRO).linhas.find((l) => l.mentor === mentor);

describe("matriz mentor × etapa (OPS-02, OPS-03, OPS-04, NAV-10)", () => {
  it("OPS-02: conta reunião, não linha: o par (mentorado, data, hora, mentor) vira uma reunião, fica a linha com google_event_id nulo e o par vai para dobradas", () => {
    const { reunioes, dobradas, contadas } = reunioesConcluidas1a1(MATRIZ);
    expect(reunioes.map((s) => s.id)).toEqual(["d2", "d3", "d4", "d5", "d6", "d7", "d8"]);
    expect(dobradas.map((d) => [d.itens.map((s) => s.id), d.escolhida.id])).toEqual([[["d1", "d2"], "d2"]]);
    expect([...contadas]).toEqual(["d2", "d3", "d4", "d5", "d6", "d7", "d8"]);
  });

  it("OPS-02: no empate pelo google_event_id fica o menor id; sem data, cada linha é uma reunião; só 1:1 concluída conta", () => {
    const par = (a: string, b: string, google: string | null) => [
      sessao({ id: a, data: "2026-07-01", hora: "10:00:00", google_event_id: google }),
      sessao({ id: b, data: "2026-07-01", hora: "10:00:00", google_event_id: google }),
    ];
    expect(reunioesConcluidas1a1(par("x2", "x1", null)).reunioes.map((s) => s.id)).toEqual(["x1"]);
    expect(reunioesConcluidas1a1(par("x2", "x1", "ev")).reunioes.map((s) => s.id)).toEqual(["x1"]);
    expect(reunioesConcluidas1a1([sessao({ id: "z1" }), sessao({ id: "z2" })]).reunioes.map((s) => s.id)).toEqual(["z1", "z2"]);
    const fora = [
      sessao({ id: "agendada", status: "Agendada", data: "2026-07-01" }),
      sessao({ id: "grupo", etapa: "Plantão de Dúvida Semanal", ordem: 90, data: "2026-07-01" }),
    ];
    expect(reunioesConcluidas1a1(fora).reunioes).toEqual([]);
  });

  it("OPS-02: o mentor entra na chave como foi gravado: duas grafias na mesma hora contam duas reuniões", () => {
    const grafias = [
      sessao({ id: "a", data: "2026-07-01", hora: "10:00:00", mentor: "Sergio" }),
      sessao({ id: "b", data: "2026-07-01", hora: "10:00:00", mentor: "Sérgio" }),
    ];
    expect(reunioesConcluidas1a1(grafias).reunioes.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("OPS-02 e OPS-03: em julho, a reunião dobrada conta uma vez, na etapa registrada à mão; duas grafias do Sergio viram uma linha", () => {
    const julho = matrizMentores(MATRIZ, "2026-07", HOJE, MENTORES_CADASTRO);
    expect(julho.mes).toBe("2026-07");
    expect(julho.etapas).toEqual(["Plano de Ação", "Checkup 1", "Checkup 2", "Checkup 3", "Checkup 5", "Checkup 6"]);
    expect(julho.linhas).toEqual([
      { mentor: "Luan", porEtapa: [0, 1, 1, 0, 0, 0], total1a1: 2, grupo: 0, presencas: 0, foraDoProjeto: false },
      { mentor: "Sergio", porEtapa: [0, 1, 1, 0, 0, 0], total1a1: 2, grupo: 0, presencas: 0, foraDoProjeto: false },
      { mentor: "Evaldo", porEtapa: [0, 0, 0, 0, 1, 0], total1a1: 1, grupo: 0, presencas: 0, foraDoProjeto: true },
    ]);
    expect(julho.semMentor).toBeNull();
    expect(julho.temGrupo).toBe(false);
    expect(julho.avisos).toEqual({ dobradas: 1, semData: 1, semMentor: 0, etapaDeduzida: 0 });
  });

  it("OPS-04: o mês recorta: agosto conta só agosto; 'Todos' soma os meses e a sem data, e não avisa sobre ela", () => {
    expect(linhaDe(MATRIZ, "2026-08", "Luan")?.total1a1).toBe(1);
    expect(linhaDe(MATRIZ, "2026-08", "Evaldo")).toBeUndefined();
    const todos = matrizMentores(MATRIZ, "", HOJE, MENTORES_CADASTRO);
    expect(todos.mes).toBe("");
    expect(todos.linhas.find((l) => l.mentor === "Luan")?.total1a1).toBe(4);
    expect(todos.avisos.semData).toBe(0);
  });

  it("OPS-04: sem escolha, o mês corrente se tiver reunião, senão o mais recente com reunião, senão 'Todos'; o seletor sempre oferece o corrente", () => {
    expect(matrizMentores(MATRIZ, null, HOJE, MENTORES_CADASTRO).mes).toBe("2026-08");
    expect(matrizMentores(MATRIZ, null, HOJE, MENTORES_CADASTRO).meses).toEqual(["2026-10", "2026-08", "2026-07"]);
    expect(matrizMentores(MATRIZ, null, "2026-07-30", MENTORES_CADASTRO).mes).toBe("2026-07");
    // Encontro em grupo concluído também faz o mês ter reunião.
    const grupo = sessao({ id: "g", etapa: "Plantão de Dúvida Semanal", ordem: 90, data: "2026-09-10", hora: "19:00:00" });
    expect(matrizMentores([grupo], null, HOJE, MENTORES_CADASTRO).mes).toBe("2026-09");
    // Só concluída sem data: "Todos", e ela ainda conta.
    const semData = matrizMentores([sessao({ id: "z1" })], null, HOJE, MENTORES_CADASTRO);
    expect([semData.mes, semData.linhas.map((l) => [l.mentor, l.total1a1])]).toEqual(["", [["Luan", 1]]]);
    const vazio = matrizMentores([], null, HOJE, MENTORES_CADASTRO);
    expect([vazio.mes, vazio.meses, vazio.linhas, vazio.semMentor]).toEqual(["", ["2026-10"], [], null]);
  });

  it("OPS-04: mês escolhido que o seletor não oferece cai em 'Todos'", () => {
    expect(matrizMentores(MATRIZ, "2025-01", HOJE, MENTORES_CADASTRO).mes).toBe("");
    expect(matrizMentores([], "2026-07", HOJE, MENTORES_CADASTRO).mes).toBe("");
  });

  it("OPS-03: mentor fora do cadastro aparece com o nome intacto e os espaços colapsados, marcado fora do projeto, como quem saiu", () => {
    const vanessa = [
      sessao({ id: "v1", mentor: "Vanessa Sousa", data: "2026-07-02", hora: "10:00:00" }),
      sessao({ id: "v2", mentorado_id: "m2", etapa: "Checkup 2", ordem: 4, mentor: "  Vanessa   Sousa ", data: "2026-07-03", hora: "10:00:00" }),
      sessao({ id: "v3", mentorado_id: "m3", mentor: "luan", data: "2026-07-04", hora: "10:00:00" }),
    ];
    expect(matrizMentores(vanessa, "2026-07", HOJE, MENTORES_CADASTRO).linhas.map((l) => [l.mentor, l.total1a1, l.foraDoProjeto])).toEqual([
      ["Vanessa Sousa", 2, true],
      ["Luan", 1, false],
    ]);
  });

  it("OPS-03: 'Sem mentor identificado' fica fora das linhas, no fim, com as 1:1 e os encontros sem mentor", () => {
    const sem = [
      sessao({ id: "n1", mentor: null, data: "2026-07-02", hora: "10:00:00" }),
      sessao({ id: "n2", mentorado_id: "m2", etapa: "Checkup 2", ordem: 4, mentor: "  ", data: "2026-07-03", hora: "10:00:00" }),
      sessao({ id: "n3", etapa: "Plantão de Dúvida Semanal", ordem: 90, mentor: null, data: "2026-07-08", hora: "19:00:00" }),
      sessao({ id: "n4", mentorado_id: "m2", etapa: "Plantão de Dúvida Semanal", ordem: 90, mentor: null, data: "2026-07-08", hora: "19:00:00" }),
      sessao({ id: "l1", mentor: "Luan", data: "2026-07-05", hora: "10:00:00" }),
    ];
    const julho = matrizMentores(sem, "2026-07", HOJE, MENTORES_CADASTRO);
    expect(julho.linhas.map((l) => l.mentor)).toEqual(["Luan"]);
    expect(julho.semMentor).toEqual({ porEtapa: [1, 1], total1a1: 2, grupo: 1, presencas: 2 });
  });

  it("a coluna Grupo conta encontros, não presenças; as presenças vão à parte", () => {
    const fixtures = datasetDeTeste().sessoes;
    const todos = matrizMentores(fixtures, "", HOJE, MENTORES_CADASTRO);
    expect(todos.temGrupo).toBe(true);
    expect(todos.linhas.find((l) => l.mentor === "Sergio")).toMatchObject({ total1a1: 0, grupo: 1, presencas: 2 });
    expect(matrizMentores(fixtures, "2026-02", HOJE, MENTORES_CADASTRO).temGrupo).toBe(false);
  });

  // O cenário do grupo "Alertas que focam linhas" (tests/testes.mjs:928–939).
  const ALERTAS: Sessao[] = [
    sessao({ id: "x1", etapa: "Plano de Ação", ordem: 2, mentor: "Evaldo", data: "2026-07-16", hora: "14:00:00", google_event_id: "ev1" }),
    sessao({ id: "x2", etapa: "Checkup 5", ordem: 7, mentor: "Evaldo", data: "2026-07-16", hora: "14:00:00" }),
    sessao({ id: "x3", mentorado_id: "m2", mentor: "Luan" }),
    sessao({ id: "x4", mentorado_id: "m2", etapa: "Checkup 2", ordem: 4, status: "Aguardando confirmação", mentor: null, data: "2026-07-20", hora: "10:00:00" }),
    sessao({ id: "x5", mentorado_id: "m3", mentor: "Sergio", data: "2026-07-22", hora: "09:00:00" }),
    sessao({ id: "x6", mentorado_id: "m3", etapa: "Checkup 2", ordem: 4, status: "Agendada", mentor: "Sergio", data: "2099-01-01", etapa_deduzida: true }),
    sessao({ id: "x7", mentorado_id: "m4", etapa: "Plantão de Dúvida Semanal", ordem: 90, status: "Aguardando confirmação", mentor: null, data: "2026-07-25", hora: "19:00:00" }),
  ];

  it("NAV-10: os ids de cada aviso: as duas linhas do par, a concluída sem data, as aguardando sem mentor e as de etapa deduzida", () => {
    const julho = matrizMentores(ALERTAS, "2026-07", HOJE, MENTORES_CADASTRO);
    expect(julho.focos).toEqual({ dobradas: ["x1", "x2"], semData: ["x3"], semMentor: ["x4", "x7"], etapaDeduzida: ["x6"] });
    expect(julho.avisos).toEqual({ dobradas: 1, semData: 1, semMentor: 2, etapaDeduzida: 1 });
    expect(Object.values(julho.focos).flat()).not.toContain("x5");
    // O par de julho não entra no recorte de agosto (o mês corrente, então oferecido no seletor).
    const agosto = matrizMentores(ALERTAS, "2026-08", "2026-08-20", MENTORES_CADASTRO);
    expect([agosto.mes, agosto.focos.dobradas, agosto.avisos.dobradas]).toEqual(["2026-08", [], 0]);
  });

  it("as marcas por linha de Sessões saem do mesmo helper da matriz: uma por linha, a primeira que casa", () => {
    const marca = marcadorDeLinhas(ALERTAS);
    expect(ALERTAS.map((s) => marca(s)?.rotulo ?? null)).toEqual(["ignorada · mesma reunião", "contada", "sem data", "sem mentor", null, "etapa deduzida", "sem mentor"]);
    expect(marca(ALERTAS[1])).toEqual({ rotulo: "contada", tom: "success", dica: "Das linhas desta mesma reunião, é esta que entra na contagem do mentor" });
    expect(marca(ALERTAS[0])?.tom).toBe("warning");
    expect(marca(ALERTAS[5])).toEqual({
      rotulo: "etapa deduzida",
      tom: "info",
      dica: "O título do evento não dizia a etapa; o sync deduziu pela trilha. Abra a sessão e salve para confirmar ou corrigir.",
    });
    // A linha do par também deduzida mostra a marca do par.
    const deduzidaNoPar = ALERTAS.map((s) => (s.id === "x2" ? { ...s, etapa_deduzida: true } : s));
    expect(marcadorDeLinhas(deduzidaNoPar)(deduzidaNoPar[1])?.rotulo).toBe("contada");
  });

  it("NAV-10: o foco é escolhido pelo nome do aviso: os ids daquele aviso, com o título e a dica dele", () => {
    const julho = matrizMentores(ALERTAS, "2026-07", HOJE, MENTORES_CADASTRO);
    expect(Object.fromEntries(Object.entries(AVISOS).map(([chave, aviso]) => [chave, aviso.titulo]))).toEqual({
      dobradas: "Reuniões gravadas em duas etapas",
      semData: "Sessões concluídas sem data",
      semMentor: "Aguardando confirmação sem mentor definido",
      etapaDeduzida: "Etapa escolhida pelo sync, ainda sem confirmação",
    });
    expect(focoDoAviso(julho, "dobradas")).toEqual({ ids: ["x1", "x2"], ...AVISOS.dobradas });
    expect(focoDoAviso(julho, "semMentor")).toEqual({ ids: ["x4", "x7"], ...AVISOS.semMentor });
    expect(AVISOS.dobradas.dica).toContain("contada");
  });
});
