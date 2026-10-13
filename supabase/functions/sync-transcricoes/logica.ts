// Pure parts of sync-transcricoes: title parsing, mentee matching and the
// deterministic quality gate. No I/O, so `logica_test.ts` covers them.

// Only calls from the last JANELA_DIAS feed the dossier: older ones are neither queued nor processed.
export const JANELA_DIAS = 30;

export type Mentorado = { id: string; nome: string; email: string | null };

export function normaliza(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Same rules as sync-google-calendar (parseEtapa / ehEventoDeGrupo).
export function parseEtapa(titulo: string): string | null {
  const s = normaliza(titulo);
  if (s.includes("diagnostico")) return "Diagnóstico de Negócio";
  if (s.includes("plano de acao")) return "Plano de Ação";
  const m = s.match(/checkup\s*(\d+)/);
  return m ? `Checkup ${m[1]}` : null;
}
export function ehGrupo(titulo: string) {
  const s = normaliza(titulo);
  return s.includes("plantao") || s.includes("duvida") || s.includes("implementacao")
    || s.includes("mentoria coletiva") || s.includes("weekly") || s.includes("wekly");
}

// "Plano de Ação Elite 3D - Paulo Barbosa - 2026/10/06 14:04 GMT-03:00 - Anotações do Gemini"
export function dataDoTitulo(titulo: string): string | null {
  const m = titulo.match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}) GMT([+-]\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${m[6]}:${m[7]}` : null;
}

// The doc header lists guests on the "convidado" line; the mentee is matched by
// e-mail first (exact), then by name words in the title (same as the Calendar sync).
export function acharMentorado(cabecalho: string, titulo: string, mentorados: Mentorado[]): Mentorado | null {
  const emails = new Set((cabecalho.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []).map((e) => e.toLowerCase()));
  const porEmail = mentorados.filter((m) => m.email && emails.has(m.email.trim().toLowerCase()));
  if (porEmail.length === 1) return porEmail[0];
  if (porEmail.length > 1) return null; // two mentees invited: not a 1:1
  // Word set, not regex: names come from the database and may carry "(" or "+".
  const s = new Set(normaliza(titulo.replace(/ - \d{4}\/\d{2}\/\d{2}.*$/, "")).split(/[^\p{L}\p{N}]+/u));
  let melhor: Mentorado | null = null, melhorScore = 0, empate = false;
  for (const m of mentorados) {
    const palavras = normaliza(m.nome).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
    const score = palavras.filter((w) => s.has(w)).length;
    if (score > melhorScore) { melhorScore = score; melhor = m; empate = false; }
    else if (score === melhorScore && score > 0 && melhor && m.id !== melhor.id) empate = true;
  }
  return melhorScore < 1 || empate ? null : melhor;
}

const MARCA = "📖 Transcrição";
export function separar(texto: string): { notas: string; transcricao: string | null } {
  const i = texto.indexOf(MARCA);
  return i < 0 ? { notas: texto, transcricao: null } : { notas: texto.slice(0, i), transcricao: texto.slice(i) };
}

// Cheap gate before spending Jev/Claude. Returns the rejection reason or null.
export const MIN_CHARS = 2000;
export function triagem(transcricao: string | null): string | null {
  if (!transcricao) return "doc sem transcrição (só anotações do Gemini)";
  if (transcricao.length < MIN_CHARS) return `transcrição curta demais (${transcricao.length} caracteres)`;
  const falantes = new Set(transcricao.split("\n").map((l) => l.match(/^([^:\n]{2,60}):\s/)?.[1]).filter(Boolean));
  if (falantes.size < 2) return "transcrição com menos de dois falantes";
  return null;
}

// Jev verdict -> accept or the reason. Thresholds measured on 13/10/2026: real
// calls scored 0.98-1.0 "utilizavel"; truncated, noise and shuffled text 0.0-0.04.
export type Jev = { qualidade: { choice: string; confidence: number; probabilities: Record<string, number> }; conteudo: { noul: number } };
export const LIMIAR_UTILIZAVEL = 0.7, LIMIAR_CONTEUDO = 0.5;
export function vereditoJev(j: Jev): string | null {
  const p = j.qualidade.probabilities.utilizavel ?? 0;
  if (j.qualidade.choice !== "utilizavel" || p < LIMIAR_UTILIZAVEL) {
    return `Jev: transcrição ${j.qualidade.choice} (utilizável ${p.toFixed(2)})`;
  }
  if (j.conteudo.noul < LIMIAR_CONTEUDO) return `Jev: sem orientação de negócio (${j.conteudo.noul.toFixed(2)})`;
  return null;
}
