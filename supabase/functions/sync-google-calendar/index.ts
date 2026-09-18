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

/* Encontro coletivo NAO tem etapa da trilha 1:1 para deduzir. Sem este
   reconhecedor, um plantao semanal -- cujo titulo nao casa com Diagnostico,
   Plano de Acao nem Checkup N -- caia na deducao e virava um Checkup falso por
   semana, marchando trilha acima. Aconteceu em producao em 17/09/2026: seis
   Checkups (5 a 10) criados para um mentorado a partir do plantao recorrente
   das 19h, um deles na mesma data e hora de um plantao com 39 participantes.
   O sync nunca cria sessao em grupo -- este e o guarda dessa invariante. */
function ehEventoDeGrupo(summary: string) {
  const s = normaliza(summary);
  return s.includes("plantao") || s.includes("duvida")
    || s.includes("implementacao") || s.includes("mentoria coletiva");
}

/* A trilha 1:1, na ordem. Mesma lista do front (ETAPAS / ETAPA_ORD) -- as duas
   precisam concordar, senao o sync inventa uma etapa que a tela nao sabe
   desenhar. */
const TRILHA: { etapa: string; ordem: number }[] = [
  { etapa: "Diagnóstico de Negócio", ordem: 1 },
  { etapa: "Plano de Ação", ordem: 2 },
  ...Array.from({ length: 10 }, (_, i) => ({ etapa: `Checkup ${i + 1}`, ordem: 3 + i })),
];

/* Deducao da etapa, para quando o titulo nao diz.
   Devolve a primeira etapa da trilha ainda LIVRE para este mentorado. Ocupada
   e: ja concluida, ou ja presa a um evento do Calendar, ou ja deduzida nesta
   mesma rodada.

   As tres condicoes tem o mesmo motivo. Sem elas, dois eventos de titulo livre
   do mesmo mentorado deduziriam a mesma etapa e virariam duas sessoes iguais --
   a duplicata que o passo 2 da adocao existe justamente para evitar.

   Evento que ja tem sessao nunca chega aqui: o ramo `existente` trata antes e
   nem toca na etapa.

   Trilha inteira ocupada devolve null. Melhor ignorar o evento do que inventar
   um 13o Checkup para quem ja terminou os 12. */
function deduzirEtapa(mentoradoId: string, ocupadas: Map<string, Set<string>>) {
  const tomadas = ocupadas.get(mentoradoId);
  for (const t of TRILHA) {
    if (!tomadas || !tomadas.has(t.etapa)) return t;
  }
  return null;
}
function ocupar(mentoradoId: string, etapa: string, ocupadas: Map<string, Set<string>>) {
  let s = ocupadas.get(mentoradoId);
  if (!s) { s = new Set(); ocupadas.set(mentoradoId, s); }
  s.add(etapa);
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
type Mentorado = { id: string; nome: string; email?: string | null };

/* Casamento EXATO pelo e-mail do convidado, do mesmo jeito que o mentor ja e
   identificado. E o caminho preferido: quando o mentorado tem e-mail na ficha,
   o titulo do evento deixa de importar -- pode ser "Reuniao Checkup 3" sem o
   nome dele. O unico parcial em lower(email) garante que nao ha dois donos
   possiveis para o mesmo endereco. */
function acharMentoradoPorEmail(attendees: { email?: string }[], porEmail: Map<string, Mentorado>) {
  for (const a of attendees) {
    const e = (a.email || "").trim().toLowerCase();
    const m = e ? porEmail.get(e) : undefined;
    if (m) return m;
  }
  return null;
}
/* Quantos mentorados diferentes estao convidados. Mais de um nao e 1:1 -- e
   encontro coletivo, qualquer que seja o titulo. Sinal estrutural, nao
   textual: vale para o plantao que alguem renomeou e para a "call de duvidas"
   improvisada. So enxerga quem ja tem e-mail na ficha, entao fica mais forte
   conforme o cadastro for preenchido. */
function quantosMentorados(attendees: { email?: string }[], porEmail: Map<string, Mentorado>) {
  const ids = new Set<string>();
  for (const a of attendees) {
    const m = porEmail.get((a.email || "").trim().toLowerCase());
    if (m) ids.add(m.id);
  }
  return ids.size;
}
/* Fallback por nome no titulo. Continua existindo porque a maioria das fichas
   ainda nao tem e-mail: tirar isto agora pararia o sync dos mentorados
   antigos. Some sozinho conforme os e-mails forem preenchidos. */
function acharMentoradoPorNome(summary: string, mentorados: Mentorado[]) {
  const s = normaliza(summary);
  let melhor: Mentorado | null = null;
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
    const { data: mentorados, error: merr } = await supabase.from("mentorados").select("id,nome,email").eq("cancelado", false);
    if (merr) throw merr;
    const lista: Mentorado[] = mentorados || [];
    const porEmail = new Map<string, Mentorado>();
    for (const m of lista) {
      const e = (m.email || "").trim().toLowerCase();
      if (e) porEmail.set(e, m);
    }
    /* E-mail primeiro, nome depois. Nesta ordem porque o e-mail e exato e o
       nome e heuristica: inverter faria um titulo mal escrito ganhar de um
       convidado identificado. */
    const casarMentorado = (summary: string, attendees: { email?: string }[] = []) =>
      acharMentoradoPorEmail(attendees, porEmail) || acharMentoradoPorNome(summary, lista);

    /* Etapas ja ocupadas por mentorado, para a deducao nao repetir. Uma consulta
       so, antes do laco: dentro dele seria uma ida ao banco por evento. Restrito
       a trilha 1:1 (ordem < 90) -- encontro em grupo nao tem etapa a deduzir. */
    const { data: ocupadasRows } = await supabase.from("sessoes")
      .select("mentorado_id,etapa,status,google_event_id").lt("ordem", 90);
    const ocupadas = new Map<string, Set<string>>();
    for (const r of ocupadasRows || []) {
      if (r.status === "Concluída" || r.google_event_id) ocupar(r.mentorado_id, r.etapa, ocupadas);
    }

    const accessToken = await getAccessToken();
    const events = await fetchEvents(accessToken);

    if (debug) {
      const amostra: unknown[] = [];
      for (const ev of events) {
        if (ev.status === "cancelled") continue;
        const summary = ev.summary || "";
        if (!parseEtapa(summary) || !casarMentorado(summary, ev.attendees || [])) continue;
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
    // Quantos eventos vieram por cada caminho -- mostra a adocao do e-mail
    // avancando sem precisar consultar o banco.
    let porEmailCount = 0, porNomeCount = 0, etapasDeduzidas = 0;
    const ignoradas: string[] = [];

    for (const ev of events) {
      if (ev.status === "cancelled") continue;
      const summary = ev.summary || "";
      const porConvite = acharMentoradoPorEmail(ev.attendees || [], porEmail);
      const mentorado = porConvite || acharMentoradoPorNome(summary, lista);
      if (!mentorado) { ignoradas.push(summary); continue; }

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
      const link_meet = ev.hangoutLink || ev.location || null;

      /* A sessao deste evento e procurada ANTES de resolver a etapa, e nao
         depois.
         Evento que ja tem sessao nao precisa de etapa nenhuma: este ramo nunca
         a toca. Resolver antes fazia a deducao rodar a toa e, pior, RESERVAR a
         etapa deduzida como ocupada na rodada. Um segundo evento de titulo
         livre do mesmo mentorado achava aquela casa tomada e pulava uma --
         Checkup 6 onde devia ser 5, calado, no dado que alimenta a matriz de
         fechamento dos mentores.
         A etapa da sessao existente ja entra em `ocupadas` na carga inicial,
         pelo google_event_id: nada se perde adiando. */
      const { data: existente } = await supabase.from("sessoes")
        .select("id,status,mentor").eq("google_event_id", ev.id).maybeSingle();

      if (existente) {
        if (!mentor) semMentor++;
        if (porConvite) porEmailCount++; else porNomeCount++;
        const upd: Record<string, unknown> = { data: data_, hora: hora_, link_meet, synced_at: agoraISO };
        if (mentor) upd.mentor = mentor;
        if (jaPassou && existente.status === "Agendada") {
          upd.status = "Aguardando confirmação"; confirmacoesPendentes++;
        }
        await supabase.from("sessoes").update(upd).eq("id", existente.id);
        atualizadas++;
      } else {
        /* Etapa: titulo primeiro. Se o titulo nao diz, deduz pela trilha -- mas
           SO quando o mentorado veio do e-mail do convidado. O casamento por
           nome e heuristica sobre o titulo; deduzir em cima dele empilharia
           palpite sobre palpite, e "Reuniao sobre a Ana Clara" viraria um
           Checkup. */
        let etapaInfo = parseEtapa(summary);
        let deduzida = false;
        /* Dois guardas antes de deduzir, os dois contra o mesmo estrago: virar
           encontro coletivo em Checkup falso. O titular ("plantao", "duvida",
           "implementacao") pega o evento nomeado; a contagem de mentorados pega
           o que foi renomeado. Reconhecido como grupo, o evento e ignorado -- o
           sync nunca criou e continua nao criando sessao em grupo. */
        if (!etapaInfo && porConvite) {
          const coletivo = ehEventoDeGrupo(summary)
            || quantosMentorados(ev.attendees || [], porEmail) > 1;
          if (!coletivo) {
            etapaInfo = deduzirEtapa(mentorado.id, ocupadas);
            deduzida = !!etapaInfo;
          }
        }
        if (!etapaInfo) { ignoradas.push(summary); continue; }
        /* Reserva a etapa nesta rodada, venha de onde vier: dois eventos de
           titulo livre do mesmo mentorado nao podem cair na mesma. */
        ocupar(mentorado.id, etapaInfo.etapa, ocupadas);
        if (deduzida) etapasDeduzidas++;
        if (!mentor) semMentor++;
        if (porConvite) porEmailCount++; else porNomeCount++;

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
             por uma pessoa olhando a trilha, nao herdada do titulo do convite.
             O marcador acompanha a etapa -- so mexe nele quem mexe nela, senao
             um passo 2 apagaria a marca de uma deducao anterior sem ninguem ter
             olhado a etapa de fato. */
          if (!manterEtapa) {
            upd.etapa = etapaInfo.etapa;
            upd.ordem = etapaInfo.ordem;
            upd.etapa_deduzida = deduzida;
          }
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
            etapa_deduzida: deduzida,
            status: statusInicial, mentor, data: data_, hora: hora_, link_meet,
            google_event_id: ev.id, synced_at: agoraISO,
          });
          criadas++;
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, tz: TZ, criadas, atualizadas, adotadas, confirmacoesPendentes, semMentor, mentoradoPorEmail: porEmailCount, mentoradoPorNome: porNomeCount, fichasComEmail: porEmail.size, etapasDeduzidas, ignoradas_count: ignoradas.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
