import { z } from "zod";

// Um schema Zod por leitura R01–R23 (mapeamento §4.1), com as colunas que o index.html lê: o
// resto da linha é descartado. Coluna é anulável, salvo NOT NULL provado numa migration de
// supabase/migrations/ ou chave de desempate que o snapshot do G0.2 conferiu em toda linha
// (design, "Data Models"; o núcleo não tem schema versionado, mapeamento §6.5).

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

// numeric e bigint: o PostgREST pode entregar como texto, e quem soma converte, como o
// index.html faz com Number(). O valor fica como chegou.
const numerico = z.union([z.number(), z.string()]);
const textos = z.array(z.string());

// R02 e R03. A view do mentor (20260916_email_do_mentorado.sql) não tem as colunas financeiras.
const mentoradoBasico = z.object({
  id: z.string(),
  nome: z.string().nullable(),
  email: z.string().nullable(),
  data_fechamento: z.string().nullable(),
  situacao: z.string().nullable(),
  cancelado: z.boolean().nullable(),
  pausado_em: z.string().nullable(),
  retorno_previsto: z.string().nullable(),
  link_drive: z.string().nullable(),
  link_mapa_mental: z.string().nullable(),
  link_whatsapp: z.string().nullable(),
});

// R19 e R21: o JSON que o nps-analista grava pelo structured output (supabase/functions/
// nps-analista). GER-06: a leitura antiga trazia `pontos_fortes`, `pontos_de_atencao` e
// `sinais` no lugar de `pros`, `contras` e `pauta`. Severidade, tipo e risco ficam texto:
// o index.html mostra o valor cru quando não o conhece.
const alerta = z.object({
  severidade: z.string(),
  tipo: z.string(),
  mentor: z.string().nullable(),
  mentorado: z.string().nullable(),
  titulo: z.string(),
  detalhe: z.string(),
  evidencia: z.string(),
  acao_sugerida: z.string(),
});
const leituraMentor = z.object({
  mentor: z.string(),
  leitura: z.string(),
  pros: textos.optional(),
  contras: textos.optional(),
  pauta: textos.optional(),
  pontos_fortes: textos.optional(),
  pontos_de_atencao: textos.optional(),
});
const leituraMentorado = z.object({
  mentorado_id: z.string().nullable(),
  mentorado: z.string(),
  mentor: z.string(),
  risco: z.string(),
  leitura: z.string(),
  acao_sugerida: z.string(),
  pros: textos.optional(),
  contras: textos.optional(),
  pauta: textos.optional(),
  sinais: textos.optional(),
});
const analise = z.object({
  gerado_em: z.string(),
  modelo: z.string(),
  respostas: z.number(),
  resumo: z.string(),
  alertas: z.array(alerta),
  mentores: z.array(leituraMentor),
  mentorados: z.array(leituraMentorado),
});

export const ESQUEMAS = {
  // R01. O `role` chega nulo ou com texto fora da lista: quem decide é a sessão (AUTH-07).
  profiles: z.object({
    id: z.string(),
    role: z.string().nullable(),
    nome: z.string().nullable(),
    email: z.string().nullable(),
  }),
  mentorados: mentoradoBasico.extend({
    cadastro_incompleto: z.boolean().nullable(),
    contrato_status: z.string().nullable(),
    entrada_status: z.string().nullable(),
    entrada_forma_pgto: z.string().nullable(),
    restante_status: z.string().nullable(),
    restante_forma_pgto: z.string().nullable(),
  }),
  mentorados_basic: mentoradoBasico,
  parcelas: z.object({
    id: z.string(),
    mentorado_id: z.string().nullable(),
    numero: z.number().nullable(),
    status: z.string().nullable(),
    vencimento: z.string().nullable(),
    valor: numerico.nullable(),
    lia_bill_id: z.string().nullable(),
  }),
  // 20260917_lia_pagamentos.sql. `ignorada` não está em migration.
  lia_cobrancas: z.object({
    lia_bill_id: z.string(),
    mentorado_id: z.string().nullable(),
    status: z.string(),
    amount_cents: z.number(),
    due_date: z.string().nullable(),
    contact_email: z.string().nullable(),
    ignorada: z.boolean().nullable(),
  }),
  // EDGE-05: `status` é texto livre, também fora de S_STATUS. `etapa_deduzida` em 20260917_etapa_deduzida.sql.
  sessoes: z.object({
    id: z.string(),
    mentorado_id: z.string().nullable(),
    etapa: z.string().nullable(),
    ordem: z.number().nullable(),
    status: z.string().nullable(),
    mentor: z.string().nullable(),
    data: z.string().nullable(),
    hora: z.string().nullable(),
    link_meet: z.string().nullable(),
    link_gravacao: z.string().nullable(),
    link_anotacoes: z.string().nullable(),
    google_event_id: z.string().nullable(),
    etapa_deduzida: z.boolean(),
  }),
  // R07, R08 e R09: as colunas novas em 20260916_rotas_elite3d.sql.
  rotas: z.object({
    id: z.string(),
    slug: z.string().nullable(),
    nome: z.string().nullable(),
    modelo: z.string().nullable(),
    ordem: z.number().nullable(),
    unidade: z.string(),
  }),
  marcos_definicao: z.object({
    id: z.string(),
    rota_id: z.string().nullable(),
    nome: z.string().nullable(),
    objetivo: z.string().nullable(),
    ordem: z.number().nullable(),
    subtitulo: z.string().nullable(),
    restricao: z.string().nullable(),
    alavanca: z.string().nullable(),
    pergunta_chave: z.string().nullable(),
    apoios: textos,
    indicadores: textos,
    // Lista de portões: [{"grupo": null|texto, "itens": [...]}] (comentário da coluna).
    criterios: z.array(z.object({ grupo: z.string().nullable(), itens: textos })),
    meta_valor: numerico.nullable(),
    placa: z.boolean(),
  }),
  mentorado_marcos: z.object({
    mentorado_id: z.string(),
    marco_id: z.string(),
    status: z.string().nullable(),
    data: z.string().nullable(),
    updated_at: z.string().nullable(),
    criterios_ok: textos,
    bloqueios: textos.nullable(),
    proxima_acao: z.string().nullable(),
  }),
  faturamento_mensal: z.object({
    id: z.string(),
    mentorado_id: z.string().nullable(),
    mes: z.string().nullable(),
    canal_id: z.string().nullable(),
    valor: numerico.nullable(),
  }),
  canais: z.object({
    id: z.string(),
    rota_id: z.string().nullable(),
    nome: z.string().nullable(),
    ordem: z.number().nullable(),
  }),
  mentorado_canais: z.object({
    mentorado_id: z.string(),
    rota_id: z.string(),
    canal_id: z.string().nullable(),
  }),
  sessoes_orfas: z.object({
    id: z.string(),
    mentorado_id: z.string().nullable(),
    mentorado_nome: z.string().nullable(),
    etapa: z.string().nullable(),
    mentor: z.string().nullable(),
    data: z.string().nullable(),
    hora: z.string().nullable(),
    status: z.string().nullable(),
  }),
  // R14–R16: 20260922_stlseller_estruturado.sql.
  stlseller_mentorados: z.object({
    email: z.string(),
    email_stlflix: z.string().nullable(),
    nome: z.string().nullable(),
    status_formulario: z.string().nullable(),
    status_real: z.string().nullable(),
    plano_ativo: z.boolean().nullable(),
    vendas_marketplace: z.number().nullable(),
    loja_id: z.string().nullable(),
    loja_nome: z.string().nullable(),
    loja_email: z.string().nullable(),
    lia_status_pagamento: z.string().nullable(),
    lia_motivo_cancelamento: z.string().nullable(),
    lia_pedidos: z.number().nullable(),
    lia_pedidos_finalizados: z.number().nullable(),
    lia_ultimo_pedido_em: z.string().nullable(),
    produtos_vendidos: z.number(),
    faturamento_total: numerico,
    synced_at: z.string(),
  }),
  stlseller_pedidos_marketplace: z.object({
    email: z.string(),
    marketplace: z.string(),
    pedidos: z.number().nullable(),
    pedidos_vendidos: z.number().nullable(),
    pedidos_cancelados: z.number().nullable(),
    total_bruto: numerico.nullable(),
    total_liquido: numerico.nullable(),
    ultimo_pedido_em: z.string().nullable(),
  }),
  stlseller_produtos_vendidos: z.object({
    email: z.string(),
    marketplace: z.string(),
    anuncio_id: z.string(),
    titulo: z.string().nullable(),
    cadastrado_no_stlseller: z.boolean().nullable(),
    link: z.string().nullable(),
    pedidos: z.number().nullable(),
    unidades: z.number().nullable(),
    faturamento: numerico.nullable(),
    ultima_venda_em: z.string().nullable(),
  }),
  // As três perguntas novas em 20261013_nps_respostas_perguntas_novas.sql.
  nps_respostas: z.object({
    id: z.string(),
    mentor: z.string().nullable(),
    nota: z.number().nullable(),
    respondido_em: z.string().nullable(),
    mentorado_id: z.string().nullable(),
    nome_informado: z.string().nullable(),
    comentario: z.string().nullable(),
    clareza: z.string().nullable(),
    direcionamento: z.string().nullable(),
    apoio: z.string().nullable(),
  }),
  // R18 e R19: 20261008_experiencia_e_analista_nps.sql e 20261008_nps_analises_por_mentor_e_mentorado.sql.
  experiencia_respostas: z.object({
    origem_id: z.string(),
    respondido_em: z.string(),
    nota: z.number(),
    geral: z.string().nullable(),
    clareza: z.string().nullable(),
    itens: z.record(z.string()),
    textos: z.record(z.string()),
  }),
  nps_analises: analise,
  // R20 e R21: as colunas de `returns table` de 20261013_experiencia_adesao.sql e 20261013_analise_ia_mentor.sql.
  experiencia_adesao: z.object({ respostas: numerico, mentorados_com_sessao: numerico }),
  // AD-005: o recorte do mentor vem sem `resumo` e sem `mentores`.
  analise_ia_mentor: analise.omit({ resumo: true, mentores: true }),
  // R22: 20261013_transcricoes_e_dossies.sql. `drive_id` entra no select para o desempate.
  transcricoes: z.object({
    drive_id: z.string(),
    mentor: z.string().nullable(),
    status: z.string(),
    realizada_em: z.string(),
    mentorado_id: z.string().nullable(),
  }),
  // R23: 20261013_mentorado_notas.sql.
  mentorado_notas: z.object({ conteudo: z.string(), atualizado_em: z.string() }),
};

type Linha<R extends keyof typeof ESQUEMAS> = z.infer<(typeof ESQUEMAS)[R]>;

export type Perfil = Linha<"profiles">;
export type MentoradoBasico = Linha<"mentorados_basic">;
// R02 ou R03, conforme o papel: as colunas financeiras ficam opcionais, como o `undefined` que o
// index.html lê nelas quando o mentor carrega a view.
export type Mentorado = MentoradoBasico & Partial<Omit<Linha<"mentorados">, keyof MentoradoBasico>>;
export type Parcela = Linha<"parcelas">;
export type Cobranca = Linha<"lia_cobrancas">;
export type Sessao = Linha<"sessoes">;
export type Rota = Linha<"rotas">;
export type MarcoDef = Linha<"marcos_definicao">;
export type MentoradoMarco = Linha<"mentorado_marcos">;
export type Faturamento = Linha<"faturamento_mensal">;
export type Canal = Linha<"canais">;
export type MentoradoCanal = Linha<"mentorado_canais">;
export type SessaoOrfa = Linha<"sessoes_orfas">;
export type StlMentorado = Linha<"stlseller_mentorados">;
export type StlPedido = Linha<"stlseller_pedidos_marketplace">;
export type StlProduto = Linha<"stlseller_produtos_vendidos">;
export type NpsResposta = Linha<"nps_respostas">;
export type ExpResposta = Linha<"experiencia_respostas">;
// R19 ou R21: `resumo` e `mentores` só existem na leitura de admin e diretoria.
export type Analise = Linha<"analise_ia_mentor"> & Partial<Pick<Linha<"nps_analises">, "resumo" | "mentores">>;
export type Adesao = Linha<"experiencia_adesao">;
export type Transcricao = Linha<"transcricoes">;
export type Nota = Linha<"mentorado_notas">;
