/* Sonda do RLS (G3.14; GATE-08, SEC-02).
 *
 *   node --import ./scripts/gates/alias.mjs scripts/gates/sondar-rls.mjs
 *
 * Quem roda é o Lucas, num terminal dele, com a conta de diretoria ou de mentor
 * do UAT: e-mail e senha são pedidos sem eco e nunca vão para arquivo,
 * argumento nem variável de ambiente. A sessão não persiste e é encerrada no fim.
 *
 * No registro de teste `ZZQ Migracao Xyzzy` (zzq-migracao@example.invalid), e só
 * nele, tenta cada escrita W01–W21 que o papel não tem no mapeamento §4.2, pelas
 * mesmas funções que o app usa (src/lib/data/escritas.ts). Imprime só
 * `Wnn | recusada` (erro ou 0 linhas) ou `Wnn | GRAVOU`: nada de nome, e-mail ou
 * valor. A W13 (excluir o registro) vai por último.
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import {
  addParcela,
  confirmarGrupo,
  confirmarSessao,
  criarMentorado,
  criarSessaoGrupo,
  delParcela,
  delSessao,
  descartarCobranca,
  excluirFaturamento,
  excluirMentorado,
  restaurarCobranca,
  salvarCanalMentorado,
  salvarFaturamento,
  salvarMarco,
  salvarMentorado,
  salvarNota,
  salvarParcela,
  salvarSessao,
  salvarSituacao,
  toggleParcela,
  vincularCobranca,
} from "@/lib/data/escritas";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/data/config";
import { pode } from "@/lib/papeis";

import { perguntarSemEco } from "../parity/snapshot.mjs";

export const NOME_ALVO = "ZZQ Migracao Xyzzy";
export const EMAIL_ALVO = "zzq-migracao@example.invalid";
// O dia de toda sessão do UAT (GATE-09): 31/12/2099 às 23:59.
const DIA = "2099-12-31";
const HORA = "23:59";
// Linha que o papel não lê, ou que o registro não tem: um id que não existe.
const NENHUM = "00000000-0000-0000-0000-000000000000";
// Cobrança da Lia não existe no registro de teste (G3.6): a W15–W17 vão contra um bill que não existe.
const BILL = "zzq-migracao-sem-cobranca";

/**
 * @typedef {{ id: string, nome: string, email: string, data_fechamento: string | null, link_drive: string | null,
 *   link_mapa_mental: string | null, link_whatsapp: string | null, sessaoId: string, parcelaId: string,
 *   faturamentoId: string, rotaId: string, canalId: string, marcoId: string }} Alvo
 * @typedef {{ ok: boolean }} Resultado
 * @typedef {{ w: string, cap: import("@/lib/papeis").Capacidade, tentar: (alvo: Alvo, db: any) => Promise<Resultado> }} Escrita
 */

const sessao = (/** @type {Alvo} */ a) => ({ mentorado_id: a.id, etapa: "Checkup 1", status: "Agendada", mentor: null, data: DIA, hora: HORA, link_meet: null, link_gravacao: null, link_anotacoes: null });

/** W01–W21 com a capacidade do mapeamento §4.2. A W03 que cria sessão é a W02 no RLS (insert em sessoes). @type {Escrita[]} */
export const ESCRITAS = [
  { w: "W01", cap: "escreverSessao", tentar: (a, db) => confirmarGrupo([a.sessaoId], "Luan", db) },
  { w: "W02", cap: "criarSessao", tentar: (a, db) => criarSessaoGrupo([a.id], { etapa: "Plantão de Dúvida Semanal", status: "Agendada", mentor: null, data: DIA, hora: HORA, link_meet: null, link_gravacao: null }, db) },
  { w: "W03", cap: "escreverSessao", tentar: (a, db) => salvarSessao(a.sessaoId, sessao(a), db) },
  { w: "W04", cap: "escreverSessao", tentar: (a, db) => confirmarSessao(a.sessaoId, "Luan", db) },
  { w: "W05", cap: "excluir", tentar: (a, db) => delSessao(a.sessaoId, db) },
  { w: "W06", cap: "escreverRotas", tentar: (a, db) => salvarCanalMentorado(a.id, a.rotaId, a.canalId, db) },
  { w: "W07", cap: "escreverRotas", tentar: (a, db) => salvarFaturamento(a.id, "2099-12", a.canalId, 0, db) },
  { w: "W08", cap: "excluir", tentar: (a, db) => excluirFaturamento(a.faturamentoId, db) },
  { w: "W09", cap: "escreverRotas", tentar: (a, db) => salvarMarco(a.id, a.marcoId, { status: "NAO_INICIADO", data: null }, db) },
  { w: "W10", cap: "escreverNotas", tentar: (a, db) => salvarNota(a.id, "<p>sonda do RLS</p>", new Date().toISOString(), db) },
  {
    w: "W11",
    cap: "editarMentorado",
    tentar: (a, db) =>
      salvarMentorado(a.id, { aba: "cadastro", nome: a.nome, email: a.email, data_fechamento: a.data_fechamento, link_drive: a.link_drive, link_mapa_mental: a.link_mapa_mental, link_whatsapp: a.link_whatsapp }, db),
  },
  { w: "W12", cap: "editarMentorado", tentar: (a, db) => salvarSituacao(a.id, { situacao: "ativo", pausado_em: null, retorno_previsto: null }, DIA, db) },
  {
    w: "W14",
    cap: "criarMentorado",
    tentar: (_a, db) => criarMentorado({ nome: NOME_ALVO, email: null, data_fechamento: DIA, entrada_status: "Pago", entrada_forma_pgto: null, contrato_status: "Ainda não", restante_status: "Ainda não" }, db),
  },
  { w: "W15", cap: "editarFinanceiro", tentar: (a, db) => vincularCobranca(BILL, a.id, db) },
  { w: "W16", cap: "editarFinanceiro", tentar: (a, db) => descartarCobranca(BILL, a.id, db) },
  { w: "W17", cap: "editarFinanceiro", tentar: (a, db) => restaurarCobranca(BILL, a.id, db) },
  { w: "W18", cap: "editarFinanceiro", tentar: (a, db) => toggleParcela(a.parcelaId, "aberta", db) },
  { w: "W19", cap: "editarFinanceiro", tentar: (a, db) => addParcela(a.id, [], DIA, 0, db) },
  { w: "W20", cap: "editarFinanceiro", tentar: (a, db) => salvarParcela(a.parcelaId, { numero: 1, vencimento: DIA, valor: 0, status: "aberta" }, db) },
  { w: "W21", cap: "editarFinanceiro", tentar: (a, db) => delParcela(a.parcelaId, db) },
  // Por último: se o RLS deixar, o registro some, e com ele as linhas das outras.
  { w: "W13", cap: "excluir", tentar: (a, db) => excluirMentorado(a.id, db) },
];

/**
 * As escritas que o papel não tem, pelas capacidades (src/lib/papeis.ts).
 * @param {string} papel
 * @returns {Escrita[]}
 */
export const proibidas = (papel) => ESCRITAS.filter((e) => !pode(papel, e.cap));

/**
 * O registro de teste, e nenhum outro: uma linha só, com o e-mail do UAT.
 * @param {unknown} linhas
 * @returns {Record<string, any>}
 */
export function conferirAlvo(linhas) {
  if (!Array.isArray(linhas) || linhas.length !== 1) throw new Error(`a sonda precisa de exatamente um registro de teste (${EMAIL_ALVO})`);
  if (linhas[0]?.email !== EMAIL_ALVO || linhas[0]?.nome !== NOME_ALVO) throw new Error(`a sonda só escreve no registro de teste ${NOME_ALVO} (${EMAIL_ALVO})`);
  return linhas[0];
}

/**
 * O id da primeira linha que a consulta devolver, ou NENHUM.
 * @param {PromiseLike<{ data: unknown, error: unknown }>} consulta
 */
async function primeiroId(consulta) {
  const { data, error } = await consulta;
  return !error && Array.isArray(data) && typeof data[0]?.id === "string" ? data[0].id : NENHUM;
}

/**
 * Lê o registro de teste e as linhas dele que o papel enxerga, e tenta cada
 * escrita proibida. A porta escreve o erro do PostgREST no console, e ele pode
 * repetir um valor: o console fica mudo durante as tentativas.
 * @param {{ db: any, papel: string, escrever: (linha: string) => void, silenciar?: boolean }} opcoes
 */
export async function sondar({ db, papel, escrever, silenciar = true }) {
  const relacao = pode(papel, "verFinanceiro") ? "mentorados" : "mentorados_basic";
  const lido = await db.from(relacao).select("*").eq("email", EMAIL_ALVO);
  if (lido.error) throw new Error(`${relacao}: ${lido.error.message}`);
  const m = conferirAlvo(lido.data);
  const rotaId = await primeiroId(db.from("rotas").select("id").order("ordem").limit(1));
  /** @type {Alvo} */
  const alvo = {
    id: m.id,
    nome: m.nome,
    email: m.email,
    data_fechamento: m.data_fechamento ?? null,
    link_drive: m.link_drive ?? null,
    link_mapa_mental: m.link_mapa_mental ?? null,
    link_whatsapp: m.link_whatsapp ?? null,
    sessaoId: await primeiroId(db.from("sessoes").select("id").eq("mentorado_id", m.id).limit(1)),
    parcelaId: await primeiroId(db.from("parcelas").select("id").eq("mentorado_id", m.id).limit(1)),
    faturamentoId: await primeiroId(db.from("faturamento_mensal").select("id").eq("mentorado_id", m.id).limit(1)),
    rotaId,
    canalId: await primeiroId(db.from("canais").select("id").eq("rota_id", rotaId).limit(1)),
    marcoId: await primeiroId(db.from("marcos_definicao").select("id").eq("rota_id", rotaId).limit(1)),
  };
  const erro = console.error;
  if (silenciar) console.error = () => undefined;
  try {
    for (const e of proibidas(papel)) escrever(`${e.w} | ${(await e.tentar(alvo, db)).ok ? "GRAVOU" : "recusada"}`);
  } finally {
    console.error = erro;
  }
}

/**
 * @param {{ criarCliente?: typeof createClient, perguntar?: (p: string) => Promise<string>, escrever?: (l: string) => void }} [opcoes]
 */
export async function executar({ criarCliente = createClient, perguntar = perguntarSemEco, escrever = (linha) => console.log(linha) } = {}) {
  const db = criarCliente(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const email = (await perguntar("E-mail: ")).trim();
  const senha = await perguntar("Senha: ");
  let falha;
  try {
    const login = await db.auth.signInWithPassword({ email, password: senha });
    if (login.error) throw new Error(`login recusado: ${login.error.message}`);
    const perfil = await db.from("profiles").select("role").eq("id", login.data.user.id).single();
    if (perfil.error) throw new Error(`profiles: ${perfil.error.message}`);
    const papel = perfil.data.role;
    if (papel !== "diretoria" && papel !== "mentor") throw new Error("a sonda é para as contas de diretoria e de mentor do UAT");
    escrever(`papel: ${papel}`);
    await sondar({ db, papel, escrever });
  } catch (erro) {
    falha = erro;
  }
  // `local` encerra só esta sessão (auth-js 2.117.3, GoTrueClient.js:3414).
  const saida = await db.auth.signOut({ scope: "local" });
  if (falha) throw falha;
  if (saida.error) throw new Error(`a sessão não foi encerrada: ${saida.error.message}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.stdin.isTTY) {
    console.error("rode num terminal: e-mail e senha são pedidos sem eco");
    process.exit(2);
  }
  executar().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exit(1);
  });
}
