import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { ESQUEMAS } from "./esquemas";

type NomeRelacao = keyof typeof ESQUEMAS;

const esquemaDe = (rel: NomeRelacao): z.ZodType<unknown> => ESQUEMAS[rel];

const ALERTA = {
  severidade: "alta",
  tipo: "mentorado",
  mentor: "Luan",
  mentorado: null,
  titulo: "Nota caiu",
  detalhe: "Detalhe",
  evidencia: '"citação"',
  acao_sugerida: "Ligar hoje",
};
const LEITURA_MENTORADO = {
  mentorado_id: "m1",
  mentorado: "Ana Clara",
  mentor: "Diovani",
  risco: "alto",
  leitura: "Frustrada",
  pros: ["Vendeu na feira"],
  contras: ["Travou no CMV"],
  pauta: ["O que travou?"],
  acao_sugerida: "CS hoje",
};
const BASICO = {
  id: "m1",
  nome: "Ana Clara",
  email: "ana.clara@exemplo.com",
  data_fechamento: "2026-01-10",
  situacao: "ativo",
  cancelado: false,
  pausado_em: null,
  retorno_previsto: null,
  link_drive: "https://exemplo.com/drive",
  link_mapa_mental: null,
  link_whatsapp: null,
};

// Uma linha de cada leitura como o PostgREST entrega: as colunas que o index.html lê, e só elas.
const LINHAS = {
  profiles: { id: "u1", role: "mentor", nome: "Ana", email: "ana@exemplo.com" },
  mentorados: {
    ...BASICO,
    cadastro_incompleto: false,
    contrato_status: "Assinado",
    entrada_status: "Pago",
    entrada_forma_pgto: "pix",
    restante_status: "Ainda não",
    restante_forma_pgto: null,
  },
  mentorados_basic: BASICO,
  parcelas: { id: "p1", mentorado_id: "m1", numero: 1, status: "aberta", vencimento: "2026-01-01", valor: 500, lia_bill_id: null },
  lia_cobrancas: {
    lia_bill_id: "orf1",
    mentorado_id: null,
    status: "paid",
    amount_cents: 150000,
    due_date: "2026-09-20",
    contact_email: "bruno@exemplo.com",
    ignorada: false,
  },
  sessoes: {
    id: "s1",
    mentorado_id: "m1",
    etapa: "Diagnóstico de Negócio",
    ordem: 1,
    status: "Concluída",
    mentor: "Evaldo",
    data: "2026-02-01",
    hora: "10:00:00",
    link_meet: "https://meet.exemplo.com/s1",
    link_gravacao: null,
    link_anotacoes: null,
    google_event_id: "ev1",
    etapa_deduzida: false,
  },
  rotas: { id: "r1", slug: "feiras", nome: "Feiras e Lives", modelo: "rico", ordem: 2, unidade: "acumulado" },
  marcos_definicao: {
    id: "mk1",
    rota_id: "r1",
    nome: "Marco 01 — R$ 500 acumulados",
    objetivo: "A feira paga o dia",
    ordem: 1,
    subtitulo: "Escolher a feira certa",
    restricao: "Cada feira começa do zero",
    alavanca: "Repetição",
    pergunta_chave: "O que falta?",
    apoios: ["Mix mínimo viável"],
    indicadores: ["Ticket médio"],
    criterios: [
      { grupo: "Portão A · Apto a vender", itens: ["Tenho produto validado"] },
      { grupo: null, itens: ["Conheço meu CMV"] },
    ],
    meta_valor: 500,
    placa: false,
  },
  mentorado_marcos: {
    mentorado_id: "m1",
    marco_id: "mk1",
    status: "EM_ANDAMENTO",
    data: "2026-05-01",
    updated_at: "2026-05-01T12:00:00Z",
    criterios_ok: ["Tenho produto validado"],
    bloqueios: ["Sem ponto de energia"],
    proxima_acao: "Fechar a inscrição",
  },
  faturamento_mensal: { id: "f1", mentorado_id: "m1", mes: "2026-07-01", canal_id: "c1", valor: 10000 },
  canais: { id: "c1", rota_id: "r1", nome: "Presencial", ordem: 1 },
  mentorado_canais: { mentorado_id: "m1", rota_id: "r1", canal_id: "c1" },
  sessoes_orfas: {
    id: "s9",
    mentorado_id: "m2",
    mentorado_nome: "Bruno Dias",
    etapa: "Checkup 1",
    mentor: null,
    data: "2026-09-01",
    hora: "15:00:00",
    status: "Agendada",
  },
  stlseller_mentorados: {
    email: "ana.clara@exemplo.com",
    email_stlflix: "ana@stlflix.com",
    nome: null,
    status_formulario: "ATIVO",
    status_real: "pago",
    plano_ativo: true,
    vendas_marketplace: 214,
    loja_id: "s1",
    loja_nome: "Loja da Ana",
    loja_email: "loja@ana.com",
    lia_status_pagamento: "finished",
    lia_motivo_cancelamento: null,
    lia_pedidos: 1,
    lia_pedidos_finalizados: 1,
    lia_ultimo_pedido_em: "2026-08-06T21:52:45.995+00:00",
    produtos_vendidos: 2,
    faturamento_total: 1234.5,
    synced_at: "2026-09-22T12:00:00Z",
  },
  stlseller_pedidos_marketplace: {
    email: "ana.clara@exemplo.com",
    marketplace: "mercadolivre",
    pedidos: 12,
    pedidos_vendidos: 10,
    pedidos_cancelados: 2,
    total_bruto: 1500,
    total_liquido: null,
    ultimo_pedido_em: "2026-09-01T10:00:00Z",
  },
  stlseller_produtos_vendidos: {
    email: "ana.clara@exemplo.com",
    marketplace: "shopee",
    anuncio_id: "SP1",
    titulo: "Chaveiro",
    cadastrado_no_stlseller: false,
    link: "https://exemplo.com/p/1",
    pedidos: 7,
    unidades: 9,
    faturamento: 1000,
    ultima_venda_em: "2026-08-20T10:00:00Z",
  },
  nps_respostas: {
    id: "n1",
    mentor: "Diovani",
    nota: 10,
    respondido_em: "2026-09-14T01:00:00Z",
    mentorado_id: "m1",
    nome_informado: "Ana Clara Silva",
    comentario: "Ótima",
    clareza: "Sim, totalmente",
    direcionamento: "Sim",
    apoio: null,
  },
  experiencia_respostas: {
    origem_id: "sheet:a",
    respondido_em: "2026-10-01T14:00:00Z",
    nota: 10,
    geral: "Muito Satisfeito",
    clareza: "Sim",
    itens: { "Qualidade das sessões": "Excelente" },
    textos: { "O que mais gera valor?": "Sessões" },
  },
  nps_analises: {
    gerado_em: "2026-10-08T11:00:00Z",
    modelo: "claude-opus-5-5",
    respostas: 6,
    resumo: "Resumo",
    alertas: [ALERTA],
    mentores: [{ mentor: "Diovani", leitura: "Leitura", pros: ["Prático"], contras: ["Atrasa"], pauta: ["Pontualidade"] }],
    mentorados: [LEITURA_MENTORADO],
  },
  experiencia_adesao: { respostas: 3, mentorados_com_sessao: 10 },
  analise_ia_mentor: {
    gerado_em: "2026-10-08T11:00:00Z",
    modelo: "claude-opus-5-5",
    respostas: 6,
    alertas: [ALERTA],
    mentorados: [LEITURA_MENTORADO],
  },
  mentores_ativos: { nome: "Luan" },
  transcricoes: { drive_id: "d1", mentor: "Luan", status: "aceita", realizada_em: "2026-10-01T13:00:00Z", mentorado_id: "m1" },
  mentorado_notas: { conteudo: "<h1>Plano</h1>", atualizado_em: "2026-10-13T12:00:00Z" },
  faixas_remuneracao: { id: 1, piso: "10000.00", teto: "20000.00", valor_hora: "75.00" },
  mentor_lojas: { id: "l1", mentor: "Luan", marketplace: "Shopee", nome: "Loja 1", ativa: true },
  validacao_faturamento: {
    id: "v1",
    mentor: "Luan",
    competencia: "2026-10-01",
    estado: "enviado",
    enviado_em: "2026-11-03T12:00:00Z",
    alteracao_lojas: false,
    alteracao_lojas_obs: "obs",
    obs_mentor: "obs",
    checklist: { deducoes: true },
    motivo_ajuste: "motivo",
    meet_motivo: "promocao",
    meet_em: "2026-11-05T13:00:00Z",
    obs_admin: "obs",
    faturamento_elegivel: "26310.00",
    faixa_do_mes: 2,
    faixa_vigente: 2,
    faixa_seguinte: 2,
    mudanca: "promocao",
    comunicado_em: "2026-11-05T13:00:00Z",
    sessoes_ids: ["s1"],
    sessoes_qtd: 1,
    valor_hora: "100.00",
    valor_pagar: "100.00",
    validado_em: "2026-11-06T13:00:00Z",
    pago_em: "2026-11-09",
  },
  validacao_lojas: {
    id: "vl1",
    validacao_id: "v1",
    loja_id: "l1",
    marketplace: "Shopee",
    loja_nome: "Loja 1",
    periodo_inicio: "2026-10-01",
    periodo_fim: "2026-10-31",
    vendas: "18400.00",
    pedidos: 120,
    cancelamentos: "0.00",
    devolucoes: "0.00",
    reembolsos: "0.00",
    elegivel: "18400.00",
    arquivo_path: "Luan/2026-10/x-relatorio.pdf",
  },
  validacao_eventos: { id: "e1", validacao_id: "v1", tipo: "estado:enviado", detalhe: "detalhe", criado_em: "2026-11-03T12:00:00Z" },
} satisfies Record<NomeRelacao, Record<string, unknown>>;

// NOT NULL provado: nas migrations de supabase/migrations/ (e nas funções que elas criam), ou a
// chave de desempate que o snapshot do G0.2 conferiu em toda linha (evidence/G0.md). O resto do
// núcleo não tem schema versionado (mapeamento §6.5) e é anulável (design, "Data Models").
const NAO_NULO: Record<NomeRelacao, string[]> = {
  profiles: ["id"],
  mentorados: ["id"],
  mentorados_basic: ["id"],
  parcelas: ["id"],
  lia_cobrancas: ["lia_bill_id", "status", "amount_cents"],
  sessoes: ["id", "etapa_deduzida"],
  rotas: ["id", "unidade"],
  marcos_definicao: ["id", "apoios", "indicadores", "criterios", "placa"],
  mentorado_marcos: ["mentorado_id", "marco_id", "criterios_ok"],
  faturamento_mensal: ["id"],
  canais: ["id"],
  mentorado_canais: ["mentorado_id", "rota_id"],
  sessoes_orfas: ["id"],
  stlseller_mentorados: ["email", "produtos_vendidos", "faturamento_total", "synced_at"],
  stlseller_pedidos_marketplace: ["email", "marketplace"],
  stlseller_produtos_vendidos: ["email", "marketplace", "anuncio_id"],
  nps_respostas: ["id"],
  experiencia_respostas: ["origem_id", "respondido_em", "nota", "itens", "textos"],
  nps_analises: ["gerado_em", "modelo", "respostas", "resumo", "alertas", "mentores", "mentorados"],
  experiencia_adesao: ["respostas", "mentorados_com_sessao"],
  analise_ia_mentor: ["gerado_em", "modelo", "respostas", "alertas", "mentorados"],
  mentores_ativos: ["nome"],
  transcricoes: ["drive_id", "status", "realizada_em"],
  mentorado_notas: ["conteudo", "atualizado_em"],
  // 20261029_validacao_faturamento.sql.
  faixas_remuneracao: ["id", "piso", "valor_hora"],
  mentor_lojas: ["id", "mentor", "marketplace", "nome", "ativa"],
  validacao_faturamento: ["id", "mentor", "competencia", "estado", "checklist"],
  validacao_lojas: ["id", "validacao_id", "marketplace", "loja_nome", "periodo_inicio", "periodo_fim", "vendas", "pedidos", "cancelamentos", "devolucoes", "reembolsos", "elegivel"],
  validacao_eventos: ["id", "validacao_id", "tipo", "criado_em"],
};

const RELACOES = Object.keys(LINHAS) as NomeRelacao[];

// Os caminhos dos problemas de uma linha recusada, ou null se ela passou.
function caminhosRecusados(rel: NomeRelacao, linha: unknown): Array<Array<string | number>> | null {
  const lido = esquemaDe(rel).safeParse(linha);
  return lido.success ? null : lido.error.issues.map((problema) => problema.path);
}

describe("schemas das leituras R01–R23 (DATA-02, DATA-03, EDGE-05, GER-06)", () => {
  it("DATA-02: um schema para cada leitura de R01 a R23", () => {
    expect(Object.keys(ESQUEMAS)).toEqual([
      "profiles",
      "mentorados",
      "mentorados_basic",
      "parcelas",
      "lia_cobrancas",
      "sessoes",
      "rotas",
      "marcos_definicao",
      "mentorado_marcos",
      "faturamento_mensal",
      "canais",
      "mentorado_canais",
      "sessoes_orfas",
      "stlseller_mentorados",
      "stlseller_pedidos_marketplace",
      "stlseller_produtos_vendidos",
      "nps_respostas",
      "experiencia_respostas",
      "nps_analises",
      "experiencia_adesao",
      "analise_ia_mentor",
      "mentores_ativos",
      "transcricoes",
      "mentorado_notas",
      "faixas_remuneracao",
      "mentor_lojas",
      "validacao_faturamento",
      "validacao_lojas",
      "validacao_eventos",
    ]);
  });

  it("DATA-02: cada schema aceita a linha do banco e devolve só as colunas que o index.html lê", () => {
    expect(RELACOES).toEqual(Object.keys(ESQUEMAS));
    for (const rel of RELACOES) {
      const doBanco = { ...LINHAS[rel], coluna_que_o_app_nao_le: "x" };
      expect(esquemaDe(rel).parse(doBanco), rel).toEqual(LINHAS[rel]);
    }
  });

  it("DATA-02: coluna aceita null salvo NOT NULL provado em migration ou chave conferida no snapshot", () => {
    for (const rel of RELACOES) {
      for (const coluna of Object.keys(LINHAS[rel])) {
        const recusada = caminhosRecusados(rel, { ...LINHAS[rel], [coluna]: null });
        expect(recusada, `${rel}.${coluna}`).toEqual(NAO_NULO[rel].includes(coluna) ? [[coluna]] : null);
      }
    }
  });

  it("EDGE-05: sessoes.status aceita texto fora de S_STATUS e o devolve cru", () => {
    for (const status of ["Remarcada", '<img src=x onerror="alert(1)">']) {
      expect(ESQUEMAS.sessoes.parse({ ...LINHAS.sessoes, status }).status).toBe(status);
    }
  });

  it("numeric e bigint aceitos como texto, que é como o PostgREST pode entregá-los, e devolvidos como chegaram", () => {
    const numericos: Array<[NomeRelacao, string]> = [
      ["parcelas", "valor"],
      ["faturamento_mensal", "valor"],
      ["marcos_definicao", "meta_valor"],
      ["stlseller_mentorados", "faturamento_total"],
      ["stlseller_pedidos_marketplace", "total_bruto"],
      ["stlseller_pedidos_marketplace", "total_liquido"],
      ["stlseller_produtos_vendidos", "faturamento"],
      ["experiencia_adesao", "respostas"],
      ["experiencia_adesao", "mentorados_com_sessao"],
    ];
    for (const [rel, coluna] of numericos) {
      for (const valor of ["1234.50", 1234.5]) {
        expect(esquemaDe(rel).parse({ ...LINHAS[rel], [coluna]: valor }), `${rel}.${coluna} = ${valor}`).toEqual({ ...LINHAS[rel], [coluna]: valor });
      }
    }
  });

  it("DATA-03: linha inválida falha com o caminho do campo", () => {
    const { mentor: _semMentor, ...sessaoSemMentor } = LINHAS.sessoes;
    const casos: Array<[NomeRelacao, unknown, Array<string | number>]> = [
      ["sessoes", { ...LINHAS.sessoes, etapa_deduzida: "sim" }, ["etapa_deduzida"]],
      ["sessoes", sessaoSemMentor, ["mentor"]],
      ["sessoes", { ...LINHAS.sessoes, ordem: "1" }, ["ordem"]],
      ["parcelas", { ...LINHAS.parcelas, valor: true }, ["valor"]],
      ["mentorados", { ...LINHAS.mentorados, cancelado: "não" }, ["cancelado"]],
      [
        "marcos_definicao",
        { ...LINHAS.marcos_definicao, criterios: [{ grupo: null, itens: ["a"] }, { grupo: null, itens: "b" }] },
        ["criterios", 1, "itens"],
      ],
      ["experiencia_respostas", { ...LINHAS.experiencia_respostas, itens: { "Qualidade das sessões": 5 } }, ["itens", "Qualidade das sessões"]],
      ["nps_analises", { ...LINHAS.nps_analises, alertas: [{ ...ALERTA, titulo: undefined }] }, ["alertas", 0, "titulo"]],
      ["analise_ia_mentor", { ...LINHAS.analise_ia_mentor, mentorados: [{ ...LEITURA_MENTORADO, pros: "Vendeu" }] }, ["mentorados", 0, "pros"]],
    ];
    for (const [rel, linha, caminho] of casos) expect(caminhosRecusados(rel, linha), `${rel} ${caminho.join(".")}`).toEqual([caminho]);
  });

  it("GER-06: a análise no formato antigo guarda pontos_fortes, pontos_de_atencao e sinais", () => {
    const antiga = {
      ...LINHAS.nps_analises,
      mentores: [{ mentor: "Diovani", leitura: "Leitura", pontos_fortes: ["Prático"], pontos_de_atencao: ["Atrasa"] }],
      mentorados: [{ mentorado_id: null, mentorado: "Fulano", mentor: "Petare", risco: "medio", leitura: "Morno", sinais: ["Nota 5"], acao_sugerida: "Ligar" }],
    };
    expect(ESQUEMAS.nps_analises.parse(antiga)).toEqual(antiga);
    const doMentor = { ...LINHAS.analise_ia_mentor, mentorados: antiga.mentorados };
    expect(ESQUEMAS.analise_ia_mentor.parse(doMentor)).toEqual(doMentor);
  });
});
