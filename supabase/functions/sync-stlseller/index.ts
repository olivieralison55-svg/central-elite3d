// sync-stlseller — traz a foto do STLSeller para as tabelas stlseller_*.
//
// Lê o webhook do workflow n8n "GET - SELLERS" (BigQuery `stlseller_raw`, só
// leitura) e entrega o payload a `stlseller_sincronizar`, que grava
// mentorados, pedidos por marketplace e produtos vendidos numa transação só e
// recusa payload sem mentorados antes de apagar qualquer coisa. O mapeamento
// de JSON para colunas vive lá, não aqui.
//
// Falha fechada: sem URL ou token do webhook no ambiente, nada é chamado.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = Deno.env.get("STLSELLER_WEBHOOK_URL") ?? "";
// Header Auth do webhook no n8n; o nome do header é o da credencial de lá.
const WEBHOOK_TOKEN = Deno.env.get("STLSELLER_WEBHOOK_TOKEN") ?? "";

function resposta(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async () => {
  if (!WEBHOOK_URL || !WEBHOOK_TOKEN) {
    return resposta({ ok: false, error: "STLSELLER_WEBHOOK_URL e STLSELLER_WEBHOOK_TOKEN sao obrigatorios" }, 500);
  }
  try {
    const r = await fetch(WEBHOOK_URL, { headers: { "X-Central-Token": WEBHOOK_TOKEN } });
    if (!r.ok) return resposta({ ok: false, error: `n8n respondeu ${r.status}` }, 502);
    const payload: unknown = await r.json();
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { mentees?: unknown }).mentees)) {
      return resposta({ ok: false, error: "payload sem a lista mentees; nada foi gravado" }, 502);
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await db.rpc("stlseller_sincronizar", { payload });
    if (error) throw new Error(`stlseller_sincronizar: ${error.message}`);
    return resposta({ ok: true, ...(data as Record<string, unknown>) });
  } catch (e) {
    console.error("[sync-stlseller]", e);
    return resposta({ ok: false, error: String(e) }, 500);
  }
});
