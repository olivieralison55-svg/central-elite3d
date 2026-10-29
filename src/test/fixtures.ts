import type { Dataset } from "@/lib/data/esquemas";

// Os fixtures do harness antigo (tests/ambiente.mjs:193–340). Cobrem de propósito: mentorado
// ativo, pausado, com e sem sessão, nome com XSS, sessão sem mentor e sem data, e dois
// encontros em grupo, um com presenças divergentes e outro agendado no futuro. Datas em 2099
// nunca "vencem" com o passar do tempo.

// tests/ambiente.mjs:31. Neutralizado é o que aparece escapado (`&lt;img`) e não abre elemento
// novo (`<img` cru ausente): provar só a ausência não distingue escape de dado descartado.
export const XSS = '"><img src=x onerror=alert(1)>';

// p2 e p3 vencem em datas relativas a hoje, em Brasília, para o prazo ser testável sem envelhecer.
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

// As colunas que os casos abaixo não variam, como o PostgREST entrega: presentes, e nulas quando vazias.
const MENTORADO = {
  email: null,
  cancelado: false,
  pausado_em: null,
  retorno_previsto: null,
  link_drive: null,
  link_mapa_mental: null,
  link_whatsapp: null,
  cadastro_incompleto: false,
  entrada_forma_pgto: null,
  restante_forma_pgto: null,
};
const SESSAO = { link_meet: null, link_gravacao: null, link_anotacoes: null, google_event_id: null, etapa_deduzida: false };
const STLSELLER = {
  nome: null,
  vendas_marketplace: null,
  loja_id: null,
  loja_nome: null,
  loja_email: null,
  lia_status_pagamento: null,
  lia_motivo_cancelamento: null,
  lia_pedidos: null,
  lia_pedidos_finalizados: null,
  lia_ultimo_pedido_em: null,
};
const NPS = { comentario: null, clareza: null, direcionamento: null, apoio: null };

// Um Dataset novo a cada chamada: um teste não contamina o outro.
export function datasetDeTeste(): Dataset {
  return {
    mentorados: [
      // m1 com e-mail, m2 sem: os dois caminhos do sync convivem.
      { ...MENTORADO, id: "m1", nome: "Ana Clara", situacao: "ativo", data_fechamento: "2026-01-10", contrato_status: "Assinado", entrada_status: "Pago", restante_status: "Pago", email: "ana.clara@exemplo.com" },
      { ...MENTORADO, id: "m2", nome: "Bruno Dias", situacao: "ativo", data_fechamento: "2026-03-02", contrato_status: "Ainda não", entrada_status: "Pago", restante_status: "Ainda não", email: "bruno@exemplo.com" },
      { ...MENTORADO, id: "m3", nome: "Diego " + XSS, situacao: "ativo", data_fechamento: "2025-10-01", contrato_status: "Assinado", entrada_status: "Pago", restante_status: "Pago", cadastro_incompleto: true },
      { ...MENTORADO, id: "m4", nome: "Carla " + XSS, situacao: "pausado", data_fechamento: "2025-11-20", contrato_status: "Assinado", entrada_status: "Pago", restante_status: "Pago" },
    ],
    sessoes: [
      // trilha 1:1
      { ...SESSAO, id: "s1", mentorado_id: "m1", etapa: "Diagnóstico de Negócio", ordem: 1, status: "Concluída", mentor: "Evaldo", data: "2026-02-01", hora: "10:00:00" },
      // s2 com a etapa escolhida pelo sync: ninguém salvou a sessão para confirmar.
      { ...SESSAO, id: "s2", mentorado_id: "m1", etapa: "Plano de Ação", ordem: 2, status: "Agendada", mentor: "Evaldo", data: "2099-09-01", hora: "14:00:00", etapa_deduzida: true },
      { ...SESSAO, id: "s3", mentorado_id: "m2", etapa: "Diagnóstico de Negócio", ordem: 1, status: "Aguardando confirmação", mentor: null, data: "2026-04-01", hora: "09:00:00" },
      { ...SESSAO, id: "s4", mentorado_id: "m2", etapa: "Checkup 1", ordem: 3, status: "Bloqueada", mentor: "Luan", data: null, hora: null },
      { ...SESSAO, id: "s5", mentorado_id: "m4", etapa: "Plano de Ação", ordem: 2, status: "Concluída", mentor: "Israel", data: "2025-12-05", hora: "11:00:00" },
      // encontro em grupo: 3 presenças no mesmo dia e hora, uma divergente
      { ...SESSAO, id: "g1", mentorado_id: "m1", etapa: "Plantão de Dúvida Semanal", ordem: 90, status: "Concluída", mentor: "Sergio", data: "2026-08-06", hora: "19:00:00", link_gravacao: "https://exemplo.com/g1" },
      { ...SESSAO, id: "g2", mentorado_id: "m2", etapa: "Plantão de Dúvida Semanal", ordem: 90, status: "Concluída", mentor: "Sergio", data: "2026-08-06", hora: "19:00:00" },
      { ...SESSAO, id: "g3", mentorado_id: "m4", etapa: "Plantão de Dúvida Semanal", ordem: 90, status: "Bloqueada", mentor: "Sergio", data: "2026-08-06", hora: "19:00:00" },
      // encontro em grupo agendado
      { ...SESSAO, id: "g4", mentorado_id: "m1", etapa: "Sessão de Implementação Mensal", ordem: 91, status: "Agendada", mentor: "Michelle", data: "2099-10-15", hora: "20:00:00" },
      { ...SESSAO, id: "g5", mentorado_id: "m2", etapa: "Sessão de Implementação Mensal", ordem: 91, status: "Agendada", mentor: "Michelle", data: "2099-10-15", hora: "20:00:00" },
    ],
    // p1 é manual e já venceu; p2 e p3 vieram da Lia (uma paga, uma a vencer).
    parcelas: [
      { id: "p1", mentorado_id: "m1", numero: 1, status: "aberta", vencimento: "2026-01-01", valor: 500, lia_bill_id: null },
      { id: "p2", mentorado_id: "m2", numero: 1, status: "paga", vencimento: emDias(-30), valor: 800, lia_bill_id: "bill_1" },
      { id: "p3", mentorado_id: "m2", numero: 2, status: "aberta", vencimento: emDias(3), valor: 800, lia_bill_id: "bill_2" },
    ],
    // A rota rica: um marco com a gramática inteira do Compilado e outro só com o nome. O
    // critério com XSS prova o escape do teste de passagem.
    rotas: [{ id: "r1", slug: "feiras", nome: "Rota das Feiras", modelo: "rico", ordem: 1, unidade: "acumulado" }],
    marcos: [
      {
        id: "mk1",
        rota_id: "r1",
        nome: "Marco 01 — R$ 500 acumulados",
        objetivo: "A feira paga o dia",
        ordem: 1,
        subtitulo: "Escolher a feira certa e montar a operação mínima.",
        restricao: "Cada feira começa do zero",
        alavanca: "Repetição",
        pergunta_chave: "O que falta?",
        apoios: ["Qualificar a feira com o organizador", "Mix mínimo viável"],
        indicadores: ["Ticket médio", "Conversão"],
        meta_valor: 500,
        placa: false,
        criterios: [
          { grupo: "Portão A · Apto a vender", itens: ["Tenho produto validado", "Conheço meu CMV"] },
          { grupo: "Portão B · Primeira receita", itens: ["Bati R$ 500 acumulados na rota", "Registrei " + XSS] },
        ],
      },
      {
        id: "mk2",
        rota_id: "r1",
        nome: "Marco 04 — R$ 20.000 acumulados",
        objetivo: null,
        ordem: 4,
        subtitulo: null,
        restricao: null,
        alavanca: null,
        pergunta_chave: null,
        apoios: [],
        indicadores: [],
        meta_valor: 20000,
        placa: true,
        criterios: [{ grupo: null, itens: ["Tenho calendário fechado para os próximos 3 meses"] }],
      },
    ],
    mentoradoMarcos: [
      {
        mentorado_id: "m1",
        marco_id: "mk1",
        status: "EM_ANDAMENTO",
        data: "2026-05-01",
        updated_at: null,
        criterios_ok: ["Tenho produto validado", "Conheço meu CMV"],
        bloqueios: ["Sem ponto de energia"],
        proxima_acao: "Fechar inscrição da próxima feira",
      },
    ],
    canais: [{ id: "c1", rota_id: "r1", nome: "Presencial", ordem: 1 }],
    mentoradoCanais: [{ mentorado_id: "m1", rota_id: "r1", canal_id: "c1" }],
    faturamento: [
      { id: "f1", mentorado_id: "m1", mes: "2026-07-01", canal_id: "c1", valor: 10000 },
      { id: "f2", mentorado_id: "m1", mes: "2026-08-01", canal_id: "c1", valor: 5000 },
    ],
    // Duas órfãs, uma resolvível (o e-mail casa com m2) e uma sem e-mail; uma vinculada; uma descartada.
    cobrancas: [
      { lia_bill_id: "orf1", mentorado_id: null, status: "paid", amount_cents: 150000, due_date: "2026-09-20", contact_email: "bruno@exemplo.com", ignorada: false },
      { lia_bill_id: "orf2", mentorado_id: null, status: "overdue", amount_cents: 90000, due_date: "2026-08-10", contact_email: null, ignorada: false },
      { lia_bill_id: "ok1", mentorado_id: "m1", status: "paid", amount_cents: 600, due_date: "2026-09-18", contact_email: "ana.clara@exemplo.com", ignorada: false },
      { lia_bill_id: "desc1", mentorado_id: null, status: "paid", amount_cents: 100, due_date: "2026-09-01", contact_email: "teste@exemplo.com", ignorada: true },
    ],
    orfas: [],
    // STLSeller: m1 casa pelo e-mail do formulário, m2 pelo e-mail STLFLIX; m3 e m4 não têm registro.
    stlseller: [
      {
        ...STLSELLER,
        email: "ana.clara@exemplo.com",
        email_stlflix: "ana@stlflix.com",
        status_formulario: "ATIVO",
        status_real: "pago",
        plano_ativo: true,
        vendas_marketplace: 214,
        loja_id: "s1",
        loja_nome: "Loja da Ana",
        loja_email: "loja@ana.com",
        lia_status_pagamento: "finished",
        lia_pedidos: 1,
        lia_pedidos_finalizados: 1,
        lia_ultimo_pedido_em: "2026-08-06T21:52:45.995+00:00",
        lia_motivo_cancelamento: null,
        produtos_vendidos: 2,
        faturamento_total: "1234.50",
        synced_at: "2026-09-22T12:00:00Z",
      },
      {
        ...STLSELLER,
        email: "outro@exemplo.com",
        email_stlflix: "bruno@exemplo.com",
        status_formulario: "PAUSADO",
        status_real: "sem_pedido_lia",
        plano_ativo: false,
        loja_id: null,
        lia_ultimo_pedido_em: null,
        produtos_vendidos: 0,
        faturamento_total: "0.00",
        synced_at: "2026-09-22T12:00:00Z",
      },
      // O e-mail do formulário difere, mas o STLFLIX acha a loja (caixa diferente de propósito).
      {
        ...STLSELLER,
        email: "form.eva@exemplo.com",
        email_stlflix: "eva@stlflix.com",
        nome: "Eva Sem Ficha",
        status_formulario: "ATIVO",
        status_real: "pago",
        plano_ativo: true,
        loja_id: "s3",
        loja_nome: "Loja da Eva",
        loja_email: "EVA@stlflix.com",
        produtos_vendidos: 0,
        faturamento_total: "0.00",
        synced_at: "2026-09-22T12:00:00Z",
      },
    ],
    stlPedidos: [
      {
        email: "ana.clara@exemplo.com",
        marketplace: "mercadolivre",
        pedidos: 12,
        pedidos_vendidos: 10,
        pedidos_cancelados: 2,
        total_bruto: "1500.00",
        total_liquido: null,
        ultimo_pedido_em: "2026-09-01T10:00:00Z",
      },
    ],
    // numeric chega do PostgREST como string. O permalink javascript: prova que link de fora não vira href.
    stlProdutos: [
      { email: "ana.clara@exemplo.com", marketplace: "mercadolivre", anuncio_id: "MLB1", titulo: "Vaso " + XSS, cadastrado_no_stlseller: null, link: "javascript:alert(1)", pedidos: 3, unidades: 4, faturamento: "234.50", ultima_venda_em: "2026-09-01T10:00:00Z" },
      { email: "ana.clara@exemplo.com", marketplace: "shopee", anuncio_id: "SP1", titulo: "Chaveiro", cadastrado_no_stlseller: null, link: "https://exemplo.com/p/1", pedidos: 7, unidades: 9, faturamento: "1000.00", ultima_venda_em: "2026-08-20T10:00:00Z" },
    ],
    // NPS: duas semanas de setembro e uma de agosto. n1 é das 22h de domingo em Brasília (01h de
    // segunda em UTC): conta no domingo, na semana de 07/09.
    nps: [
      { ...NPS, id: "n1", mentor: "Diovani", nota: 10, respondido_em: "2026-09-14T01:00:00Z", mentorado_id: "m1", nome_informado: "Ana Clara Silva", comentario: "Ótima " + XSS },
      { ...NPS, id: "n2", mentor: "Diovani", nota: 8, respondido_em: "2026-09-16T13:00:00Z", mentorado_id: null, nome_informado: "Zé " + XSS },
      { ...NPS, id: "n3", mentor: "Petare " + XSS, nota: 5, respondido_em: "2026-09-17T13:00:00Z", mentorado_id: null, nome_informado: "Fulano" },
      { ...NPS, id: "n4", mentor: "Diovani", nota: 9, respondido_em: "2026-08-20T13:00:00Z", mentorado_id: null, nome_informado: "Beltrano" },
    ],
    // Experiência: um promotor e um detrator, dois itens da grade com índices 87,5 e 12,5, texto com XSS.
    experiencia: [
      {
        origem_id: "sheet:a",
        respondido_em: "2026-10-01T14:00:00Z",
        nota: 10,
        geral: "Muito Satisfeito",
        clareza: "Sim",
        itens: { "Qualidade das sessões": "Excelente", "Organização dos agendamentos": "Ruim" },
        textos: { "O que mais gera valor?": "Sessões " + XSS },
      },
      {
        origem_id: "sheet:b",
        respondido_em: "2026-10-01T15:00:00Z",
        nota: 5,
        geral: "Neutro",
        clareza: "Não",
        itens: { "Qualidade das sessões": "Bom", "Organização dos agendamentos": "Muito ruim" },
        textos: {},
      },
    ],
    // A análise da IA traz XSS no resumo e no alerta: tudo que vem do modelo é escapado.
    analise: {
      gerado_em: "2026-10-08T11:00:00Z",
      modelo: "claude-opus-5-5",
      respostas: 6,
      resumo: "Resumo " + XSS,
      alertas: [
        {
          severidade: "alta",
          tipo: "mentorado",
          mentor: "Luan",
          mentorado: "Ana " + XSS,
          titulo: "Nota caiu " + XSS,
          detalhe: "Detalhe",
          evidencia: '"citação"',
          acao_sugerida: "Ligar hoje",
        },
      ],
      mentores: [{ mentor: "Diovani", leitura: "Leitura " + XSS, pontos_fortes: ["Prático"], pontos_de_atencao: ["Atrasa " + XSS] }],
      mentorados: [
        { mentorado_id: null, mentorado: "Fulano", mentor: "Petare", risco: "medio", leitura: "Morno", sinais: ["Nota 5"], acao_sugerida: "Ligar" },
        {
          mentorado_id: "m1",
          mentorado: "Ana Clara",
          mentor: "Diovani",
          risco: "alto",
          leitura: "Frustrada " + XSS,
          pros: ["Vendeu na feira"],
          contras: ['"' + XSS + '"'],
          pauta: ["O que travou? " + XSS],
          acao_sugerida: "CS hoje",
        },
        { mentorado_id: "inventado", mentorado: "Outro " + XSS, mentor: "Luan", risco: "baixo", leitura: "Ok", sinais: [], acao_sugerida: "Manter" },
      ],
    },
    adesao: null,
    transcricoes: [],
    faixas: [],
    mentorLojas: [],
    validacoes: [],
    validacaoLojas: [],
    validacaoEventos: [],
  };
}
