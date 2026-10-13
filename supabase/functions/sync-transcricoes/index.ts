// sync-transcricoes — transcrições das calls -> dossiê de evolução do mentorado.
//
// A fila `transcricoes` é alimentada uma vez por dia por `buscar-transcricoes`.
// Esta função processa até LOTE pendentes, da mais antiga para a mais nova (o dossiê
//    evolui em ordem): baixa o texto, casa com mentorado e sessão, passa pela
//    triagem determinística, pelo Jev (TypeSafe System One) e só então pelo
//    Claude, que também pode rejeitar. Aceita -> reescreve `mentorado_dossies`.
//
// Decisão e calibragem do filtro em docs/decisions/003.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@^0.132";
import {
  acharMentorado, ehGrupo, JANELA_DIAS, type Jev, type Mentorado, parseEtapa, separar, triagem, vereditoJev,
} from "./logica.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const JEV_KEY = Deno.env.get("JEV_API_KEY") ?? "";
const WEBHOOK_URL = Deno.env.get("TRANSCRICOES_WEBHOOK_URL") ?? "";
// Same n8n header credential as sync-experiencia: same caller, same trust.
const WEBHOOK_TOKEN = Deno.env.get("EXPERIENCIA_WEBHOOK_TOKEN") ?? "";
const MODELO = "claude-opus-5-5";
// ponytail: 2 per run keeps the run under the 150 s wall clock (one Claude call ~40 s); raise when calls get faster.
const LOTE = 2;
const MAX_TENTATIVAS = 3;
// Jev's request budget is 64k tokens (~3.3 chars/token in pt-BR transcripts).
const JEV_MAX_CHARS = 180_000;
const CLAUDE_MAX_CHARS = 200_000;

const JEV_QUESTIONS = {
  qualidade: {
    type: "choice",
    instructions: "Transcrição automática de uma call de mentoria de negócios (impressão 3D, vendas em marketplace). Ela é boa o bastante para registrar o que foi discutido com o mentorado?",
    criteria: {
      utilizavel: "conversa legível entre mentor e mentorado, com assunto de negócio reconhecível mesmo com erros de reconhecimento de fala pontuais",
      suja: "texto ilegível: frases sem sentido, palavras repetidas em loop, idioma trocado, alucinação do reconhecimento de fala, só ruído ou bate-papo sem conteúdo",
      incompleta: "a call acaba logo no começo, só cumprimentos ou teste de áudio, sem a mentoria em si",
    },
  },
  conteudo: { type: "noul", instructions: "Há orientação de negócio concreta para o mentorado (produto, preço, anúncio, marketplace, estoque, vendas, metas)" },
};

const textos = { type: "array", items: { type: "string" } };
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["aceitar", "motivo_rejeicao", "resumo_call", "dossie"],
  properties: {
    aceitar: { type: "boolean" },
    motivo_rejeicao: { anyOf: [{ type: "string" }, { type: "null" }] },
    resumo_call: { type: "string" },
    dossie: {
      type: "object", additionalProperties: false,
      required: ["perfil", "negocio", "objetivos", "evolucao", "pendencias", "pontos_de_atencao", "ultima_mentoria"],
      properties: {
        perfil: { type: "string" },
        negocio: { type: "string" },
        objetivos: textos,
        evolucao: { type: "array", items: {
          type: "object", additionalProperties: false, required: ["data", "etapa", "marco"],
          properties: { data: { type: "string" }, etapa: { type: "string" }, marco: { type: "string" } },
        } },
        pendencias: textos,
        pontos_de_atencao: textos,
        ultima_mentoria: {
          type: "object", additionalProperties: false,
          required: ["data", "etapa", "mentor", "tema", "discutido", "decisoes", "proximos_passos", "confiabilidade"],
          properties: {
            data: { type: "string" }, etapa: { type: "string" }, mentor: { type: "string" }, tema: { type: "string" },
            discutido: textos, decisoes: textos, proximos_passos: textos,
            confiabilidade: { type: "string", enum: ["alta", "media", "baixa"] },
          },
        },
      },
    },
  },
};
type Dossie = {
  perfil: string; negocio: string; objetivos: string[]; evolucao: { data: string; etapa: string; marco: string }[];
  pendencias: string[]; pontos_de_atencao: string[];
  ultima_mentoria: { data: string; etapa: string; mentor: string; tema: string; discutido: string[]; decisoes: string[];
    proximos_passos: string[]; confiabilidade: "alta" | "media" | "baixa" };
};
type Saida = { aceitar: boolean; motivo_rejeicao: string | null; resumo_call: string; dossie: Dossie };

const SISTEMA = `Você mantém o dossiê de evolução de um mentorado da Mentoria Elite 3D (mentoria de negócios de impressão 3D: lojas em marketplace, feiras, produto). O dossiê é lido por outros agentes de IA e pela gestão antes de cada contato com o mentorado, então ele precisa ser fiel ao que foi dito, e nunca inventado.

Você recebe o dossiê atual (ou null, se for a primeira call), os metadados da call, as anotações automáticas do Gemini e a transcrição automática.

QUALIDADE DA FONTE. A transcrição é reconhecimento de fala automático: espere palavras trocadas, nomes errados, frases cortadas e falas atribuídas à pessoa errada. Ela já passou por um filtro, mas o filtro erra. Regras:
- Corrija erro óbvio de reconhecimento só quando o contexto não deixa dúvida (ex.: "xopi" -> Shopee). Na dúvida, deixe de fora.
- Número, preço, meta, prazo ou nome de produto só entram se aparecem de forma clara e consistente. Número ilegível ou contraditório não entra.
- As anotações do Gemini também são geradas por IA: use-as como índice, mas o que contradiz a transcrição perde.
- Bate-papo pessoal (família, saúde, vida fora do negócio) não entra no dossiê.
- REJEITE ("aceitar": false, com "motivo_rejeicao" curto) se a transcrição não permite dizer com segurança o que foi orientado: texto majoritariamente sem sentido, call que é de outra pessoa que não o mentorado indicado, call que não é mentoria (teste, reunião interna, handoff comercial), ou conteúdo só de cumprimentos. Ao rejeitar, devolva o dossiê atual sem mudança (ou um dossiê vazio de strings e listas vazias, se não houver).
- "confiabilidade" da última mentoria: "alta" se a conversa é clara; "media" se há trechos ilegíveis, mas o essencial dá para entender; "baixa" se só parte da call deu para aproveitar.

COMO ATUALIZAR. Reescreva o dossiê inteiro incorporando a call nova, em português do Brasil, direto, sem jargão:
- "perfil": 2 a 3 frases sobre quem é o mentorado e o momento dele na mentoria.
- "negocio": o que vende, onde vende, estrutura (impressoras, equipe), números relevantes ditos com clareza.
- "objetivos": metas declaradas pelo mentorado, atualizadas (remova as abandonadas, marque as atingidas no "evolucao").
- "evolucao": linha do tempo, um item por call aceita ou marco relevante, do mais antigo para o mais novo; preserve os itens anteriores e acrescente o da call nova. Datas em AAAA-MM-DD. No máximo 30 itens: se passar, funda os mais antigos.
- "pendencias": próximos passos ainda em aberto, juntando os de calls anteriores que não foram citados como feitos. O que a call nova mostra como feito sai daqui e vira marco na evolução.
- "pontos_de_atencao": risco de desistência, dificuldade recorrente, frustração, promessa não cumprida. Lista vazia se não houver.
- "ultima_mentoria": a call recebida: data, etapa e mentor como nos metadados, "tema" em uma frase, o que foi discutido, as decisões e os próximos passos (com responsável, quando dito).
"resumo_call": 2 a 3 frases sobre esta call, para o histórico.
Se os metadados dizem que esta call é MAIS ANTIGA que a última mentoria do dossiê, incorpore-a na evolução e nas pendências, mas devolva em "ultima_mentoria" a que já estava no dossiê.`;

function resposta(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function n8n(params: Record<string, string>): Promise<unknown> {
  const r = await fetch(`${WEBHOOK_URL}?${new URLSearchParams(params)}`, { headers: { "X-Central-Token": WEBHOOK_TOKEN } });
  if (!r.ok) throw new Error(`n8n respondeu ${r.status}`);
  const corpo: unknown = await r.json();
  return Array.isArray(corpo) ? corpo[0] : corpo;
}

async function perguntarJev(transcricao: string): Promise<Jev> {
  const r = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { "Authorization": `Bearer ${JEV_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ state: transcricao.slice(0, JEV_MAX_CHARS), model: "jev-latest", questions: JEV_QUESTIONS }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`Jev respondeu ${r.status}`);
  const a = (await r.json() as { answers?: Record<string, unknown> }).answers as Jev | undefined;
  if (!a?.qualidade?.probabilities || typeof a.conteudo?.noul !== "number") throw new Error("Jev fora do contrato");
  return a;
}

function validar(o: Saida): Saida {
  const d = o?.dossie;
  if (typeof o?.aceitar !== "boolean" || !d || !Array.isArray(d.evolucao) || !d.ultima_mentoria
    || !Array.isArray(d.pendencias) || !Array.isArray(d.objetivos)) throw new Error("saída do Claude fora do schema");
  if (!o.aceitar && !o.motivo_rejeicao) throw new Error("rejeição sem motivo");
  return o;
}

const lista = (titulo: string, itens: string[]) => itens.length ? `\n## ${titulo}\n${itens.map((i) => `- ${i}`).join("\n")}\n` : "";
export function markdown(nome: string, d: Dossie): string {
  const u = d.ultima_mentoria;
  return `# Dossiê — ${nome}

${d.perfil}

## Negócio
${d.negocio}
${lista("Objetivos", d.objetivos)}
## Última mentoria — ${u.data} · ${u.etapa} · ${u.mentor}
**Tema:** ${u.tema}
**Confiabilidade da transcrição:** ${u.confiabilidade}
${lista("Discutido", u.discutido)}${lista("Decisões", u.decisoes)}${lista("Próximos passos", u.proximos_passos)}${lista("Pendências em aberto", d.pendencias)}${lista("Pontos de atenção", d.pontos_de_atencao)}
## Evolução
${d.evolucao.map((e) => `- ${e.data} · ${e.etapa}: ${e.marco}`).join("\n")}
`;
}

type Linha = { drive_id: string; titulo: string; realizada_em: string; tentativas: number };

async function processar(db: SupabaseClient, claude: Anthropic, t: Linha, mentorados: Mentorado[]) {
  const fim = (campos: Record<string, unknown>) =>
    db.from("transcricoes").update({ ...campos, processado_em: new Date().toISOString() }).eq("drive_id", t.drive_id);

  if (ehGrupo(t.titulo)) return fim({ status: "grupo", motivo: "encontro em grupo: não vai para dossiê individual" });

  const doc = await n8n({ id: t.drive_id }) as { texto?: unknown };
  if (typeof doc?.texto !== "string") throw new Error("n8n devolveu doc sem texto");
  const { notas, transcricao } = separar(doc.texto);

  const m = acharMentorado(notas.slice(0, 1500), t.titulo, mentorados);
  if (!m) return fim({ status: "sem_vinculo", motivo: "não casou com mentorado (e-mail do convite nem nome no título)" });

  const dia = t.realizada_em.slice(0, 10);
  const { data: ses } = await db.from("sessoes").select("id,mentor,etapa").eq("mentorado_id", m.id).eq("data", dia).limit(1).maybeSingle();
  const etapa = ses?.etapa ?? parseEtapa(t.titulo) ?? "—";
  const mentor = ses?.mentor ?? "—";
  const vinculo = { mentorado_id: m.id, sessao_id: ses?.id ?? null, etapa, mentor };

  const sujo = triagem(transcricao);
  if (sujo) return fim({ ...vinculo, status: "rejeitada", motivo: sujo });

  const jev = await perguntarJev(transcricao!);
  const reprovada = vereditoJev(jev);
  if (reprovada) return fim({ ...vinculo, status: "rejeitada", motivo: reprovada, jev });

  const { data, error: e1 } = await db.from("mentorado_dossies")
    .select("estrutura,ultima_mentoria_em,transcricoes_lidas").eq("mentorado_id", m.id).maybeSingle();
  if (e1) throw new Error(`leitura dossiê: ${e1.message}`);
  const atual = data as { estrutura: Dossie; ultima_mentoria_em: string; transcricoes_lidas: number } | null;
  const maisRecente = !atual || t.realizada_em >= new Date(atual.ultima_mentoria_em).toISOString();

  const msg = await claude.beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SISTEMA,
    messages: [{ role: "user", content: JSON.stringify({
      mentorado: m.nome,
      call: { data: dia, etapa, mentor, titulo: t.titulo, mais_recente_que_o_dossie: maisRecente },
      dossie_atual: atual?.estrutura ?? null,
      anotacoes_gemini: notas,
      transcricao: transcricao!.slice(0, CLAUDE_MAX_CHARS),
    }) }],
  });
  if (msg.stop_reason === "refusal") throw new Error(`Claude recusou: ${JSON.stringify(msg.stop_details)}`);
  if (msg.stop_reason === "max_tokens") throw new Error("Claude parou em max_tokens");
  const saida = validar(JSON.parse(msg.content.flatMap((b) => b.type === "text" ? [b.text] : []).join("")));

  if (!saida.aceitar) return fim({ ...vinculo, status: "rejeitada", motivo: `Claude: ${saida.motivo_rejeicao}`, jev });

  const { error: e2 } = await db.from("mentorado_dossies").upsert({
    mentorado_id: m.id,
    documento: markdown(m.nome, saida.dossie),
    estrutura: saida.dossie,
    ultima_mentoria_em: maisRecente ? t.realizada_em : atual!.ultima_mentoria_em,
    ultima_transcricao: t.drive_id,
    transcricoes_lidas: (atual?.transcricoes_lidas ?? 0) + 1,
    modelo: msg.model,
    atualizado_em: new Date().toISOString(),
  });
  if (e2) throw new Error(`upsert dossiê: ${e2.message}`);
  return fim({ ...vinculo, status: "aceita", motivo: null, jev, resumo: saida.resumo_call });
}

Deno.serve(async () => {
  if (!WEBHOOK_URL || !WEBHOOK_TOKEN || !JEV_KEY || !ANTHROPIC_KEY) {
    return resposta({ ok: false, error: "TRANSCRICOES_WEBHOOK_URL, EXPERIENCIA_WEBHOOK_TOKEN, JEV_API_KEY e ANTHROPIC_API_KEY são obrigatórias" }, 500);
  }
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const corte = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString();

    // A fila é alimentada uma vez por dia pela função buscar-transcricoes.
    // Processa um lote, do mais antigo para o mais novo.
    const { data: fila, error: e1 } = await db.from("transcricoes").select("drive_id,titulo,realizada_em,tentativas")
      .in("status", ["pendente", "erro"]).lt("tentativas", MAX_TENTATIVAS).gte("realizada_em", corte).order("realizada_em").limit(LOTE);
    if (e1) throw new Error(`fila: ${e1.message}`);
    if (!fila?.length) return resposta({ ok: true, processadas: 0 });

    const { data: ms, error: e2 } = await db.from("mentorados").select("id,nome,email");
    if (e2) throw new Error(`mentorados: ${e2.message}`);
    const claude = new Anthropic({ apiKey: ANTHROPIC_KEY });

    const resultado: Record<string, string> = {};
    for (const t of fila as Linha[]) {
      try {
        const { error } = await processar(db, claude, t, ms as Mentorado[]);
        if (error) throw new Error(`gravar status: ${error.message}`);
        resultado[t.drive_id] = "ok";
      } catch (e) {
        console.error("[sync-transcricoes]", t.drive_id, e);
        await db.from("transcricoes").update({ status: "erro", motivo: String(e).slice(0, 500), tentativas: t.tentativas + 1 })
          .eq("drive_id", t.drive_id);
        resultado[t.drive_id] = String(e);
      }
    }
    return resposta({ ok: true, processadas: fila.length, resultado });
  } catch (e) {
    console.error("[sync-transcricoes]", e);
    return resposta({ ok: false, error: String(e) }, 500);
  }
});
