import { describe, expect, it } from "vitest";

import { datasetDeTeste } from "@/test/fixtures";

import type { NpsResposta } from "./data/esquemas";
import {
  abaIaEfetiva,
  abasIa,
  type Alerta,
  alertasPorSeveridade,
  chaveMentorado,
  chaveSelecaoMentor,
  chaveSelecaoMentorado,
  contagemRisco,
  contrasDe,
  type LeituraMentor,
  type LeituraMentorado,
  leiturasPorMentor,
  leiturasPorMentorado,
  listaDe,
  npsDoMentor,
  npsDoMentorado,
  numerosDoMentor,
  pautaDe,
  prosDe,
  riscoDe,
  severidadeDe,
  sinaisDe,
} from "./ia";

// GER-05 e GER-06: as regras da Análise IA. O fixture traz a análise com um mentor no formato
// antigo e um mentorado com `sinais`; o resto é montado à mão.
const mentorado = (nome: string, risco: string, extra: Partial<LeituraMentorado> = {}): LeituraMentorado => ({
  mentorado_id: null,
  mentorado: nome,
  mentor: "Diovani",
  risco,
  leitura: "x",
  acao_sugerida: "y",
  ...extra,
});
const mentor = (nome: string, extra: Partial<LeituraMentor> = {}): LeituraMentor => ({ mentor: nome, leitura: "x", ...extra });
const alerta = (severidade: string, titulo: string): Alerta => ({ severidade, tipo: "mentorado", mentor: null, mentorado: null, titulo, detalhe: "", evidencia: "", acao_sugerida: "" });
const resp = (id: string, extra: Partial<NpsResposta>): NpsResposta => ({
  id,
  mentor: "Diovani",
  nota: 8,
  respondido_em: "2026-09-16T13:00:00Z",
  mentorado_id: null,
  nome_informado: null,
  comentario: null,
  clareza: null,
  direcionamento: null,
  apoio: null,
  ...extra,
});

describe("a ordem por risco e por severidade (GER-05)", () => {
  it("os mentorados vêm do risco mais alto ao mais baixo, e o nome desempata em ordem do português", () => {
    const l = [mentorado("Zélia", "alto"), mentorado("Ana", "baixo"), mentorado("Álvaro", "alto"), mentorado("Bia", "medio"), mentorado("Caio", "alto")];
    expect(leiturasPorMentorado({ mentorados: l }).map((x) => x.mentorado)).toEqual(["Álvaro", "Caio", "Zélia", "Bia", "Ana"]);
  });

  it("um risco que o app não conhece vai depois dos três, e a lista de entrada não é alterada", () => {
    const l = [mentorado("A", "crítico"), mentorado("B", "baixo"), mentorado("C", "alto")];
    expect(leiturasPorMentorado({ mentorados: l }).map((x) => x.mentorado)).toEqual(["C", "B", "A"]);
    expect(l.map((x) => x.mentorado)).toEqual(["A", "B", "C"]);
  });

  it("os mentores vêm em ordem alfabética do português", () => {
    expect(leiturasPorMentor({ mentores: [mentor("Zé"), mentor("Álvaro"), mentor("Bia")] }).map((x) => x.mentor)).toEqual(["Álvaro", "Bia", "Zé"]);
    expect(leiturasPorMentor({})).toEqual([]);
  });

  it("os alertas vêm do mais grave ao menos; a ordem do modelo desempata, e severidade desconhecida fica no fim", () => {
    const l = [alerta("baixa", "b1"), alerta("estranha", "e1"), alerta("alta", "a1"), alerta("media", "m1"), alerta("alta", "a2"), alerta("baixa", "b2")];
    expect(alertasPorSeveridade(l).map((a) => a.titulo)).toEqual(["a1", "a2", "m1", "b1", "b2", "e1"]);
    expect(alertasPorSeveridade([])).toEqual([]);
  });

  it("rótulo e cor do risco e da severidade; o desconhecido mostra o texto cru em âmbar", () => {
    expect(["alto", "medio", "baixo", "crítico"].map(riscoDe)).toEqual([
      { tom: "danger", rotulo: "Alto" },
      { tom: "warning", rotulo: "Médio" },
      { tom: "success", rotulo: "Baixo" },
      { tom: "warning", rotulo: "crítico" },
    ]);
    expect(["alta", "media", "baixa", "urgente"].map(severidadeDe)).toEqual([
      { tom: "danger", rotulo: "Alta" },
      { tom: "warning", rotulo: "Média" },
      { tom: "success", rotulo: "Baixa" },
      { tom: "warning", rotulo: "urgente" },
    ]);
  });

  it("a contagem por risco ignora o que não é alto, médio ou baixo", () => {
    const l = [mentorado("A", "alto"), mentorado("B", "alto"), mentorado("C", "medio"), mentorado("D", "baixo"), mentorado("E", "outro")];
    expect(contagemRisco(l)).toEqual({ alto: 2, medio: 1, baixo: 1 });
    expect(contagemRisco([])).toEqual({ alto: 0, medio: 0, baixo: 0 });
  });
});

describe("o formato antigo da análise (GER-06)", () => {
  it("`pontos_fortes` e `pontos_de_atencao` caem nos mesmos blocos de prós e contras", () => {
    const antigo = datasetDeTeste().analise?.mentores?.[0];
    if (!antigo) throw new Error("o fixture não traz o mentor no formato antigo");
    expect(prosDe(antigo)).toEqual(["Prático"]);
    expect(contrasDe(antigo)).toEqual(["Atrasa \"><img src=x onerror=alert(1)>"]);
  });

  it("o formato novo vence quando existe, mesmo vazio; sem nenhum dos dois, a lista é vazia", () => {
    expect(prosDe(mentor("A", { pros: ["novo"], pontos_fortes: ["velho"] }))).toEqual(["novo"]);
    expect(contrasDe(mentor("A", { contras: ["novo"], pontos_de_atencao: ["velho"] }))).toEqual(["novo"]);
    expect(prosDe(mentor("A", { pros: [], pontos_fortes: ["velho"] }))).toEqual([]);
    expect(contrasDe(mentor("A", { contras: [], pontos_de_atencao: ["velho"] }))).toEqual([]);
    expect(prosDe(mentor("A"))).toEqual([]);
    expect(contrasDe(mentor("A"))).toEqual([]);
  });

  it("os `sinais` do formato antigo são lidos à parte, e nunca viram contra; a pauta idem", () => {
    const antigo = datasetDeTeste().analise?.mentorados[0];
    if (!antigo) throw new Error("o fixture não traz o mentorado no formato antigo");
    expect(sinaisDe(antigo)).toEqual(["Nota 5"]);
    expect(contrasDe(antigo)).toEqual([]);
    expect(pautaDe(antigo)).toEqual([]);
    expect(pautaDe({ pauta: ["a", "b"] })).toEqual(["a", "b"]);
    expect(sinaisDe({})).toEqual([]);
  });

  it("valor que não é lista vira lista vazia", () => {
    expect(listaDe(undefined)).toEqual([]);
    expect(listaDe(null)).toEqual([]);
    expect(listaDe("texto" as unknown as string[])).toEqual([]);
    expect(listaDe(["a"])).toEqual(["a"]);
  });
});

describe("as respostas e os números vêm do NPS carregado, não do modelo (GER-05)", () => {
  const nps = [
    resp("a", { mentor: "Diovani", nota: 10, respondido_em: "2026-09-01T10:00:00Z", mentorado_id: "m1" }),
    resp("b", { mentor: "Diovani", nota: 5, respondido_em: "2026-09-20T10:00:00Z", mentorado_id: "m1" }),
    resp("c", { mentor: "Petare", nota: 9, respondido_em: "2026-09-10T10:00:00Z", mentorado_id: null, nome_informado: "Fulano" }),
    resp("d", { mentor: "Diovani", nota: 7, respondido_em: "2026-09-11T10:00:00Z", mentorado_id: "m2", nome_informado: "Fulano" }),
    resp("e", { mentor: "Petare", nota: 3, respondido_em: "2026-09-12T10:00:00Z", mentorado_id: null, nome_informado: "Fulano" }),
  ];

  it("com ficha vale o id; as respostas vêm da mais recente para a mais antiga", () => {
    expect(npsDoMentorado(nps, { mentorado_id: "m1", mentorado: "Qualquer nome" }).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("sem ficha vale o nome informado, e só entre as respostas sem ficha: o homônimo com ficha não entra", () => {
    expect(npsDoMentorado(nps, { mentorado_id: null, mentorado: "Fulano" }).map((r) => r.id)).toEqual(["e", "c"]);
    expect(npsDoMentorado(nps, { mentorado_id: null, mentorado: "Sem resposta" })).toEqual([]);
  });

  it("as respostas de um mentor, da mais recente para a mais antiga", () => {
    expect(npsDoMentor(nps, "Diovani").map((r) => r.id)).toEqual(["b", "d", "a"]);
    expect(npsDoMentor(nps, "Ninguém")).toEqual([]);
  });

  it("os números do mentor: média, NPS e contagem; sem resposta, nada", () => {
    // Diovani: 10, 5 e 7: média 7,33; um promotor e um detrator em três: NPS 0.
    const d = numerosDoMentor(nps, "Diovani");
    expect(d.respostas).toBe(3);
    expect(d.media).toBeCloseTo(22 / 3);
    expect(d.nps).toBe(0);
    expect(numerosDoMentor(nps, "Petare")).toEqual({ media: 6, nps: 0, respostas: 2 });
    expect(numerosDoMentor(nps, "Ninguém")).toEqual({ media: null, nps: null, respostas: 0 });
  });

  it("as chaves de seleção: o id da ficha ou, sem ele, `nome:`, com o prefixo da lista", () => {
    expect(chaveMentorado({ mentorado_id: "m1", mentorado: "Ana" })).toBe("m1");
    expect(chaveMentorado({ mentorado_id: null, mentorado: "Fulano" })).toBe("nome:Fulano");
    expect(chaveMentorado({ mentorado_id: "", mentorado: "Fulano" })).toBe("nome:Fulano");
    expect(chaveSelecaoMentorado({ mentorado_id: "m1", mentorado: "Ana" })).toBe("mentorado:m1");
    expect(chaveSelecaoMentorado({ mentorado_id: null, mentorado: "Fulano" })).toBe("mentorado:nome:Fulano");
    expect(chaveSelecaoMentor("Diovani")).toBe("mentor:Diovani");
  });
});

describe("as abas do recorte do mentor (GER-05, AD-005)", () => {
  it("o mentor não tem a aba Por mentor, e quem chega com ela escolhida cai na visão geral", () => {
    expect(abasIa(true).map((a) => a.value)).toEqual(["geral", "mentores", "mentorados"]);
    expect(abasIa(false).map((a) => a.value)).toEqual(["geral", "mentorados"]);
    expect(abaIaEfetiva("mentores", true)).toBe("mentores");
    expect(abaIaEfetiva("mentores", false)).toBe("geral");
    expect(abaIaEfetiva("mentorados", false)).toBe("mentorados");
    expect(abaIaEfetiva("mentorados", true)).toBe("mentorados");
    expect(abaIaEfetiva("lixo", true)).toBe("geral");
  });
});
