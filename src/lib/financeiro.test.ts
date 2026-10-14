import { describe, expect, it } from "vitest";

import { datasetDeTeste } from "@/test/fixtures";

import type { Cobranca, Parcela } from "./data/esquemas";
import { hojeSP } from "./datas";
import {
  aceitaParcelaManual,
  cobrancasDescartadas,
  cobrancasOrfas,
  motivoOrfa,
  painelFinanceiro,
  parcelaDaLia,
  podeVincular,
  proximaParcela,
} from "./financeiro";

// Os grupos "Cobrança órfã" e "Parcelas da Lia" do harness antigo (tests/testes.mjs:1286–1490),
// mais as regras da tela Financeiro (index.html:2105–2200).

const ids = <T extends { id: string }>(lista: readonly T[]) => lista.map((x) => x.id);
const contas = (lista: readonly Cobranca[]) => lista.map((c) => c.lia_bill_id);
// Uma data a n dias de hoje, em Brasília.
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const parcela = (id: string, extra: Partial<Parcela>): Parcela => ({ id, mentorado_id: "m1", numero: 1, status: "aberta", vencimento: null, valor: 100, lia_bill_id: null, ...extra });

describe("regras financeiras (FIN-01, FIN-02, FIN-03, FIN-05)", () => {
  it("FIN-03: o motivo de cada órfã — sem e-mail, e-mail em mais de um cadastro, cadastro existe, nenhum cadastro", () => {
    const { mentorados } = datasetDeTeste();
    expect(motivoOrfa({ contact_email: null }, mentorados)).toBe("a cobrança veio sem e-mail");
    expect(motivoOrfa({ contact_email: "" }, mentorados)).toBe("a cobrança veio sem e-mail");
    expect(motivoOrfa({ contact_email: "BRUNO@Exemplo.com" }, mentorados)).toBe("o cadastro existe — clique em vincular");
    expect(motivoOrfa({ contact_email: "ninguem@exemplo.com" }, mentorados)).toBe("nenhum cadastro com esse e-mail");
    const duplicado = [...mentorados, { ...mentorados[0], id: "m9", email: "Bruno@exemplo.com" }];
    expect(motivoOrfa({ contact_email: "bruno@exemplo.com" }, duplicado)).toBe("esse e-mail está em mais de um cadastro");
  });

  it("FIN-02: vincular só com exatamente 1 mentorado com o e-mail, comparado em minúsculas e sem trim", () => {
    const { mentorados } = datasetDeTeste();
    expect(podeVincular({ contact_email: "BRUNO@exemplo.COM" }, mentorados)?.id).toBe("m2");
    expect(podeVincular({ contact_email: null }, mentorados)).toBeNull();
    expect(podeVincular({ contact_email: "ninguem@exemplo.com" }, mentorados)).toBeNull();
    // O espaço não é aparado, como hoje: o alvo não casa.
    expect(podeVincular({ contact_email: " bruno@exemplo.com" }, mentorados)).toBeNull();
    const duplicado = [...mentorados, { ...mentorados[0], id: "m9", email: "BRUNO@exemplo.com" }];
    expect(podeVincular({ contact_email: "bruno@exemplo.com" }, duplicado)).toBeNull();
  });

  it("Cobrança órfã: só a sem dono, não cancelada e não descartada; a descartada fica listada à parte", () => {
    const { cobrancas } = datasetDeTeste();
    // A vinculada (ok1) e a descartada (desc1) não entram na conta.
    expect(contas(cobrancasOrfas(cobrancas))).toEqual(["orf1", "orf2"]);
    expect(contas(cobrancasDescartadas(cobrancas))).toEqual(["desc1"]);
    const cancelada: Cobranca = { ...cobrancas[0], lia_bill_id: "canc1", status: "canceled" };
    expect(contas(cobrancasOrfas([...cobrancas, cancelada]))).toEqual(["orf1", "orf2"]);
    // A descartada que tinha dono também é descartada; ignorada nula não é.
    expect(contas(cobrancasDescartadas([{ ...cobrancas[2], ignorada: true }, { ...cobrancas[0], ignorada: null }]))).toEqual(["ok1"]);
  });

  it("FIN-05: parcela com lia_bill_id é da Lia; 'Adicionar parcela' só some quando alguma do mentorado veio da Lia", () => {
    const { parcelas } = datasetDeTeste();
    expect(parcelas.map(parcelaDaLia)).toEqual([false, true, true]);
    expect(aceitaParcelaManual(parcelas.filter((p) => p.mentorado_id === "m1"))).toBe(true);
    expect(aceitaParcelaManual(parcelas.filter((p) => p.mentorado_id === "m2"))).toBe(false);
    // Uma só da Lia no meio das manuais basta.
    expect(aceitaParcelaManual([parcela("a", {}), parcela("b", { lia_bill_id: "bill_9" })])).toBe(false);
    expect(aceitaParcelaManual([])).toBe(true);
  });

  it("Parcelas da Lia: a próxima é a em aberto de vencimento mais perto; paga e sem data não contam", () => {
    const { parcelas } = datasetDeTeste();
    expect(proximaParcela(parcelas.filter((p) => p.mentorado_id === "m2"))?.id).toBe("p3");
    const lista = [
      parcela("paga", { status: "paga", vencimento: "2026-01-01" }),
      parcela("sem-data", { vencimento: null }),
      parcela("depois", { vencimento: "2026-11-20" }),
      parcela("antes", { vencimento: "2026-11-05" }),
    ];
    expect(proximaParcela(lista)?.id).toBe("antes");
    expect(proximaParcela(lista.slice(0, 2))).toBeNull();
    expect(proximaParcela([])).toBeNull();
  });

  it("FIN-01: cards, órfãs e descartadas ignoram a busca; as tabelas de mentorado obedecem a ela", () => {
    const dados = datasetDeTeste();
    // m3 paga o restante em parte; m4 está pausado, com restante em aberto e uma vencida: não conta.
    dados.mentorados[2].restante_status = "Pago parcial";
    dados.mentorados[3].restante_status = "Ainda não";
    dados.parcelas.push(parcela("p4", { mentorado_id: "m4", vencimento: "2026-02-01" }));
    const hoje = hojeSP();
    const tudo = painelFinanceiro(dados, "", hoje);
    expect(tudo.cards).toEqual({ vencidas: 1, restanteAberto: 1, restanteParcial: 1, assinados: 2, ativos: 3 });
    expect(tudo.linhas.map((l) => [l.mentorado.id, l.pagas, l.parcelas.length, ids(l.vencidas)])).toEqual([
      ["m1", 0, 1, ["p1"]],
      ["m2", 1, 2, []],
      ["m3", 0, 0, []],
    ]);
    expect(tudo.vencidas.map((l) => l.mentorado.id)).toEqual(["m1"]);
    expect(ids(tudo.proximos)).toEqual(["p3"]);
    expect([contas(tudo.orfas), contas(tudo.descartadas), tudo.totalLinhas]).toEqual([["orf1", "orf2"], ["desc1"], 3]);

    // Uma busca que não casa com ninguém esvazia as tabelas e não toca no resto.
    const nada = painelFinanceiro(dados, "zzz", hoje);
    expect(nada.cards).toEqual(tudo.cards);
    expect([contas(nada.orfas), contas(nada.descartadas), nada.totalLinhas]).toEqual([["orf1", "orf2"], ["desc1"], 3]);
    expect([nada.linhas, nada.vencidas, nada.proximos]).toEqual([[], [], []]);

    // A busca casa por partes, sem acento: "bruno" deixa só o m2.
    const bruno = painelFinanceiro(dados, "BRUNO", hoje);
    expect([bruno.linhas.map((l) => l.mentorado.id), bruno.vencidas, ids(bruno.proximos)]).toEqual([["m2"], [], ["p3"]]);
    expect(painelFinanceiro(dados, "ana clara", hoje).vencidas.map((l) => l.mentorado.id)).toEqual(["m1"]);
  });

  it("próximos vencimentos: os 10 mais perto, em aberto, de hoje em diante, de mentorado ativo", () => {
    const dados = datasetDeTeste();
    dados.parcelas = [
      ...Array.from({ length: 12 }, (_, i) => parcela(`f${i}`, { numero: i + 1, vencimento: emDias(20 - i) })),
      parcela("hoje", { vencimento: emDias(0) }),
      parcela("ontem", { vencimento: emDias(-1) }),
      parcela("paga", { status: "paga", vencimento: emDias(1) }),
      parcela("pausado", { mentorado_id: "m4", vencimento: emDias(2) }),
    ];
    expect(ids(painelFinanceiro(dados, "", hojeSP()).proximos)).toEqual(["hoje", "f11", "f10", "f9", "f8", "f7", "f6", "f5", "f4", "f3"]);
  });
});
