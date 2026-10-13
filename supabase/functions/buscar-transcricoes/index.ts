// buscar-transcricoes — busca diária dos docs "Anotações do Gemini" no Drive.
//
// Pergunta ao workflow n8n "[Central Elite3D] Transcrições - Drive ->
// sync-transcricoes" quais docs mudaram desde o mais novo já visto (nunca antes
// da janela de JANELA_DIAS) e enfileira em `transcricoes` como pendente. Quem
// lê, filtra e escreve o dossiê é `sync-transcricoes`. Ver docs/decisions/003.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { dataDoTitulo, JANELA_DIAS } from "../sync-transcricoes/logica.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = Deno.env.get("TRANSCRICOES_WEBHOOK_URL") ?? "";
// Same n8n header credential as sync-experiencia: same caller, same trust.
const WEBHOOK_TOKEN = Deno.env.get("EXPERIENCIA_WEBHOOK_TOKEN") ?? "";

type Doc = { id: string; nome: string; criado_em: string; modificado_em: string };

function resposta(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const ehDoc = (d: unknown): d is Doc => {
  const o = (d ?? {}) as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.nome === "string"
    && typeof o.criado_em === "string" && typeof o.modificado_em === "string";
};

Deno.serve(async () => {
  if (!WEBHOOK_URL || !WEBHOOK_TOKEN) {
    return resposta({ ok: false, error: "TRANSCRICOES_WEBHOOK_URL e EXPERIENCIA_WEBHOOK_TOKEN são obrigatórias" }, 500);
  }
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: marca, error: e0 } = await db.from("transcricoes").select("drive_modificado_em")
      .order("drive_modificado_em", { ascending: false }).limit(1).maybeSingle();
    if (e0) throw new Error(`marca d'água: ${e0.message}`);
    const corte = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString();
    const marcaIso = marca ? new Date(marca.drive_modificado_em).toISOString() : corte;
    const desde = (marcaIso > corte ? marcaIso : corte).slice(0, 19);

    const r = await fetch(`${WEBHOOK_URL}?${new URLSearchParams({ desde })}`, { headers: { "X-Central-Token": WEBHOOK_TOKEN } });
    if (!r.ok) return resposta({ ok: false, error: `n8n respondeu ${r.status}` }, 502);
    const corpo: unknown = await r.json();
    const lista = (Array.isArray(corpo) ? corpo[0] : corpo) as { docs?: unknown } | null;
    if (!Array.isArray(lista?.docs)) return resposta({ ok: false, error: "n8n devolveu lista sem docs" }, 502);
    const docs = lista.docs.filter(ehDoc);
    if (docs.length !== lista.docs.length) throw new Error(`${lista.docs.length - docs.length} docs fora do formato`);

    const novos = docs
      .map((d) => ({ drive_id: d.id, titulo: d.nome.trim(), drive_modificado_em: d.modificado_em,
        realizada_em: new Date(dataDoTitulo(d.nome) ?? d.criado_em).toISOString() }))
      .filter((d) => d.realizada_em >= corte);
    // ponytail: a doc edited after being processed is not reprocessed; reset its status to 'pendente' by hand if needed.
    if (novos.length) {
      const { error } = await db.from("transcricoes").upsert(novos, { onConflict: "drive_id", ignoreDuplicates: true });
      if (error) throw new Error(`enfileirar: ${error.message}`);
    }
    return resposta({ ok: true, desde, listadas: docs.length, enfileiradas: novos.length });
  } catch (e) {
    console.error("[buscar-transcricoes]", e);
    return resposta({ ok: false, error: String(e) }, 500);
  }
});
