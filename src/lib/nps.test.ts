import { describe, expect, it } from "vitest";

import { datasetDeTeste } from "@/test/fixtures";

import type { ExpResposta, Mentorado, NpsResposta } from "./data/esquemas";
import {
  chavePeriodo,
  fmtMedia,
  fmtNps,
  linhaDoPeriodo,
  mediaNps,
  mentoresDoNps,
  ORDEM_RESPOSTAS,
  paginar,
  periodosDoNps,
  respostasDoNps,
  resumoExperiencia,
  rotuloPeriodoNps,
  scoreNps,
  tomDaNota,
  tomDaResposta,
  tomDoIndice,
} from "./nps";

// GER-02 a GER-04: as regras do NPS. As respostas abaixo são montadas à mão, cada uma por um ramo.
const resp = (id: string, nota: number | null, extra: Partial<NpsResposta> = {}): NpsResposta => ({
  id,
  mentor: "Diovani",
  nota,
  respondido_em: "2026-09-16T13:00:00Z",
  mentorado_id: null,
  nome_informado: null,
  comentario: null,
  clareza: null,
  direcionamento: null,
  apoio: null,
  ...extra,
});
const notas = (...ns: number[]) => ns.map((n, i) => resp(`r${i}`, n));

describe("NPS e média (GER-02)", () => {
  it("NPS = round(100 · (#nota ≥ 9 − #nota ≤ 6) / n): 9 e 10 promovem, 7 e 8 são neutras, 0 a 6 detratam fora do 7", () => {
    // 2 promotores (9, 10), 2 neutras (7, 8), 1 detrator (6): 100 · (2 − 1) / 5 = 20.
    expect(scoreNps(notas(9, 10, 7, 8, 6))).toBe(20);
    // As fronteiras: 9 conta, 8 não; 6 conta, 7 não.
    expect(scoreNps(notas(9))).toBe(100);
    expect(scoreNps(notas(8))).toBe(0);
    expect(scoreNps(notas(6))).toBe(-100);
    expect(scoreNps(notas(7))).toBe(0);
    expect(scoreNps(notas(10, 0, 5, 6, 7, 8))).toBe(-33);
    expect(scoreNps(notas(10, 10, 8))).toBe(67);
  });

  it("o resultado é arredondado, e a metade vai para cima, como o Math.round de hoje", () => {
    // 100 · 1 / 8 = 12,5 -> 13. 100 · −1 / 8 = −12,5 -> −12 (parity: Math.round, não afasta do zero).
    expect(scoreNps(notas(10, 7, 7, 7, 7, 7, 7, 7))).toBe(13);
    expect(scoreNps(notas(0, 8, 8, 8, 8, 8, 8, 8))).toBe(-12);
  });

  it("sem resposta não há NPS nem média, e o formato mostra o traço", () => {
    expect([scoreNps([]), mediaNps([])]).toEqual([null, null]);
    expect([fmtNps(null), fmtMedia(null)]).toEqual(["—", "—"]);
  });

  it("fmtNps põe o sinal só no positivo", () => {
    expect([fmtNps(20), fmtNps(0), fmtNps(-17), fmtNps(100)]).toEqual(["+20", "0", "-17", "+100"]);
  });

  it("a média tem 1 casa, em português", () => {
    expect(mediaNps(notas(10, 7))).toBe(8.5);
    expect([fmtMedia(8.5), fmtMedia(9), fmtMedia(mediaNps(notas(10, 9, 7)))]).toEqual(["8,5", "9,0", "8,7"]);
  });

  it("nota nula conta como 0, como o Number(nota) de hoje: detrator, e entra na média", () => {
    expect(scoreNps([resp("a", 10), resp("b", null)])).toBe(0);
    expect(mediaNps([resp("a", 10), resp("b", null)])).toBe(5);
  });

  it("as cores: nota 9 e 10 verde, 7 e 8 âmbar, o resto vermelho; as perguntas novas por prefixo; o índice por 75 e 50", () => {
    expect([10, 9, 8, 7, 6, 0].map(tomDaNota)).toEqual(["success", "success", "warning", "warning", "danger", "danger"]);
    expect(["Sim", "sim, claro", "Parcialmente", "parcial", "Não", "Talvez"].map(tomDaResposta)).toEqual(["success", "success", "warning", "warning", "danger", "danger"]);
    expect([100, 75, 74.9, 50, 49.9, 0].map(tomDoIndice)).toEqual(["success", "success", "warning", "warning", "danger", "danger"]);
  });
});

describe("o dia, a semana e o mês em Brasília (GER-02)", () => {
  // Domingo 13/09/2026 às 22h em Brasília é segunda 14/09 à 01h em UTC.
  const domingoDeNoite = resp("a", 10, { respondido_em: "2026-09-14T01:00:00Z" });
  const segundaDeMadrugada = resp("b", 10, { respondido_em: "2026-09-14T03:30:00Z" });

  it("uma resposta às 22h de domingo em Brasília conta no domingo, na semana que começou em 07/09", () => {
    expect(chavePeriodo(domingoDeNoite, "semana")).toBe("2026-09-07");
    // 00h30 de segunda em Brasília já é a semana seguinte.
    expect(chavePeriodo(segundaDeMadrugada, "semana")).toBe("2026-09-14");
  });

  it("o mês também é o de Brasília: 23h do dia 30 em Brasília (02h de 1º em UTC) é setembro", () => {
    expect(chavePeriodo(resp("a", 8, { respondido_em: "2026-10-01T02:00:00Z" }), "mes")).toBe("2026-09");
    expect(chavePeriodo(resp("a", 8, { respondido_em: "2026-08-01T02:00:00Z" }), "mes")).toBe("2026-07");
    expect(chavePeriodo(resp("a", 8, { respondido_em: "2026-10-01T03:00:00Z" }), "mes")).toBe("2026-10");
  });

  it("o domingo à tarde também fecha a semana, e a segunda abre a seguinte, num fim de mês", () => {
    // Domingo 04/10/2026 às 20h em Brasília; segunda 05/10.
    expect(chavePeriodo(resp("a", 8, { respondido_em: "2026-10-04T23:00:00Z" }), "semana")).toBe("2026-09-28");
    expect(chavePeriodo(resp("a", 8, { respondido_em: "2026-10-05T12:00:00Z" }), "semana")).toBe("2026-10-05");
  });

  it("resposta sem data não tem período e não abre linha na tabela", () => {
    const semData = resp("a", 8, { respondido_em: null });
    expect(chavePeriodo(semData, "semana")).toBeNull();
    expect(periodosDoNps([semData, domingoDeNoite], "semana")).toEqual(["2026-09-07"]);
  });

  it("os períodos saem únicos e do mais recente para o mais antigo", () => {
    const { nps } = datasetDeTeste();
    // n1 (domingo), n2 e n3 (semana de 14/09), n4 (agosto).
    expect(periodosDoNps(nps, "semana")).toEqual(["2026-09-14", "2026-09-07", "2026-08-17"]);
    expect(periodosDoNps(nps, "mes")).toEqual(["2026-09", "2026-08"]);
  });

  it("o rótulo da semana vai da segunda ao domingo, mesmo entre meses; o do mês é o nome do mês", () => {
    expect(rotuloPeriodoNps("2026-09-07", "semana")).toBe("07/09 a 13/09");
    expect(rotuloPeriodoNps("2026-09-28", "semana")).toBe("28/09 a 04/10");
    expect(rotuloPeriodoNps("2026-12-28", "semana")).toBe("28/12 a 03/01");
    expect(rotuloPeriodoNps("2026-09", "mes")).toBe("setembro de 2026");
    expect(rotuloPeriodoNps("2026-12", "mes")).toBe("dezembro de 2026");
  });

  it("a linha do período traz o geral e, por mentor, a média e as respostas; quem não respondeu fica sem média", () => {
    const { nps } = datasetDeTeste();
    const linha = linhaDoPeriodo(nps, "semana", "2026-09-14", ["Diovani", "Ninguém"]);
    // n2 (Diovani, 8) e n3 (outro mentor, 5): a média geral conta as duas, e a coluna do Diovani só a dele.
    expect(linha).toMatchObject({ chave: "2026-09-14", respostas: 2, media: 6.5, nps: -50 });
    expect(linha.porMentor.get("Diovani")).toEqual({ media: 8, n: 1 });
    expect(linha.porMentor.get("Ninguém")).toEqual({ media: null, n: 0 });
  });
});

describe("a lista de respostas, a página e o filtro de mentor (GER-03, GER-04)", () => {
  it("os mentores saem sem repetir, na ordem do português, e mentor nulo não é coluna", () => {
    const l = [resp("a", 8, { mentor: "Zé" }), resp("b", 8, { mentor: "Álvaro" }), resp("c", 8, { mentor: "Zé" }), resp("d", 8, { mentor: null }), resp("e", 8, { mentor: "Bia" })];
    expect(mentoresDoNps(l)).toEqual(["Álvaro", "Bia", "Zé"]);
  });

  it("paginar corta 10 ou 20 por página e prende a página pedida ao que existe", () => {
    const lista = Array.from({ length: 25 }, (_, i) => i);
    expect(paginar(lista, 1, 10)).toEqual({ itens: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], pagina: 1, paginas: 3 });
    expect(paginar(lista, 3, 10)).toEqual({ itens: [20, 21, 22, 23, 24], pagina: 3, paginas: 3 });
    expect(paginar(lista, 99, 10).pagina).toBe(3);
    for (const ruim of [0, -4, Number.NaN]) expect(paginar(lista, ruim, 10).pagina, String(ruim)).toBe(1);
    expect(paginar(lista, 2, 20)).toEqual({ itens: [20, 21, 22, 23, 24], pagina: 2, paginas: 2 });
    expect(paginar(lista.slice(0, 20), 1, 20).paginas).toBe(1);
    expect(paginar([], 5, 10)).toEqual({ itens: [], pagina: 1, paginas: 1 });
  });

  const mentorados: Mentorado[] = datasetDeTeste().mentorados;
  const base = [
    resp("a", 10, { mentor: "Diovani", respondido_em: "2026-09-01T12:00:00Z", nome_informado: "Zeca", comentario: "tudo ótimo" }),
    resp("b", 5, { mentor: "Petare", respondido_em: "2026-09-03T12:00:00Z", nome_informado: "Ana", apoio: "marketing digital" }),
    resp("c", 8, { mentor: "Diovani", respondido_em: "2026-09-02T12:00:00Z", mentorado_id: "m2", nome_informado: null }),
  ];
  const ids = (mentor: string, busca: string, ordem: Parameters<typeof respostasDoNps>[4] = null) => respostasDoNps(base, mentorados, mentor, busca, ordem).lista.map((r) => r.id);

  it("sem filtro vale a data, da mais recente para a mais antiga", () => {
    expect(ORDEM_RESPOSTAS).toEqual({ campo: "data", direcao: "desc" });
    expect(ids("", "")).toEqual(["b", "c", "a"]);
  });

  it("o filtro de mentor recorta, e a base do selo é só o que o mentor respondeu, sem a busca", () => {
    expect(ids("Diovani", "")).toEqual(["c", "a"]);
    expect(respostasDoNps(base, mentorados, "Diovani", "marketing", null)).toEqual({ lista: [], doMentor: 2 });
    expect(respostasDoNps(base, mentorados, "", "", null).doMentor).toBe(3);
  });

  it("a busca acha pelo nome informado, pelo mentor, pelo comentário, pelo apoio e pelo nome da ficha, sem acento", () => {
    expect(ids("", "zeca")).toEqual(["a"]);
    expect(ids("", "petare")).toEqual(["b"]);
    expect(ids("", "OTIMO")).toEqual(["a"]);
    expect(ids("", "marketing")).toEqual(["b"]);
    expect(ids("", "bruno")).toEqual(["c"]);
  });

  it("a ordem escolhida vale: nota e nome", () => {
    expect(ids("", "", { campo: "nota", direcao: "asc" })).toEqual(["b", "c", "a"]);
    // Sem nome informado o valor é vazio e vem primeiro; depois Ana e Zeca.
    expect(ids("", "", { campo: "nome", direcao: "asc" })).toEqual(["c", "b", "a"]);
    expect(ids("", "", { campo: "mentor", direcao: "desc" })[0]).toBe("b");
  });
});

describe("Pesquisa de Experiência (GER-02, mapeamento §3.9)", () => {
  const exp = (origem: string, nota: number, extra: Partial<ExpResposta> = {}): ExpResposta => ({ origem_id: origem, respondido_em: "2026-10-01T14:00:00Z", nota, geral: null, clareza: null, itens: {}, textos: {}, ...extra });

  it("o índice por item é a média da grade, o pior primeiro; o índice geral é a média das médias", () => {
    const { experiencia } = datasetDeTeste();
    const r = resumoExperiencia(experiencia);
    expect(r.itens).toEqual([
      { item: "Organização dos agendamentos", indice: 12.5, respostas: 2 },
      { item: "Qualidade das sessões", indice: 87.5, respostas: 2 },
    ]);
    expect(r.indice).toBe(50);
    // 10 promove e 5 detrata: NPS 0, média 7,5.
    expect([r.nps, r.media, r.respostas]).toEqual([0, 7.5, 2]);
  });

  it("a média das médias não é a média de todas as respostas: itens com contagens diferentes pesam igual", () => {
    const l = [exp("a", 9, { itens: { A: "Excelente", B: "Ruim" } }), exp("b", 9, { itens: { A: "Excelente" } }), exp("c", 9, { itens: { A: "Excelente" } })];
    const r = resumoExperiencia(l);
    // A: 100 (3), B: 25 (1). Média das médias 62,5 -> 63; a de todas as respostas seria 81,25.
    expect(r.indice).toBe(63);
    expect(r.itens.map((i) => [i.item, i.respostas])).toEqual([["B", 1], ["A", 3]]);
  });

  it("texto fora da grade não entra no índice nem na contagem do item", () => {
    const r = resumoExperiencia([exp("a", 8, { itens: { A: "Bom", B: "Ótimo!" } }), exp("b", 8, { itens: { A: "Regular" } })]);
    expect(r.itens).toEqual([{ item: "A", indice: 62.5, respostas: 2 }]);
    expect(r.indice).toBe(63);
    expect(resumoExperiencia([exp("a", 8, { itens: { B: "Ótimo!" } })]).indice).toBeNull();
  });

  it("a clareza conta Sim, Parcialmente e Não, e a porcentagem de Sim é arredondada", () => {
    const l = [exp("a", 9, { clareza: "Sim" }), exp("b", 9, { clareza: "Sim" }), exp("c", 9, { clareza: "Parcialmente" }), exp("d", 9, { clareza: "Não" }), exp("e", 9, { clareza: null })];
    expect(resumoExperiencia(l).clareza).toEqual({ sim: 2, parcial: 1, nao: 1, pctSim: 40 });
    expect(resumoExperiencia(l.slice(0, 3)).clareza.pctSim).toBe(67);
    expect(resumoExperiencia(datasetDeTeste().experiencia).clareza).toEqual({ sim: 1, parcial: 0, nao: 1, pctSim: 50 });
  });

  it("sem resposta não há NaN: tudo vazio", () => {
    expect(resumoExperiencia([])).toEqual({ nps: null, media: null, respostas: 0, indice: null, itens: [], clareza: { sim: 0, parcial: 0, nao: 0, pctSim: 0 } });
  });
});
