// NPS dos mentores vindo do Google Forms.
//
// Fonte: o formulário "Pesquisa de Satisfação com a Sessão - Elite 3D". Um Apps
// Script instalado nele (supabase/functions/nps-forms/apps-script.gs) chama esta
// função a cada envio e, uma vez, com todos os envios antigos. Mão única: nada
// aqui escreve no Forms.
//
// verify_jwt FALSE, como o lia-webhook: o Apps Script não faz login no Supabase.
// Quem garante a procedência é o header X-NPS-Token, comparado em tempo
// constante com o secret NPS_FORMS_TOKEN. Sem o secret, a função falha fechada.
//
// Idempotente por `origem_id` (id da resposta no Forms): reenviar atualiza a
// mesma linha, então a importação inicial pode rodar de novo sem duplicar.
//
// Deploy:
//   supabase functions deploy nps-forms --no-verify-jwt --project-ref <ref>

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("NPS_FORMS_TOKEN") ?? "";

const db = createClient(SUPABASE_URL, SERVICE_KEY);

type Resposta = {
  id?: string;
  respondido_em?: string;
  nome?: string;
  mentor?: string;
  nota?: number | string;
  comentario?: string;
  clareza?: string;
  direcionamento?: string;
  apoio?: string;
};

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

function tokenValido(recebido: string | null) {
  if (!TOKEN || !recebido) return false;
  const a = new TextEncoder().encode(recebido), b = new TextEncoder().encode(TOKEN);
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

/* ---------------- vínculo com o mentorado, por nome ----------------
   O formulário não pede e-mail. Os cadastros carregam sufixo de empresa ("Edson
   Brossa - ED MAKER PRODUCT LTDA") e o Forms traz nome completo ou abreviado
   ("André Gustavo Bertozzi Untura" x "André Bertozzi (Creative Laser Desing)"),
   então igualdade não serve. Regra: mesmo primeiro nome E pelo menos duas
   palavras em comum, e um vencedor único. Empate ou pouca evidência devolve
   null -- vínculo errado seria pior que nenhum, porque a resposta apareceria na
   ficha de outra pessoa. O ranking não depende disto. */
const LIGA = new Set(["de", "da", "do", "das", "dos", "e"]);
const palavras = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z\s]/g, " ").split(/\s+/).filter((p) => p.length >= 3 && !LIGA.has(p));

export function casarMentorado(nome: string, cadastros: { id: string; nome: string }[]) {
  const alvo = palavras(nome);
  if (alvo.length < 2) return null;
  const set = new Set(alvo);
  let melhor: string | null = null, pontos = 0, empate = false;
  for (const c of cadastros) {
    const ps = palavras(c.nome || "");
    if (!ps.length || ps[0] !== alvo[0]) continue;
    const comuns = new Set(ps.filter((p) => set.has(p))).size;
    if (comuns < 2) continue;
    if (comuns > pontos) { melhor = c.id; pontos = comuns; empate = false; }
    else if (comuns === pontos) empate = true;
  }
  return empate ? null : melhor;
}

function normalizar(r: Resposta) {
  const nota = Number(String(r.nota ?? "").trim());
  const quando = r.respondido_em ? new Date(r.respondido_em) : null;
  if (!r.id || !r.mentor?.trim() || !Number.isInteger(nota) || nota < 0 || nota > 10) return null;
  if (!quando || isNaN(quando.getTime())) return null;
  return {
    origem_id: `forms:${r.id}`,
    origem: "google_forms",
    mentor: r.mentor.trim(),
    nota,
    comentario: r.comentario?.trim() || null,
    nome_informado: r.nome?.trim() || null,
    // Perguntas de 13/10/2026: opcionais, vazias nas respostas anteriores.
    clareza: r.clareza?.trim() || null,
    direcionamento: r.direcionamento?.trim() || null,
    apoio: r.apoio?.trim() || null,
    respondido_em: quando.toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "use POST" });
  if (!tokenValido(req.headers.get("x-nps-token"))) return json(401, { erro: "token inválido" });

  let corpo: { respostas?: Resposta[] };
  try { corpo = await req.json(); } catch { return json(400, { erro: "JSON inválido" }); }
  const entrada = Array.isArray(corpo.respostas) ? corpo.respostas : [];
  if (!entrada.length) return json(400, { erro: "sem respostas" });

  const linhas = entrada.map(normalizar);
  const validas = linhas.filter((l): l is NonNullable<typeof l> => !!l);

  const { data: cadastros, error: errCad } = await db.from("mentorados").select("id, nome");
  if (errCad) return json(500, { erro: errCad.message });
  const comVinculo = validas.map((l) => ({
    ...l,
    mentorado_id: l.nome_informado ? casarMentorado(l.nome_informado, cadastros ?? []) : null,
  }));

  if (comVinculo.length) {
    const { error } = await db.from("nps_respostas").upsert(comVinculo, { onConflict: "origem_id" });
    if (error) return json(500, { erro: error.message });
  }
  return json(200, {
    recebidas: entrada.length,
    gravadas: comVinculo.length,
    descartadas: entrada.length - comVinculo.length,
    vinculadas: comVinculo.filter((l) => l.mentorado_id).length,
  });
});
