// nps-analista — o analista de IA das pesquisas da mentoria.
//
// Lê o NPS das sessões (`nps_respostas`, com mentor e mentorado) e a Pesquisa de
// Experiência (`experiencia_respostas`, anônima), pede ao Claude um resumo e
// alertas para a gestão, e grava uma linha em `nps_analises`. Os alertas são só
// para admin e diretoria — nada é enviado a mentor (ver docs/decisions/001).
//
// Roda uma vez por dia (pg_cron), mas só chama o Claude quando entrou resposta
// nova desde a última análise: `dados_ate` é a marca d'água (maior `created_at`
// visto). Sem modo "forçar" de propósito: o job chama com a chave pública, então
// qualquer um com ela pode chamar a função — e sem novidade ela não gasta nada.
//
// Só LLM, sem JEV: medido em 08/10/2026 os dois empatam (12/14) e o JEV não
// escreve o alerta (docs/decisions/001).

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@^0.132";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODELO = "claude-opus-5-5";
// ponytail: janela fixa de 90 dias no prompt; resumir por período quando o volume passar de centenas por mês.
const JANELA_DIAS = 90;

type Sessao = { respondido_em: string; created_at: string; mentor: string; nota: number; comentario: string | null;
  mentorado_id: string | null; nome_informado: string | null; mentorados: { nome: string } | null };
type Experiencia = { respondido_em: string; created_at: string; nota: number; geral: string | null;
  itens: Record<string, string>; clareza: string | null; textos: Record<string, string> };
type Alerta = { severidade: "alta" | "media" | "baixa"; tipo: "mentorado" | "mentor" | "mentoria";
  mentor: string | null; mentorado: string | null; titulo: string; detalhe: string; evidencia: string; acao_sugerida: string };
type LeituraMentor = { mentor: string; leitura: string; pros: string[]; contras: string[]; pauta: string[] };
type LeituraMentorado = { mentorado_id: string | null; mentorado: string; mentor: string; risco: "alto" | "medio" | "baixo";
  leitura: string; pros: string[]; contras: string[]; pauta: string[]; acao_sugerida: string };
type Analise = { resumo: string; alertas: Alerta[]; mentores: LeituraMentor[]; mentorados: LeituraMentorado[] };

const anulavel = { anyOf: [{ type: "string" }, { type: "null" }] };
const textos = { type: "array", items: { type: "string" } };
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["resumo", "alertas", "mentores", "mentorados"],
  properties: {
    resumo: { type: "string" },
    mentores: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["mentor", "leitura", "pros", "contras", "pauta"],
      properties: { mentor: { type: "string" }, leitura: { type: "string" }, pros: textos, contras: textos, pauta: textos },
    } },
    mentorados: { type: "array", items: {
      type: "object", additionalProperties: false,
      required: ["mentorado_id", "mentorado", "mentor", "risco", "leitura", "pros", "contras", "pauta", "acao_sugerida"],
      properties: { mentorado_id: anulavel, mentorado: { type: "string" }, mentor: { type: "string" },
        risco: { type: "string", enum: ["alto", "medio", "baixo"] }, leitura: { type: "string" },
        pros: textos, contras: textos, pauta: textos, acao_sugerida: { type: "string" } },
    } },
    alertas: { type: "array", items: {
      type: "object", additionalProperties: false,
      required: ["severidade", "tipo", "mentor", "mentorado", "titulo", "detalhe", "evidencia", "acao_sugerida"],
      properties: {
        severidade: { type: "string", enum: ["alta", "media", "baixa"] },
        tipo: { type: "string", enum: ["mentorado", "mentor", "mentoria"] },
        mentor: anulavel, mentorado: anulavel,
        titulo: { type: "string" }, detalhe: { type: "string" },
        evidencia: { type: "string" }, acao_sugerida: { type: "string" },
      },
    } },
  },
};

const SISTEMA = `Você é o analista de experiência da Mentoria Elite 3D (mentoria de negócios de impressão 3D: lojas em marketplace, feiras, produto). Quem lê é a gestão da mentoria (admin e diretoria), não os mentores.

Você recebe duas pesquisas:
1. NPS da sessão: depois de cada sessão, o mentorado dá nota de 1 a 10 ao mentor que o atendeu e comenta. Identificada (mentorado e mentor).
2. Pesquisa de Experiência: anônima, sobre a mentoria como um todo — nota de recomendação, satisfação geral, grade de 10 itens (Muito ruim a Excelente), clareza dos próximos passos e perguntas abertas. Nunca tente descobrir quem respondeu.

Escreva em português do Brasil, direto, sem jargão.

"resumo": 3 a 5 frases sobre o estado atual — o que melhorou ou piorou, o tema que mais aparece, e o que merece atenção primeiro. Cite números só se eles estiverem nos dados.

"alertas": só o que pede ação da gestão. Cada alerta tem evidência literal (trecho copiado de uma resposta, ou o número exato dos dados) e uma ação concreta. Exemplos do que vira alerta:
- mentorado com nota de sessão até 6, ou que caiu 3+ pontos em relação à sessão anterior dele (tipo "mentorado", com mentor e mentorado preenchidos);
- comentário de sessão com nota alta mas texto de insatisfação (contradição entre nota e texto);
- mentor cuja média caiu ou que concentra críticas (tipo "mentor");
- tema que aparece em 2+ respostas da Pesquisa de Experiência, ou item da grade com média baixa (tipo "mentoria", mentor e mentorado nulos).
O que NÃO vira alerta: elogio, nota 9-10 sem crítica no texto, e uma única resposta anônima sem padrão (cite-a no resumo, não como alerta). Se nada pede ação, devolva "alertas": [].
Severidade: "alta" = risco de perder o mentorado ou problema que se repete; "media" = tendência a acompanhar; "baixa" = melhoria pontual.

Leituras individuais ("mentores" e "mentorados"): a gestão vai abrir cada uma numa conversa com a própria pessoa, então escreva algo que possa ser lido junto com ela — respeitoso, específico e equilibrado, sem rótulo ("problemático", "fraco") e sem nada que exponha outro mentorado. Cada item de "pros" e "contras" é uma frase curta com a evidência entre parênteses (nota, data ou trecho literal do comentário); sem base nos dados, lista vazia — nunca invente para equilibrar.
- "pros": o que está indo bem — elogios recebidos, evolução da nota, constância, conquistas citadas no comentário.
- "contras": o que merece atenção — queda de nota, crítica, frustração, sessões que sumiram, saída da rota que o próprio comentário indica.
- "pauta": 2 a 4 perguntas abertas para conduzir a conversa com essa pessoa a partir dos prós e contras (ex.: "O que mudou entre a sessão de 12/09 e a de 26/09?").

"mentores": uma entrada para CADA mentor que aparece em "por_mentor", com o nome exatamente como nos dados. "leitura": 2 a 3 frases sobre como os mentorados percebem as sessões dele e a tendência da nota. Não atribua a um mentor nada da Pesquisa de Experiência: ela é anônima e não diz quem foi o mentor.
"mentorados": uma entrada para CADA mentorado de "por_mentorado", copiando "mentorado_id" e o nome exatamente como nos dados ("mentor" = o da sessão mais recente). "risco": "alto" se a última nota for até 6, se caiu 3+ pontos ou se o texto mostra frustração ou intenção de sair; "medio" se a nota for 7-8 ou houver crítica pontual; "baixo" se as notas forem 9-10 sem crítica. "leitura": 1 a 2 frases sobre a jornada dele. "acao_sugerida": o próximo passo concreto para o mentor ou o CS; para risco baixo, algo simples como manter o ritmo ou pedir depoimento.
Respostas marcadas como novas são as que chegaram depois da última análise: priorize-as, mas use o histórico para achar tendência. Não repita um alerta da análise anterior se nada novo o reforçou.`;

function resposta(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const nps = (notas: number[]) => notas.length
  ? Math.round(100 * (notas.filter((n) => n >= 9).length - notas.filter((n) => n <= 6).length) / notas.length)
  : null;
const media = (v: number[]) => v.length ? Math.round(10 * v.reduce((a, b) => a + b, 0) / v.length) / 10 : null;
const NIVEL: Record<string, number> = { "Muito ruim": 0, "Ruim": 25, "Regular": 50, "Bom": 75, "Excelente": 100 };

function montarDados(sessoes: Sessao[], exps: Experiencia[], desde: string | null, anterior: Analise | null) {
  const nova = (created_at: string) => !desde || created_at > desde;
  const porMentor: Record<string, number[]> = {};
  for (const s of sessoes) (porMentor[s.mentor] ??= []).push(s.nota);
  // Mentorado sem vínculo com a ficha é agrupado pelo nome digitado (sem id).
  const porMentorado = new Map<string, { mentorado_id: string | null; mentorado: string; sessoes: { data: string; mentor: string; nota: number }[] }>();
  for (const s of sessoes) {
    const nome = s.mentorados?.nome ?? s.nome_informado ?? "—";
    const chave = s.mentorado_id ?? `nome:${nome.toLowerCase()}`;
    if (!porMentorado.has(chave)) porMentorado.set(chave, { mentorado_id: s.mentorado_id, mentorado: nome, sessoes: [] });
    porMentorado.get(chave)!.sessoes.push({ data: s.respondido_em.slice(0, 10), mentor: s.mentor, nota: s.nota });
  }
  const itens: Record<string, number[]> = {};
  for (const e of exps) for (const [item, nivel] of Object.entries(e.itens)) {
    if (nivel in NIVEL) (itens[item] ??= []).push(NIVEL[nivel]);
  }
  return {
    janela_dias: JANELA_DIAS,
    metricas: {
      sessao: { respostas: sessoes.length, nps: nps(sessoes.map((s) => s.nota)), media: media(sessoes.map((s) => s.nota)),
        por_mentor: Object.fromEntries(Object.entries(porMentor).map(([m, n]) => [m, { respostas: n.length, nps: nps(n), media: media(n) }])) },
      experiencia: { respostas: exps.length, nps: nps(exps.map((e) => e.nota)),
        indice_0_100_por_item: Object.fromEntries(Object.entries(itens).map(([i, v]) => [i, media(v)])) },
    },
    por_mentorado: [...porMentorado.values()],
    nps_sessoes: sessoes.map((s) => ({ nova: nova(s.created_at), data: s.respondido_em.slice(0, 10), mentor: s.mentor,
      mentorado_id: s.mentorado_id, mentorado: s.mentorados?.nome ?? s.nome_informado ?? "—", nota: s.nota, comentario: s.comentario ?? "" })),
    experiencia: exps.map((e) => ({ nova: nova(e.created_at), data: e.respondido_em.slice(0, 10), nota: e.nota,
      geral: e.geral, clareza_proximos_passos: e.clareza, grade: e.itens, respostas_abertas: e.textos })),
    analise_anterior: anterior,
  };
}

function validar(v: unknown, idsConhecidos: Set<string>): Analise {
  const o = v as Analise;
  if (!o || typeof o.resumo !== "string" || !o.resumo.trim() || !Array.isArray(o.alertas)
    || !Array.isArray(o.mentores) || !Array.isArray(o.mentorados)) throw new Error("análise fora do schema");
  // Um id inventado viraria link para uma ficha errada: só passa id que veio dos dados.
  for (const m of o.mentorados) {
    if (m.mentorado_id !== null && !idsConhecidos.has(m.mentorado_id)) throw new Error(`mentorado_id desconhecido: ${m.mentorado_id}`);
    if (!["alto", "medio", "baixo"].includes(m.risco)) throw new Error(`risco fora do schema: ${m.risco}`);
  }
  for (const a of o.alertas) {
    if (!["alta", "media", "baixa"].includes(a.severidade) || !["mentorado", "mentor", "mentoria"].includes(a.tipo)
      || !a.titulo || !a.evidencia) throw new Error(`alerta fora do schema: ${JSON.stringify(a).slice(0, 200)}`);
  }
  return o;
}

Deno.serve(async () => {
  if (!ANTHROPIC_KEY) return resposta({ ok: false, error: "ANTHROPIC_API_KEY é obrigatória" }, 500);
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const desdeJanela = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString();

    const [ses, exp, ult] = await Promise.all([
      db.from("nps_respostas").select("respondido_em,created_at,mentor,nota,comentario,mentorado_id,nome_informado,mentorados(nome)")
        .gte("respondido_em", desdeJanela).order("respondido_em"),
      db.from("experiencia_respostas").select("respondido_em,created_at,nota,geral,itens,clareza,textos")
        .gte("respondido_em", desdeJanela).order("respondido_em"),
      db.from("nps_analises").select("dados_ate,resumo,alertas,mentores,mentorados").order("gerado_em", { ascending: false }).limit(1).maybeSingle(),
    ]);
    for (const r of [ses, exp, ult]) if (r.error) throw new Error(`leitura: ${r.error.message}`);
    const sessoes = (ses.data ?? []) as unknown as Sessao[];
    const exps = (exp.data ?? []) as Experiencia[];
    const ultima = ult.data as (Analise & { dados_ate: string }) | null;

    // A marca d'água olha a tabela inteira, não só a janela: resposta antiga
    // reimportada não conta como novidade porque o upsert preserva created_at.
    const [mS, mE] = await Promise.all([
      db.from("nps_respostas").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("experiencia_respostas").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    for (const r of [mS, mE]) if (r.error) throw new Error(`marca d'água: ${r.error.message}`);
    const dadosAte = [mS.data?.created_at, mE.data?.created_at].filter(Boolean).sort().pop() as string | undefined;
    if (!dadosAte) return resposta({ ok: true, pulou: "nenhuma resposta ainda" });
    const desde = ultima ? new Date(ultima.dados_ate).toISOString() : null;
    if (desde && new Date(dadosAte).toISOString() <= desde) {
      return resposta({ ok: true, pulou: "sem resposta nova desde a última análise", dados_ate: desde });
    }

    const dados = montarDados(sessoes, exps, desde, ultima ? { resumo: ultima.resumo, alertas: ultima.alertas, mentores: ultima.mentores, mentorados: ultima.mentorados } : null);
    const claude = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const msg = await claude.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
      system: SISTEMA,
      messages: [{ role: "user", content: `Dados das pesquisas (JSON):\n${JSON.stringify(dados)}` }],
    });
    if (msg.stop_reason === "refusal") throw new Error(`Claude recusou: ${JSON.stringify(msg.stop_details)}`);
    if (msg.stop_reason === "max_tokens") throw new Error("Claude parou em max_tokens");
    const texto = msg.content.flatMap((b) => b.type === "text" ? [b.text] : []).join("");
    const ids = new Set(sessoes.flatMap((x) => x.mentorado_id ? [x.mentorado_id] : []));
    const analise = validar(JSON.parse(texto), ids);

    const { error } = await db.from("nps_analises").insert({
      modelo: msg.model, dados_ate: dadosAte, respostas: sessoes.length + exps.length,
      resumo: analise.resumo, alertas: analise.alertas, mentores: analise.mentores, mentorados: analise.mentorados,
    });
    if (error) throw new Error(`insert nps_analises: ${error.message}`);
    return resposta({ ok: true, alertas: analise.alertas.length, respostas: sessoes.length + exps.length, modelo: msg.model });
  } catch (e) {
    console.error("[nps-analista]", e);
    return resposta({ ok: false, error: String(e) }, 500);
  }
});
