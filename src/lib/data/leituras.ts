import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { INICIO_COBRANCA_NPS, PRAZO_RESPOSTA_DIAS } from "@/lib/constantes";
import { type Papel, pode } from "@/lib/papeis";

import { usuarioDaSessao } from "./auth";
import { cliente } from "./cliente";
import { type Analise, type Dataset, type ErrosDeCarga, ESQUEMAS, type Nota, type Relacao, type Resultado } from "./esquemas";
import { lerPaginado, type Ordem, validarLinhas } from "./paginar";

// A carga inteira (R02–R22), porte do `loadAll` (index.html:736–799), e a nota (R23). Toda
// função recebe o cliente por último, com `cliente()` de padrão: os testes passam um falso.

// DATA-06: falha de R02/R03, R04 ou R06 derruba a carga; a de outra relação vai para `erros`, e
// só as telas que a usam mostram o erro (DATA-07). SEC-06: `sessaoMudou` diz que nada foi lido.
export type Carga = { ok: true; dados: Dataset; erros: ErrosDeCarga } | { ok: false; erro: string; sessaoMudou?: true };

type Resposta = PromiseLike<{ data: unknown; error: { message: string } | null }>;

const nada = <T>(vazio: T): Promise<Resultado<T>> => Promise.resolve({ ok: true, dados: vazio });

// R19, R20 e R21 devolvem uma linha ou nenhuma.
async function primeira<T>(rel: Relacao, pedido: Resposta, esquema: z.ZodType<T>): Promise<Resultado<T | null>> {
  const { data, error } = await pedido;
  if (error) {
    console.error(`[central-elite3d] ${rel}`, error);
    return { ok: false, erro: error.message };
  }
  const lido = validarLinhas(rel, esquema, data);
  return lido.ok ? { ok: true, dados: lido.dados[0] ?? null } : lido;
}

export async function carregarTudo(papel: Papel, usuarioId: string, db: SupabaseClient = cliente()): Promise<Carga> {
  // SEC-06: sem sessão, a leitura iria como anon e voltaria vazia sem erro; com a de outra
  // pessoa (login em outra aba), traria o recorte dela.
  if ((await usuarioDaSessao(db)) !== usuarioId) return { ok: false, erro: "A sessão mudou.", sessaoMudou: true };

  // Quem não vê o financeiro (o mentor) lê a view e o recorte da IA e não pede o resto: o RLS
  // barraria, e a viagem voltaria vazia (index.html:737–746).
  const completo = pode(papel, "verFinanceiro");
  const lista = <T>(rel: Relacao, esquema: z.ZodType<T>, ordem: Ordem[], colunas = "*") =>
    lerPaginado(rel, () => db.from(rel).select(colunas), ordem, esquema);
  const doCompleto = <T>(ler: () => Promise<Resultado<T[]>>) => (completo ? ler() : nada<T[]>([]));
  const analise: Promise<Resultado<Analise | null>> = completo
    ? primeira("nps_analises", db.from("nps_analises").select("*").order("gerado_em", { ascending: false }).limit(1), ESQUEMAS.nps_analises)
    : primeira("analise_ia_mentor", db.rpc("analise_ia_mentor"), ESQUEMAS.analise_ia_mentor);

  // As 20 leituras em paralelo. A ordem de hoje e o desempate pela chave única (design,
  // "Leituras"): a mesma do scripts/parity/snapshot.mjs, conferida no banco no G0.2.
  const [
    mentorados,
    parcelas,
    cobrancas,
    sessoes,
    rotas,
    marcos,
    mentoradoMarcos,
    faturamento,
    canais,
    mentoradoCanais,
    orfas,
    stlseller,
    stlPedidos,
    stlProdutos,
    nps,
    experiencia,
    analiseLida,
    adesao,
    transcricoes,
  ] = await Promise.all([
    completo
      ? lista("mentorados", ESQUEMAS.mentorados, [["data_fechamento", true], ["id", true]])
      : lista("mentorados_basic", ESQUEMAS.mentorados_basic, [["data_fechamento", true], ["id", true]]),
    doCompleto(() => lista("parcelas", ESQUEMAS.parcelas, [["numero", true], ["id", true]])),
    doCompleto(() => lista("lia_cobrancas", ESQUEMAS.lia_cobrancas, [["due_date", true], ["id", true]])),
    lista("sessoes", ESQUEMAS.sessoes, [["ordem", true], ["id", true]]),
    lista("rotas", ESQUEMAS.rotas, [["ordem", true], ["id", true]]),
    lista("marcos_definicao", ESQUEMAS.marcos_definicao, [["ordem", true], ["id", true]]),
    lista("mentorado_marcos", ESQUEMAS.mentorado_marcos, [["mentorado_id", true], ["marco_id", true]]),
    lista("faturamento_mensal", ESQUEMAS.faturamento_mensal, [["id", true]]),
    lista("canais", ESQUEMAS.canais, [["ordem", true], ["id", true]]),
    lista("mentorado_canais", ESQUEMAS.mentorado_canais, [["mentorado_id", true], ["rota_id", true]]),
    lista("sessoes_orfas", ESQUEMAS.sessoes_orfas, [["id", true]]),
    doCompleto(() => lista("stlseller_mentorados", ESQUEMAS.stlseller_mentorados, [["email", true]])),
    doCompleto(() => lista("stlseller_pedidos_marketplace", ESQUEMAS.stlseller_pedidos_marketplace, [["email", true], ["marketplace", true]])),
    doCompleto(() =>
      lista("stlseller_produtos_vendidos", ESQUEMAS.stlseller_produtos_vendidos, [
        ["faturamento", false],
        ["email", true],
        ["marketplace", true],
        ["anuncio_id", true],
      ]),
    ),
    doCompleto(() => lista("nps_respostas", ESQUEMAS.nps_respostas, [["respondido_em", false], ["id", true]])),
    doCompleto(() => lista("experiencia_respostas", ESQUEMAS.experiencia_respostas, [["respondido_em", false], ["origem_id", true]])),
    analise,
    primeira("experiencia_adesao", db.rpc("experiencia_adesao", { p_desde: INICIO_COBRANCA_NPS, p_prazo_dias: PRAZO_RESPOSTA_DIAS }), ESQUEMAS.experiencia_adesao),
    doCompleto(() => lista("transcricoes", ESQUEMAS.transcricoes, [["drive_id", true]], "mentor,status,realizada_em,mentorado_id,drive_id")),
  ]);

  if (!mentorados.ok) return mentorados;
  if (!parcelas.ok) return parcelas;
  if (!sessoes.ok) return sessoes;

  const erros: ErrosDeCarga = {};
  const ou = <T>(rel: Relacao, lido: Resultado<T>, vazio: T): T => {
    if (lido.ok) return lido.dados;
    erros[rel] = lido.erro;
    return vazio;
  };
  const dados: Dataset = {
    mentorados: mentorados.dados,
    parcelas: parcelas.dados,
    cobrancas: ou("lia_cobrancas", cobrancas, []),
    sessoes: sessoes.dados,
    rotas: ou("rotas", rotas, []),
    marcos: ou("marcos_definicao", marcos, []),
    mentoradoMarcos: ou("mentorado_marcos", mentoradoMarcos, []),
    faturamento: ou("faturamento_mensal", faturamento, []),
    canais: ou("canais", canais, []),
    mentoradoCanais: ou("mentorado_canais", mentoradoCanais, []),
    orfas: ou("sessoes_orfas", orfas, []),
    stlseller: ou("stlseller_mentorados", stlseller, []),
    stlPedidos: ou("stlseller_pedidos_marketplace", stlPedidos, []),
    stlProdutos: ou("stlseller_produtos_vendidos", stlProdutos, []),
    nps: ou("nps_respostas", nps, []),
    experiencia: ou("experiencia_respostas", experiencia, []),
    analise: ou(completo ? "nps_analises" : "analise_ia_mentor", analiseLida, null),
    adesao: ou("experiencia_adesao", adesao, null),
    transcricoes: ou("transcricoes", transcricoes, []),
  };
  return { ok: true, dados, erros };
}

// R23, ao abrir a aba Notas. Sem linha é nota que ainda não existe: `null`. SEC-06: a mesma
// conferência da carga, e a mesma resposta quando a sessão não é a do usuário da tela.
export async function lerNota(
  mentoradoId: string,
  usuarioId: string,
  db: SupabaseClient = cliente(),
): Promise<{ ok: true; dados: Nota | null } | Extract<Carga, { ok: false }>> {
  if ((await usuarioDaSessao(db)) !== usuarioId) return { ok: false, erro: "A sessão mudou.", sessaoMudou: true };
  const { data, error } = await db.from("mentorado_notas").select("conteudo,atualizado_em").eq("mentorado_id", mentoradoId).maybeSingle();
  if (error) {
    console.error("[central-elite3d] mentorado_notas", error);
    return { ok: false, erro: error.message };
  }
  const lido = validarLinhas("mentorado_notas", ESQUEMAS.mentorado_notas, data === null ? [] : [data]);
  return lido.ok ? { ok: true, dados: lido.dados[0] ?? null } : lido;
}

const LINKS_ASSINADOS = z.array(z.object({ path: z.string().nullable(), signedUrl: z.string().nullable(), error: z.string().nullable() }));

// Os links dos anexos das notas (AD-010): assinados por 1 h, pedidos por quem está logado. O
// caminho que o Storage recusa (apagado, sem permissão) fica fora do mapa, e a nota mostra o
// `anexo:` sem link. Lista vazia não sai.
export async function linksAssinados(caminhos: readonly string[], db: SupabaseClient = cliente()): Promise<Resultado<Map<string, string>>> {
  if (caminhos.length === 0) return { ok: true, dados: new Map() };
  const { data, error } = await db.storage.from("notas-anexos").createSignedUrls([...caminhos], 3600);
  if (error) {
    console.error("[central-elite3d] notas-anexos", error);
    return { ok: false, erro: error.message };
  }
  const lidos = LINKS_ASSINADOS.safeParse(data);
  if (!lidos.success) {
    console.error("[central-elite3d] notas-anexos: schema mismatch", lidos.error.issues);
    return { ok: false, erro: "notas-anexos: schema mismatch" };
  }
  const links = new Map<string, string>();
  for (const { path, signedUrl, error: recusa } of lidos.data) if (path && signedUrl && !recusa) links.set(path, signedUrl);
  return { ok: true, dados: links };
}
