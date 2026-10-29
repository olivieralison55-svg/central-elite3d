// circle-presenca — presença real nas lives do Circle.
//
// Chamada pela automação do Circle "Attended live event" -> "Send webhook", uma
// vez por membro, quando a live termina. Só quem esteve na live chega aqui: a
// inscrição (RSVP) não dispara este gatilho.
//
// Corpo real (teste de 13/10/2026): {"type":"live_event_ended","data":{
// "community_id","community_member_id","event_id","space_id"}} -- sem e-mail.
// A função (1) grava o payload cru em `circle_presencas` antes de tudo, (2) acha
// o membro e o evento em qualquer profundidade e (3) busca na API admin v2 do
// Circle o e-mail do membro e o nome e o início do evento.
//
// A presença vira uma linha de `sessoes`, status Concluída, na etapa do encontro
// em grupo pelo nome do evento ("Plantão..." ou "Sessão de Implementação..."),
// casando o mentorado pelo e-mail da ficha. Idempotente por (mentorado_id,
// circle_event_id).
//
// verify_jwt FALSE: o Circle não autentica no Supabase. A procedência é o
// `?token=` da URL, comparado em tempo constante com CIRCLE_WEBHOOK_TOKEN; sem o
// secret a função falha fechada.
//
// Deploy: supabase functions deploy circle-presenca --no-verify-jwt --project-ref <ref>
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("CIRCLE_WEBHOOK_TOKEN") ?? "";
const CIRCLE_KEY = Deno.env.get("CIRCLE_API_KEY") ?? "";
const TZ = "America/Sao_Paulo";

// Mesma régua de etapas do index.html (ETAPAS_GRUPO) e de ordem dos encontros em grupo.
const ETAPAS = [
  { chave: "implementacao", etapa: "Sessão de Implementação Mensal", ordem: 91 },
  { chave: "plantao", etapa: "Plantão de Dúvida Semanal", ordem: 90 },
  { chave: "duvida", etapa: "Plantão de Dúvida Semanal", ordem: 90 },
];

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function tokenValido(recebido: string | null) {
  if (!TOKEN || !recebido) return false;
  const a = new TextEncoder().encode(recebido), b = new TextEncoder().encode(TOKEN);
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

/* Busca em profundidade o primeiro valor cujo caminho casa com o teste. */
function achar(v: unknown, casa: (caminho: string[], valor: unknown) => boolean, caminho: string[] = []): unknown {
  if (casa(caminho, v)) return v;
  if (v && typeof v === "object") {
    for (const [k, filho] of Object.entries(v as Record<string, unknown>)) {
      const r = achar(filho, casa, [...caminho, k.toLowerCase()]);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}

export function extrair(payload: unknown) {
  const membro = achar(payload, (c, v) => (c.at(-1) ?? "") === "community_member_id"
    && (typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v))));
  const email = achar(payload, (c, v) => typeof v === "string" && /email/.test(c.at(-1) ?? "") && v.includes("@"));
  const id = achar(payload, (c, v) => {
    const k = c.at(-1) ?? "", pai = c.at(-2) ?? "";
    return (typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v)))
      && (k === "event_id" || (k === "id" && /event/.test(pai)));
  });
  return { email: typeof email === "string" ? email.trim().toLowerCase() : null, eventId: id === undefined ? null : Number(id),
    membroId: membro === undefined ? null : Number(membro) };
}

export function etapaDoEvento(nome: string) {
  const n = norm(nome);
  return ETAPAS.find((e) => n.includes(e.chave)) ?? null;
}

// Nome do mentor no título ("Plantão de Dúvidas #27 - Luan"), na grafia do cadastro
// (profiles.nome_mentor, AD-013).
export function mentorDoEvento(nome: string, mentores: readonly string[]) {
  const depois = norm(nome.split(" - ").slice(1).join(" - "));
  return mentores.find((m) => depois.includes(norm(m))) ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "use POST" });
  if (!tokenValido(new URL(req.url).searchParams.get("token"))) return json(401, { erro: "token inválido" });
  let payload: unknown;
  try { payload = await req.json(); } catch { return json(400, { erro: "JSON inválido" }); }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const ext = extrair(payload);
  const eventId = ext.eventId;
  let email = ext.email;
  const { data: reg, error: errReg } = await db.from("circle_presencas")
    .insert({ payload, email, circle_event_id: eventId }).select("id").single();
  if (errReg) return json(500, { erro: `registro: ${errReg.message}` });

  // Falha de processamento fica anotada na linha crua e devolve 200: o Circle
  // não reenvia com sentido, e o payload guardado permite reprocessar.
  const falha = async (erro: string) => {
    console.error("[circle-presenca]", erro);
    await db.from("circle_presencas").update({ erro }).eq("id", reg.id);
    return json(200, { ok: false, erro });
  };
  if (!eventId) return falha("payload sem id do evento");
  if (!CIRCLE_KEY) return falha("CIRCLE_API_KEY ausente");
  const circle = (rota: string) => fetch(`https://app.circle.so/api/admin/v2/${rota}`, {
    headers: { Authorization: `Bearer ${CIRCLE_KEY}` },
  });
  if (!email && ext.membroId) {
    const rm = await circle(`community_members/${ext.membroId}`);
    if (!rm.ok) return falha(`Circle community_members/${ext.membroId}: HTTP ${rm.status}`);
    const m = await rm.json() as { email?: string };
    email = m.email?.trim().toLowerCase() || null;
    await db.from("circle_presencas").update({ email }).eq("id", reg.id);
  }
  if (!email) return falha("sem e-mail do membro (nem no payload, nem na API)");

  const res = await circle(`events/${eventId}`);
  if (!res.ok) return falha(`Circle events/${eventId}: HTTP ${res.status}`);
  const evento = await res.json() as { name?: string; starts_at?: string };
  if (!evento.name || !evento.starts_at) return falha(`evento ${eventId} sem nome ou início`);
  const etapa = etapaDoEvento(evento.name);
  if (!etapa) return falha(`evento "${evento.name}" não é plantão nem implementação`);

  const { data: ment, error: errM } = await db.from("mentorados").select("id").ilike("email", email);
  if (errM) return falha(`mentorados: ${errM.message}`);
  if (!ment || ment.length !== 1) return falha(ment?.length ? `e-mail ${email} em ${ment.length} fichas` : `nenhuma ficha com o e-mail ${email}`);

  const { data: perfis, error: errP } = await db.from("profiles")
    .select("nome_mentor").eq("role", "mentor").not("nome_mentor", "is", null);
  if (errP) return falha(`profiles: ${errP.message}`);
  const mentores = (perfis ?? []).map((p: { nome_mentor: string }) => p.nome_mentor);

  const inicio = new Date(evento.starts_at);
  const data = inicio.toLocaleDateString("sv-SE", { timeZone: TZ });
  const hora = inicio.toLocaleTimeString("en-GB", { timeZone: TZ, hour12: false });
  const { data: sessao, error: errS } = await db.from("sessoes").upsert({
    mentorado_id: ment[0].id, etapa: etapa.etapa, ordem: etapa.ordem, status: "Concluída",
    mentor: mentorDoEvento(evento.name, mentores), data, hora, circle_event_id: eventId,
  }, { onConflict: "mentorado_id,circle_event_id" }).select("id").single();
  if (errS) return falha(`sessoes: ${errS.message}`);

  await db.from("circle_presencas").update({ mentorado_id: ment[0].id, sessao_id: sessao.id, erro: null }).eq("id", reg.id);
  return json(200, { ok: true, sessao_id: sessao.id });
});
