import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN")!;
const TZ = "America/Sao_Paulo";

// Fonte de verdade para identificar o mentor: e-mail do convidado no evento.
// Comparação exata — os e-mails nao seguem padrao previsivel (contatoevxldo = Evaldo),
// entao qualquer heuristica de nome produziria atribuicao errada e silenciosa.
// ATENCAO: so entram aqui quem ATENDE a sessao. CS e observadores ficam de fora,
// senao a sessao seria creditada a quem apenas acompanhou.
const EMAIL_MENTOR: Record<string, string> = {
  "am.3d.printt@gmail.com": "Michelle",
  "contato.alvesmaker@gmail.com": "Luan",
  "contatoevxldo@gmail.com": "Evaldo",
  "mkt.martinsoliveira@gmail.com": "Diovani",
  "diovane_martins@hotmail.com": "Diovani", // legado: mantido para reconhecer eventos antigos
  "petarerp@gmail.com": "Petare",
  "sergiodink@gmail.com": "Sergio",
};

// Fallback por nome escrito no titulo/descricao. Israel e Evaldo sairam do
// projeto e nao recebem novos agendamentos, mas seguem reconheciveis caso
// aparecam em evento antigo -- tirar daqui jogaria as sessoes deles para
// "sem mentor identificado" calado.
const MENTORES: { nome: string; alias: string[] }[] = [
  { nome: "Evaldo",   alias: ["evaldo"] },
  { nome: "Luan",     alias: ["luan"] },
  { nome: "Sergio",   alias: ["sergio"] },
  { nome: "Diovani",  alias: ["diovani", "diovane"] },
  { nome: "Petare",   alias: ["petare"] },
  { nome: "Michelle", alias: ["michelle", "michele", "michelli"] },
  { nome: "Israel",   alias: ["israel"] },
];

const tzFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function paraHorarioLocal(iso: string): { data: string; hora: string } {
  const p: Record<string, string> = {};
  for (const part of tzFormatter.formatToParts(new Date(iso))) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}
function normaliza(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function parseEtapa(summary: string): { etapa: string; ordem: number } | null {
  const s = normaliza(summary);
  if (s.includes("diagnostico")) return { etapa: "Diagnóstico de Negócio", ordem: 1 };
  if (s.includes("plano de acao")) return { etapa: "Plano de Ação", ordem: 2 };
  const m = s.match(/checkup\s*(\d+)/);
  if (m) return { etapa: `Checkup ${m[1]}`, ordem: 2 + parseInt(m[1]) };
  return null;
}
function acharMentor(texto: string, attendees: { email?: string }[] = []): string | null {
  for (const a of attendees) {
    const mt = EMAIL_MENTOR[(a.email || "").trim().toLowerCase()];
    if (mt) return mt;
  }
  const s = normaliza(texto);
  for (const mt of MENTORES) if (mt.alias.some((x) => s.includes(x))) return mt.nome;
  return null;
}
function acharMentorado(summary: string, mentorados: { id: string; nome: string }[]) {
  const s = normaliza(summary);
  let melhor: { id: string; nome: string } | null = null;
  let melhorScore = 0, empate = false;
  for (const m of mentorados) {
    const palavras = normaliza(m.nome).split(/\s+/).filter((w) => w.length >= 3);
    if (!palavras.length) continue;
    const score = palavras.filter((w) => s.includes(w)).length;
    if (score > melhorScore) { melhorScore = score; melhor = m; empate = false; }
    else if (score === melhorScore && score > 0 && melhor && m.id !== melhor.id) empate = true;
  }
  return (melhorScore < 1 || empate) ? null : melhor;
}
async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN, grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Falha ao renovar token Google: " + JSON.stringify(data));
  return data.access_token as string;
}
async function fetchEvents(accessToken: string) {
  const timeMin = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("timeZone", TZ);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error("Falha ao buscar eventos: " + JSON.stringify(data));
  return data.items || [];
}

Deno.serve(async (req) => {
  try {
    const debug = new URL(req.url).searchParams.get("debug") === "1";
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: mentorados, error: merr } = await supabase.from("mentorados").select("id,nome").eq("cancelado", false);
    if (merr) throw merr;
    const accessToken = await getAccessToken();
    const events = await fetchEvents(accessToken);

    if (debug) {
      const amostra: unknown[] = [];
      for (const ev of events) {
        if (ev.status === "cancelled") continue;
        const summary = ev.summary || "";
        if (!parseEtapa(summary) || !acharMentorado(summary, mentorados || [])) continue;
        if (acharMentor(summary + " " + (ev.description || ""), ev.attendees || [])) continue;
        amostra.push({ titulo: summary, attendees: (ev.attendees || []).map((a: { email?: string }) => a.email) });
        if (amostra.length >= 10) break;
      }
      return new Response(JSON.stringify({ ok: true, modo: "debug", sem_mentor: amostra }, null, 1), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const agora = new Date();
    const agoraISO = agora.toISOString();
    let criadas = 0, atualizadas = 0, confirmacoesPendentes = 0, semMentor = 0, adotadas = 0;
    const ignoradas: string[] = [];

    for (const ev of events) {
      if (ev.status === "cancelled") continue;
      const summary = ev.summary || "";
      const etapaInfo = parseEtapa(summary);
      const mentorado = acharMentorado(summary, mentorados || []);
      if (!etapaInfo || !mentorado) { ignoradas.push(summary); continue; }
      const startDT = ev.start?.dateTime || ev.start?.date;
      if (!startDT) { ignoradas.push(summary); continue; }

      let data_: string, hora_: string | null;
      if (ev.start?.dateTime) {
        const local = paraHorarioLocal(ev.start.dateTime);
        data_ = local.data; hora_ = local.hora;
      } else { data_ = String(ev.start.date).slice(0, 10); hora_ = null; }

      const fimDT = ev.end?.dateTime || ev.end?.date || startDT;
      const jaPassou = new Date(fimDT) < agora;
      const mentor = acharMentor(summary + " " + (ev.description || ""), ev.attendees || []);
      if (!mentor) semMentor++;
      const link_meet = ev.hangoutLink || ev.location || null;

      const { data: existente } = await supabase.from("sessoes")
        .select("id,status,mentor").eq("google_event_id", ev.id).maybeSingle();

      if (existente) {
        const upd: Record<string, unknown> = { data: data_, hora: hora_, link_meet, synced_at: agoraISO };
        if (mentor) upd.mentor = mentor;
        if (jaPassou && existente.status === "Agendada") {
          upd.status = "Aguardando confirmação"; confirmacoesPendentes++;
        }
        await supabase.from("sessoes").update(upd).eq("id", existente.id);
        atualizadas++;
      } else {
        const statusInicial = jaPassou ? "Aguardando confirmação" : "Agendada";
        /* Linha registrada na mao, ainda sem evento do Calendar. Restrito a
           trilha 1:1 (ordem < 90): encontro em grupo e uma linha por
           participante com a mesma data e hora, e adotar uma delas partiria o
           encontro. limit(1) em vez de maybeSingle() porque nao existe unico em
           (mentorado_id, etapa) -- com duas linhas, maybeSingle() falha. */
        const manual = () => supabase.from("sessoes").select("id,status")
          .eq("mentorado_id", mentorado.id).is("google_event_id", null).lt("ordem", 90);

        // Passo 1: a linha da trilha que tem exatamente esta etapa.
        const p1 = await manual().eq("etapa", etapaInfo.etapa).order("id").limit(1);
        let alvo = (p1.data || [])[0] || null;

        /* Passo 2: a MESMA reuniao, ja registrada na mao com OUTRA etapa.
           Acontece quando o titulo do evento nomeia etapa diferente da que esta
           na trilha -- convite aberto como "Plano de Acao" para o que a ficha
           registrou como "Checkup 5". Sem este passo o passo 1 nao acha nada e
           o insert abaixo cria uma SEGUNDA sessao concluida no mesmo mentorado,
           data, hora e mentor: uma reuniao contada duas vezes no fechamento dos
           mentores. Em 08/09/2026 havia 5 casos assim em producao.

           So com hora conhecida: evento de dia inteiro (hora nula) casaria com
           qualquer linha daquele dia. */
        let manterEtapa = false;
        if (!alvo && hora_) {
          const p2 = await manual().eq("data", data_).eq("hora", hora_).order("id").limit(1);
          alvo = (p2.data || [])[0] || null;
          manterEtapa = !!alvo;
          if (alvo) adotadas++;
        }

        if (alvo) {
          const upd: Record<string, unknown> = {
            data: data_, hora: hora_, link_meet, google_event_id: ev.id, synced_at: agoraISO,
          };
          /* Preserva a etapa quando a linha veio do passo 2: ela foi escolhida
             por uma pessoa olhando a trilha, nao herdada do titulo do convite. */
          if (!manterEtapa) { upd.etapa = etapaInfo.etapa; upd.ordem = etapaInfo.ordem; }
          /* mentor pode voltar nulo quando o e-mail do atendente nao esta no
             EMAIL_MENTOR. Gravar esse nulo apagaria o mentor que ja estava na
             linha e mandaria a sessao para "sem mentor identificado" calada --
             o ramo `existente` acima ja se protegia disso, este nao. */
          if (mentor) upd.mentor = mentor;
          /* Nao rebaixa o que ja foi confirmado: reuniao concluida nao volta
             para "Aguardando confirmacao" so porque o evento foi encontrado
             agora. O ramo `existente` tambem so promove, nunca rebaixa. */
          if (alvo.status !== "Concluída") upd.status = statusInicial;
          await supabase.from("sessoes").update(upd).eq("id", alvo.id);
          atualizadas++;
        } else {
          await supabase.from("sessoes").insert({
            mentorado_id: mentorado.id, etapa: etapaInfo.etapa, ordem: etapaInfo.ordem,
            status: statusInicial, mentor, data: data_, hora: hora_, link_meet,
            google_event_id: ev.id, synced_at: agoraISO,
          });
          criadas++;
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, tz: TZ, criadas, atualizadas, adotadas, confirmacoesPendentes, semMentor, ignoradas_count: ignoradas.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
