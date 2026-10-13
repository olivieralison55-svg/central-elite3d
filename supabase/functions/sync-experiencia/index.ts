// sync-experiencia — traz a Pesquisa de Experiência para `experiencia_respostas`.
//
// Lê o webhook do workflow n8n "[Central Elite3D] Experiência - planilha ->
// sync-experiencia", que exporta a planilha do Forms pelo Drive, e grava com
// upsert em `origem_id` (rodar de novo atualiza, não duplica). A pesquisa é
// anônima: não há vínculo com mentorado nem mentor.
//
// Falha fechada: sem URL ou token do webhook no ambiente, nada é chamado; uma
// resposta fora do formato derruba a rodada inteira antes de gravar.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = Deno.env.get("EXPERIENCIA_WEBHOOK_URL") ?? "";
const WEBHOOK_TOKEN = Deno.env.get("EXPERIENCIA_WEBHOOK_TOKEN") ?? "";

type Linha = {
  origem_id: string; respondido_em: string; nota: number; geral: string;
  itens: Record<string, string>; clareza: string; textos: Record<string, string>;
};

function resposta(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const ehTexto = (v: unknown): v is string => typeof v === "string";
const ehMapaDeTexto = (v: unknown): v is Record<string, string> =>
  !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every(ehTexto);

function validar(r: unknown, i: number): Linha {
  const o = (r ?? {}) as Record<string, unknown>;
  const erro = (campo: string) => new Error(`resposta ${i}: ${campo} inválido`);
  if (!ehTexto(o.id) || !o.id.startsWith("sheet:")) throw erro("id");
  if (!ehTexto(o.respondido_em) || Number.isNaN(Date.parse(o.respondido_em))) throw erro("respondido_em");
  if (typeof o.nota !== "number" || !Number.isInteger(o.nota) || o.nota < 0 || o.nota > 10) throw erro("nota");
  if (!ehTexto(o.geral) || !ehTexto(o.clareza)) throw erro("geral/clareza");
  if (!ehMapaDeTexto(o.itens) || !ehMapaDeTexto(o.textos)) throw erro("itens/textos");
  return { origem_id: o.id, respondido_em: o.respondido_em, nota: o.nota, geral: o.geral,
    itens: o.itens, clareza: o.clareza, textos: o.textos };
}

Deno.serve(async () => {
  if (!WEBHOOK_URL || !WEBHOOK_TOKEN) {
    return resposta({ ok: false, error: "EXPERIENCIA_WEBHOOK_URL e EXPERIENCIA_WEBHOOK_TOKEN sao obrigatorios" }, 500);
  }
  try {
    const r = await fetch(WEBHOOK_URL, { headers: { "X-Central-Token": WEBHOOK_TOKEN } });
    if (!r.ok) return resposta({ ok: false, error: `n8n respondeu ${r.status}` }, 502);
    const corpo: unknown = await r.json();
    const lista = (Array.isArray(corpo) ? corpo[0] : corpo) as { respostas?: unknown } | null;
    if (!lista || !Array.isArray(lista.respostas) || !lista.respostas.length) {
      return resposta({ ok: false, error: "payload sem respostas; nada foi gravado" }, 502);
    }
    const linhas = lista.respostas.map(validar);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await db.from("experiencia_respostas").upsert(linhas, { onConflict: "origem_id" });
    if (error) throw new Error(`upsert experiencia_respostas: ${error.message}`);
    return resposta({ ok: true, gravadas: linhas.length });
  } catch (e) {
    console.error("[sync-experiencia]", e);
    return resposta({ ok: false, error: String(e) }, 500);
  }
});
