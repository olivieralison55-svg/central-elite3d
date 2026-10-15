import { describe, expect, it } from "vitest";

import { datasetDeTeste } from "@/test/fixtures";

import type { Mentorado } from "./data/esquemas";
import { ehAtivo, filtrarMentorados, msgErroMentorado, normalizaEmail, resumoExclusao, situacaoDe } from "./mentorados";

const DADOS = datasetDeTeste();
const cancelado: Mentorado = { ...DADOS.mentorados[2], id: "m5", nome: "Eva Cancelada", situacao: "cancelado", cadastro_incompleto: true, contrato_status: "Ainda não" };
const MENTORADOS = [...DADOS.mentorados, cancelado];
const ids = (filtro: string, busca = "") => filtrarMentorados(MENTORADOS, filtro, busca).lista.map((m) => m.id);

describe("regras de mentorado (OPS-11, OPS-13)", () => {
  it("os filtros: todos (com cancelados), ativos, pausados, incompletos (com cancelados) e contrato pendente (ativo sem 'Assinado')", () => {
    expect(ids("")).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    expect(ids("ativos")).toEqual(["m1", "m2", "m3"]);
    expect(ids("pausados")).toEqual(["m4"]);
    expect(ids("incompletos")).toEqual(["m3", "m5"]);
    expect(ids("contrato")).toEqual(["m2"]);
  });

  it("a busca vem depois do filtro, e o total antes da busca é o que o filtro deixou", () => {
    expect(filtrarMentorados(MENTORADOS, "ativos", "bruno")).toEqual({ lista: [MENTORADOS[1]], antesDaBusca: 3 });
    expect(filtrarMentorados(MENTORADOS, "pausados", "bruno")).toEqual({ lista: [], antesDaBusca: 1 });
    expect(filtrarMentorados(MENTORADOS, "", "bruno")).toEqual({ lista: [MENTORADOS[1]], antesDaBusca: 5 });
    expect(ids("", "diego")).toEqual(["m3"]);
  });

  it("Ficha criada pela Lia: 'incompletos' mostra só quem está com o cadastro incompleto", () => {
    const lista = filtrarMentorados(DADOS.mentorados, "incompletos", "").lista;
    expect(lista.map((m) => m.nome)).toEqual([DADOS.mentorados[2].nome]);
    expect(lista.every((m) => m.cadastro_incompleto)).toBe(true);
  });

  it("OPS-11: resumoExclusao conta sessões, parcelas, marcos de rota e registros de faturamento, no singular e no plural, e as concluídas", () => {
    expect(resumoExclusao(DADOS, "m1")).toEqual({ partes: ["4 sessões", "1 parcela", "1 marco de rota", "2 registros de faturamento"], concluidas: 2 });
    expect(resumoExclusao(DADOS, "m2")).toEqual({ partes: ["4 sessões", "2 parcelas"], concluidas: 1 });
    expect(resumoExclusao(DADOS, "m3")).toEqual({ partes: [], concluidas: 0 });
    const um = {
      ...DADOS,
      sessoes: DADOS.sessoes.filter((s) => s.id === "s5"),
      mentoradoMarcos: [{ ...DADOS.mentoradoMarcos[0], mentorado_id: "m4" }],
      faturamento: [{ ...DADOS.faturamento[0], mentorado_id: "m4" }],
      parcelas: [{ ...DADOS.parcelas[0], mentorado_id: "m4" }, { ...DADOS.parcelas[1], mentorado_id: "m4" }],
    };
    expect(resumoExclusao(um, "m4")).toEqual({ partes: ["1 sessão", "2 parcelas", "1 marco de rota", "1 registro de faturamento"], concluidas: 1 });
  });

  it("OPS-13: o e-mail é gravado sem espaço e em minúsculas, e o campo vazio vira null", () => {
    expect(normalizaEmail("  Ana.Clara@Exemplo.COM  ")).toBe("ana.clara@exemplo.com");
    expect(normalizaEmail("BRUNO@Exemplo.com")).toBe("bruno@exemplo.com");
    expect(normalizaEmail("   ")).toBeNull();
    expect(normalizaEmail("")).toBeNull();
    expect(normalizaEmail(null)).toBeNull();
  });

  it("E-mail do mentorado: o único violado vira explicação; erro de outra natureza passa inteiro", () => {
    expect(msgErroMentorado('duplicate key value violates unique constraint "mentorados_email_unico"')).toBe(
      "Esse e-mail já está em outro mentorado. Dois cadastros com o mesmo e-mail fariam o sync descartar o evento em vez de escolher um.",
    );
    expect(msgErroMentorado("permission denied for table mentorados")).toBe("permission denied for table mentorados");
  });

  it("a situação vem de `situacao`; sem ela, do booleano `cancelado`; sem registro, ativo", () => {
    expect(situacaoDe({ situacao: "pausado", cancelado: false })).toBe("pausado");
    expect(situacaoDe({ situacao: "cancelado", cancelado: false })).toBe("cancelado");
    expect(situacaoDe({ situacao: null, cancelado: true })).toBe("cancelado");
    expect(situacaoDe({ situacao: "", cancelado: true })).toBe("cancelado");
    expect(situacaoDe({ situacao: null, cancelado: null })).toBe("ativo");
    expect(situacaoDe(undefined)).toBe("ativo");
    expect([ehAtivo({ situacao: "ativo", cancelado: false }), ehAtivo({ situacao: "pausado", cancelado: false }), ehAtivo({ situacao: null, cancelado: true })]).toEqual([
      true,
      false,
      false,
    ]);
  });
});
