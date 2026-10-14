import { describe, expect, it } from "vitest";

import { datasetDeTeste } from "@/test/fixtures";

import type { Dataset, Mentorado, Parcela, Sessao } from "./data/esquemas";
import { nivelDe, painel } from "./painel";

const HOJE = "2026-10-14";
// O dia "AAAA-MM-DD" a n dias de `de`.
const dia = (n: number, de = HOJE) => new Date(Date.parse(de) + n * 86_400_000).toISOString().slice(0, 10);

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
const mentorado = (campos: Partial<Mentorado> & { id: string }): Mentorado => ({
  nome: campos.id,
  email: null,
  data_fechamento: "2026-01-01",
  situacao: "ativo",
  cancelado: false,
  pausado_em: null,
  retorno_previsto: null,
  link_drive: null,
  link_mapa_mental: null,
  link_whatsapp: null,
  contrato_status: "Assinado",
  cadastro_incompleto: false,
  ...campos,
});
const parcela = (campos: Partial<Parcela> & { id: string }): Parcela => ({
  mentorado_id: "m1",
  numero: 1,
  status: "aberta",
  vencimento: null,
  valor: 100,
  lia_bill_id: null,
  ...campos,
});
const com = (mudancas: Partial<Dataset>): Dataset => ({ ...datasetDeTeste(), ...mudancas });
const contagem = (dados: Dataset, chave: string, papel: "admin" | "diretoria" | "mentor" = "admin", hoje = HOJE) =>
  painel(dados, papel, hoje, "").atencao.find((i) => i.chave === chave)?.contagem;
const nomes = (lista: { mentorado: Mentorado }[]) => lista.map((x) => x.mentorado.nome);

describe("painel do Dashboard (OPS-01, OPS-05, GER-08)", () => {
  it("OPS-01: admin e diretoria veem os itens do painel na ordem de hoje, com contagem e link; o mentor, só os que não são de dinheiro", () => {
    const itens = (papel: "admin" | "diretoria" | "mentor") => painel(datasetDeTeste(), papel, HOJE, "").atencao.map((i) => [i.chave, i.rotulo, i.contagem, i.link]);
    const deAdmin = [
      ["contratos", "Contratos pendentes de assinatura", 1, null],
      ["vencidas", "Parcelas vencidas em aberto", 1, { caminho: "/financeiro" }],
      ["incompletos", "Mentorados criados pela Lia, sem cadastro completo", 1, { caminho: "/mentorados", statusFin: "incompletos" }],
      ["semSessao", "Mentorados sem sessão há +30 dias", 2, { ancora: "risco" }],
      ["semSubida", "Mentorados sem subir de marco há +30 dias", 2, { ancora: "sem-subida" }],
      ["semImplementacao", "Mentorados que ainda não fizeram a sessão de implementação", 3, { ancora: "sem-implementacao" }],
      ["aguardando", "Sessões aguardando confirmação", 1, { caminho: "/sessoes" }],
      ["cobrancas", "Cobranças da Lia sem mentorado identificado", 2, { caminho: "/financeiro" }],
      ["npsSessao", "Pesquisa de satisfação da sessão não respondida", 0, { ancora: "nps-pend" }],
      ["npsExperiencia", "Pesquisa de Experiência não respondida (anônima: 0 resposta(s) de 0 mentorado(s) com sessão)", 0, null],
    ];
    expect(itens("admin")).toEqual(deAdmin);
    expect(itens("diretoria")).toEqual(deAdmin);
    expect(itens("mentor").map(([chave]) => chave)).toEqual(["incompletos", "semSessao", "semSubida", "semImplementacao", "aguardando"]);
  });

  it("OPS-01: aguardando, sem evento no Google Agenda e cobranças da Lia só aparecem com contagem; aguardando e sem evento contam linhas", () => {
    const chaves = (dados: Dataset, papel: "admin" | "mentor") => painel(dados, papel, HOJE, "").atencao.map((i) => i.chave);
    const semAguardar = com({ sessoes: datasetDeTeste().sessoes.filter((s) => s.status !== "Aguardando confirmação"), cobrancas: [] });
    expect(chaves(semAguardar, "admin")).not.toContain("aguardando");
    expect(chaves(semAguardar, "admin")).not.toContain("cobrancas");
    // Um encontro em grupo aguardando com 2 presenças conta 2.
    const grupo = [
      sessao({ id: "a1", etapa: "Plantão de Dúvida Semanal", ordem: 90, status: "Aguardando confirmação", data: "2026-10-01", hora: "19:00:00" }),
      sessao({ id: "a2", mentorado_id: "m2", etapa: "Plantão de Dúvida Semanal", ordem: 90, status: "Aguardando confirmação", data: "2026-10-01", hora: "19:00:00" }),
    ];
    expect(contagem(com({ sessoes: [...datasetDeTeste().sessoes, ...grupo] }), "aguardando", "mentor")).toBe(3);
    const orfa = { id: "o1", mentorado_id: "m1", mentorado_nome: "Ana Clara", etapa: "Checkup 2", mentor: null, data: "2026-09-01", hora: null, status: "Agendada" };
    for (const papel of ["admin", "mentor"] as const) {
      const item = painel(com({ orfas: [orfa] }), papel, HOJE, "").atencao.find((i) => i.chave === "orfas");
      expect(item, papel).toEqual({ chave: "orfas", rotulo: "Sessões sem evento no Google Agenda", contagem: 1, link: { ancora: "orfas" } });
    }
  });

  it("OPS-01: parcela vencida é a não paga com vencimento antes de hoje, de mentorado ativo", () => {
    const parcelas = [
      parcela({ id: "v1", vencimento: dia(-1) }),
      parcela({ id: "v2", vencimento: dia(-10), status: "paga" }),
      parcela({ id: "v3", vencimento: HOJE }),
      parcela({ id: "v4", vencimento: null }),
      parcela({ id: "v5", mentorado_id: "m4", vencimento: dia(-5) }),
      parcela({ id: "v6", mentorado_id: "m2", vencimento: dia(-90), status: "atrasada" }),
    ];
    expect(contagem(com({ parcelas }), "vencidas")).toBe(2);
  });

  it("OPS-01: contrato pendente é de ativo sem 'Assinado'; criado pela Lia é o incompleto que não está cancelado", () => {
    const mentorados = [
      mentorado({ id: "a", contrato_status: "Aguardando assinatura" }),
      mentorado({ id: "b", contrato_status: null }),
      mentorado({ id: "c", contrato_status: "Ainda não", situacao: "pausado" }),
      mentorado({ id: "d", cadastro_incompleto: true }),
      mentorado({ id: "e", cadastro_incompleto: true, situacao: "pausado" }),
      mentorado({ id: "f", cadastro_incompleto: true, situacao: "cancelado" }),
      mentorado({ id: "g", cadastro_incompleto: true, situacao: null, cancelado: true }),
    ];
    const dados = com({ mentorados });
    expect(contagem(dados, "contratos")).toBe(2);
    expect(contagem(dados, "incompletos")).toBe(2);
  });

  it("OPS-05: sem sessão há +30 dias conta só 1:1: sai quem tem 1:1 agendada, mesmo vencida; a régua é a última 1:1 concluída, senão o fechamento", () => {
    const mentorados = ["a", "b", "c", "d", "e", "f"].map((id) => mentorado({ id, data_fechamento: dia(-200) }));
    mentorados[5] = mentorado({ id: "f", data_fechamento: null });
    const sessoes = [
      sessao({ id: "s-a", mentorado_id: "a", data: dia(-30) }),
      sessao({ id: "s-b", mentorado_id: "b", data: dia(-31) }),
      sessao({ id: "s-c1", mentorado_id: "c", data: dia(-60) }),
      sessao({ id: "s-c2", mentorado_id: "c", status: "Agendada", data: dia(-45) }),
      // Encontro em grupo recente não tira ninguém da lista: só 1:1 conta.
      sessao({ id: "s-d", mentorado_id: "d", etapa: "Plantão de Dúvida Semanal", ordem: 90, data: dia(-2), hora: "19:00:00" }),
      sessao({ id: "s-e", mentorado_id: "e", status: "Agendada", data: null }),
    ];
    const resultado = painel(com({ mentorados, sessoes }), "admin", HOJE, "");
    expect(resultado.listas.risco.itens.map((r) => [r.mentorado.id, r.ultima])).toEqual([
      ["b", dia(-31)],
      ["d", null],
    ]);
    expect(resultado.listas.risco.total).toBe(2);
    expect(contagem(com({ mentorados, sessoes }), "semSessao")).toBe(2);
  });

  it("OPS-01: sem subir de marco há +30 dias: contrato assinado; régua na última subida (CONCLUIDO ou passou, pela data ou pelo updated_at), senão o fechamento", () => {
    const rotas = [{ id: "r1", slug: "mkt", nome: "Marketplace", modelo: null, ordem: 1, unidade: "mes" }];
    const marcos = [{ ...datasetDeTeste().marcos[1], id: "k1", rota_id: "r1", nome: "Marco 01" }];
    const marco = (mentorado_id: string, status: string, data: string | null, updated_at: string | null) => ({
      mentorado_id,
      marco_id: "k1",
      status,
      data,
      updated_at,
      criterios_ok: [],
      bloqueios: null,
      proxima_acao: null,
    });
    const mentorados = [...datasetDeTeste().mentorados, mentorado({ id: "m5", nome: "Eva" }), mentorado({ id: "m6", nome: "Fábio" })];
    const mentoradoMarcos = [
      marco("m1", "CONCLUIDO", dia(-40), `${dia(-1)}T10:00:00Z`),
      marco("m2", "NAO_INICIADO", null, `${dia(-1)}T10:00:00Z`),
      marco("m5", "passou", null, `${dia(-35)}T10:00:00Z`),
      marco("m6", "CONCLUIDO", dia(-30), null),
    ];
    const resultado = painel(com({ mentorados, rotas, marcos, mentoradoMarcos }), "admin", HOJE, "");
    expect(
      resultado.listas.semSubida.itens.map((x) => [x.mentorado.id, x.ref, x.dias, x.subiu, x.marco?.nome ?? null, x.rota?.nome ?? null]),
    ).toEqual([
      ["m3", "2025-10-01", 378, false, null, null],
      ["m1", dia(-40), 40, true, "Marco 01", "Marketplace"],
      ["m5", dia(-35), 35, true, "Marco 01", "Marketplace"],
    ]);
    expect(resultado.atencao.find((i) => i.chave === "semSubida")?.contagem).toBe(3);
  });

  it("OPS-01: sem sessão de implementação: ativo sem presença concluída nela; os plantões concluídos desde o fechamento contam à parte", () => {
    const sessoes = [
      ...datasetDeTeste().sessoes,
      sessao({ id: "i1", mentorado_id: "m3", etapa: "Sessão de Implementação Mensal", ordem: 91, mentor: "Michelle", data: "2026-09-10", hora: "20:00:00" }),
      sessao({ id: "p-antes", etapa: "Plantão de Dúvida Semanal", ordem: 90, data: "2025-12-01", hora: "19:00:00" }),
      sessao({ id: "p-sem-data", mentorado_id: "m2", etapa: "Plantão de Dúvida Semanal", ordem: 90 }),
    ];
    const lista = painel(com({ sessoes }), "admin", HOJE, "").listas.semImplementacao;
    expect([lista.total, lista.itens.map((x) => [x.mentorado.id, x.plantoes])]).toEqual([
      2,
      [
        ["m1", 1],
        ["m2", 2],
      ],
    ]);
  });

  it("OPS-01: pesquisa pendente: última 1:1 concluída desde o início da cobrança e há 2+ dias, sem resposta do dia dela em diante; a Experiência é um totalizador anônimo", () => {
    const hoje = "2026-10-30";
    const sessoes = [
      ...datasetDeTeste().sessoes,
      sessao({ id: "n0", data: "2026-10-14", hora: "10:00:00" }),
      sessao({ id: "n1", etapa: "Checkup 2", ordem: 4, data: "2026-10-28", hora: "10:00:00" }),
      sessao({ id: "n2", mentorado_id: "m2", data: "2026-10-27", hora: "10:00:00" }),
      sessao({ id: "n3", mentorado_id: "m2", etapa: "Checkup 2", ordem: 4, data: "2026-10-29", hora: "10:00:00" }),
      // Pausado: fora.
      sessao({ id: "n4", mentorado_id: "m4", data: "2026-10-20", hora: "10:00:00" }),
    ];
    const resposta = (id: string, mentorado_id: string, respondido_em: string) => ({ ...datasetDeTeste().nps[0], id, mentorado_id, respondido_em });
    const nps = [resposta("r1", "m2", "2026-10-28T20:00:00Z"), resposta("r2", "m1", "2026-10-15T12:00:00Z")];
    const experiencia = [
      { ...datasetDeTeste().experiencia[0], respondido_em: "2026-10-29T12:00:00Z" },
      { ...datasetDeTeste().experiencia[1], respondido_em: "2026-10-01T12:00:00Z" },
    ];
    const resultado = painel(com({ sessoes, nps, experiencia }), "admin", hoje, "");
    expect(resultado.listas.npsPend.itens.map((x) => [x.mentorado.id, x.sessao.id])).toEqual([["m1", "n1"]]);
    expect(resultado.atencao.filter((i) => i.chave.startsWith("nps")).map((i) => [i.rotulo, i.contagem])).toEqual([
      ["Pesquisa de satisfação da sessão não respondida", 1],
      ["Pesquisa de Experiência não respondida (anônima: 1 resposta(s) de 2 mentorado(s) com sessão)", 1],
    ]);
  });

  it("OPS-01 e OPS-10: os contadores, os números e os totais das listas ignoram a busca; só as listas recortam", () => {
    const sem = painel(datasetDeTeste(), "admin", HOJE, "");
    const busca = painel(datasetDeTeste(), "admin", HOJE, "bruno");
    expect(busca.atencao).toEqual(sem.atencao);
    expect(busca.numeros).toEqual(sem.numeros);
    expect([busca.ativos, sem.ativos, busca.ativosNaBusca, sem.ativosNaBusca]).toEqual([3, 3, 1, 3]);
    expect(nomes(sem.listas.risco.itens)).toEqual(["Bruno Dias", expect.stringContaining("Diego")]);
    expect(nomes(busca.listas.risco.itens)).toEqual(["Bruno Dias"]);
    expect(busca.listas.risco.total).toBe(2);
    expect(nomes(busca.listas.semImplementacao.itens)).toEqual(["Bruno Dias"]);
    expect(busca.listas.semImplementacao.total).toBe(3);
  });

  it("GER-08: o aviso de adesão é só do mentor, com denominador > 0 e taxa abaixo de 70%", () => {
    const adesao = (papel: "admin" | "diretoria" | "mentor", respostas: number | string, mentorados_com_sessao: number | string) =>
      painel(com({ adesao: { respostas, mentorados_com_sessao } }), papel, HOJE, "").adesao;
    expect(adesao("mentor", 2, 10)).toEqual({ respostas: 2, total: 10, pct: 20 });
    // numeric chega como texto do PostgREST.
    expect(adesao("mentor", "6", "10")).toEqual({ respostas: 6, total: 10, pct: 60 });
    expect(adesao("mentor", 7, 10)).toBeNull();
    expect(adesao("mentor", 0, 0)).toBeNull();
    expect(adesao("admin", 2, 10)).toBeNull();
    expect(adesao("diretoria", 2, 10)).toBeNull();
    expect(painel(com({ adesao: null }), "mentor", HOJE, "").adesao).toBeNull();
  });

  it("os números gerais: situação dos mentorados, 1:1 por linha e encontros em grupo agrupados, com as presenças", () => {
    const mentorados = [...datasetDeTeste().mentorados, mentorado({ id: "m5", situacao: "cancelado" })];
    expect(painel(com({ mentorados }), "admin", HOJE, "").numeros).toEqual({
      ativos: 3,
      pausados: 1,
      cancelados: 1,
      concluidas1a1: 2,
      agendadas1a1: 1,
      encontros: 1,
      presencas: 2,
      encontrosAgendados: 1,
    });
  });

  it("a progressão por faturamento: só ativo com faturamento, do maior para o menor, com o nível e o quanto falta; a busca recorta", () => {
    const faturamento = [
      ...datasetDeTeste().faturamento,
      { id: "f3", mentorado_id: "m2", mes: "2026-08-01", canal_id: "c1", valor: "60000.50" },
      { id: "f4", mentorado_id: "m4", mes: "2026-08-01", canal_id: "c1", valor: 900 },
    ];
    const progressao = painel(com({ faturamento }), "admin", HOJE, "").progressao;
    expect(progressao.map((x) => [x.mentorado.id, x.nivel.atual.nome, x.nivel.proximo?.nome ?? null, x.nivel.pct, x.nivel.total])).toEqual([
      ["m2", "Platina", "Diamante", 20, 60000.5],
      ["m1", "Prata", "Ouro", 50, 15000],
    ]);
    expect(painel(com({ faturamento }), "admin", HOJE, "ana").progressao.map((x) => x.mentorado.id)).toEqual(["m1"]);
    expect(nivelDe(150000)).toEqual({ atual: { nome: "Diamante", min: 100000 }, proximo: null, pct: 100, total: 150000 });
  });

  it("as próximas 8: 1:1 e encontros agendados de hoje em diante, por data e hora, sem data passada; o encontro vem agregado", () => {
    const proximas = painel(datasetDeTeste(), "admin", HOJE, "").proximas;
    expect(proximas.map((p) => [p.data, p.hora, p.quem, p.mentoradoId, p.encontro?.itens.length ?? null])).toEqual([
      ["2099-09-01", "14:00:00", "Ana Clara", "m1", null],
      ["2099-10-15", "20:00:00", "2 participante(s)", null, 2],
    ]);
    // A busca casa o encontro pelo participante; a 1:1 da Ana sai.
    expect(painel(datasetDeTeste(), "admin", HOJE, "bruno").proximas.map((p) => p.quem)).toEqual(["2 participante(s)"]);
    const muitas = [
      sessao({ id: "ontem", status: "Agendada", data: dia(-1), hora: "10:00:00" }),
      sessao({ id: "sem-hora", status: "Agendada", data: dia(1) }),
      ...Array.from({ length: 9 }, (_, i) => sessao({ id: `h${i}`, status: "Agendada", data: dia(1), hora: `1${i}:00:00` })),
    ];
    const ids = painel(com({ sessoes: muitas }), "admin", HOJE, "").proximas.map((p) => p.chave);
    expect(ids).toEqual(["h0", "h1", "h2", "h3", "h4", "h5", "h6", "h7"]);
    expect(painel(com({ sessoes: muitas.slice(0, 3) }), "admin", HOJE, "").proximas.map((p) => p.chave)).toEqual(["h0", "sem-hora"]);
  });
});
