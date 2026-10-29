/* Snapshot de paridade (GATE-05, G0.2): lê R01–R22 com a sessão de um admin e
 * grava em ~/.central-elite3d-paridade/snapshot-<data>.json.
 *
 *   pnpm parity:snapshot
 *
 * Quem roda é o Lucas, num terminal dele: e-mail e senha são pedidos sem eco e
 * nunca vão para arquivo, argumento nem variável de ambiente. O arquivo é dado
 * de produção (nome, e-mail, NPS, financeiro): pasta 0700 fora do Time Machine,
 * arquivo 0600. A saída só tem nome de relação e contagem (GATE-03).
 *
 * Cada relação paginada vem na ordem de hoje e depois na chave única (DATA-04),
 * a mesma que a porta usa. A chave tem de existir e ser única em toda linha:
 * várias não estão em migration versionada (mapeamento §6.5).
 */
import { execFileSync } from "node:child_process";
import { chmodSync, lstatSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://matgynpiscyoshnjzolo.supabase.co";
const SUPABASE_KEY = "sb_publishable_S7cckKfundDsqo-s_qL2-A_lgPkY9Yl";
const PASTA = join(homedir(), ".central-elite3d-paridade");
const PASSO = 1000;
// `INICIO_COBRANCA_NPS` e `PRAZO_RESPOSTA_DIAS` do index.html (:807–809).
const ADESAO = { p_desde: "2026-10-13", p_prazo_dias: 2 };

/**
 * R02–R18 e R22 (design, "Leituras"): ordem de hoje e desempate pela chave única.
 * `true` é ascendente.
 * @type {{ nome: string, select?: string, ordem: [string, boolean][], chave: string[] }[]}
 */
export const PAGINADAS = [
  { nome: "mentorados", ordem: [["data_fechamento", true]], chave: ["id"] },
  { nome: "mentorados_basic", ordem: [["data_fechamento", true]], chave: ["id"] },
  { nome: "parcelas", ordem: [["numero", true]], chave: ["id"] },
  { nome: "lia_cobrancas", ordem: [["due_date", true]], chave: ["id"] },
  { nome: "sessoes", ordem: [["ordem", true]], chave: ["id"] },
  { nome: "rotas", ordem: [["ordem", true]], chave: ["id"] },
  { nome: "marcos_definicao", ordem: [["ordem", true]], chave: ["id"] },
  { nome: "mentorado_marcos", ordem: [], chave: ["mentorado_id", "marco_id"] },
  { nome: "faturamento_mensal", ordem: [], chave: ["id"] },
  { nome: "canais", ordem: [["ordem", true]], chave: ["id"] },
  { nome: "mentorado_canais", ordem: [], chave: ["mentorado_id", "rota_id"] },
  { nome: "sessoes_orfas", ordem: [], chave: ["id"] },
  { nome: "stlseller_mentorados", ordem: [], chave: ["email"] },
  { nome: "stlseller_pedidos_marketplace", ordem: [], chave: ["email", "marketplace"] },
  { nome: "stlseller_produtos_vendidos", ordem: [["faturamento", false]], chave: ["email", "marketplace", "anuncio_id"] },
  { nome: "nps_respostas", ordem: [["respondido_em", false]], chave: ["id"] },
  { nome: "experiencia_respostas", ordem: [["respondido_em", false]], chave: ["origem_id"] },
  { nome: "transcricoes", select: "mentor,status,realizada_em,mentorado_id,drive_id", ordem: [], chave: ["drive_id"] },
  // R24–R28: a validação de faturamento (20261029_validacao_faturamento.sql). Não há métrica do app
  // antigo sobre elas; entram para o app novo carregar do snapshot.
  { nome: "faixas_remuneracao", ordem: [], chave: ["id"] },
  { nome: "mentor_lojas", ordem: [["mentor", true]], chave: ["id"] },
  { nome: "validacao_faturamento", ordem: [["competencia", false]], chave: ["id"] },
  { nome: "validacao_lojas", ordem: [["validacao_id", true]], chave: ["id"] },
  { nome: "validacao_eventos", ordem: [["criado_em", true]], chave: ["id"] },
];

/**
 * Páginas de 1.000 até vir uma menor, como o `paginado` do index.html (:726–735).
 * @param {string} nome
 * @param {() => any} construir devolve a consulta sem o `range`
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function lerPaginado(nome, construir) {
  const todas = [];
  for (let de = 0; ; de += PASSO) {
    const { data, error } = await construir().range(de, de + PASSO - 1);
    if (error) throw new Error(`${nome}: ${error.message}`);
    todas.push(...data);
    if (data.length < PASSO) return todas;
  }
}

/**
 * Falha alto se alguma linha não tem a chave de desempate ou a repete. A mensagem
 * só nomeia relação, colunas e contagem: o valor da chave pode ser um e-mail.
 * @param {string} nome
 * @param {Record<string, unknown>[]} linhas
 * @param {string[]} chave
 */
export function conferirChave(nome, linhas, chave) {
  const vistas = new Set();
  let repetidas = 0;
  for (const linha of linhas) {
    const valores = chave.map((c) => linha[c]);
    if (valores.some((v) => v === undefined || v === null)) {
      throw new Error(`${nome}: coluna de desempate ausente ou nula (${chave.join(", ")})`);
    }
    const k = JSON.stringify(valores);
    if (vistas.has(k)) repetidas++;
    vistas.add(k);
  }
  if (repetidas) throw new Error(`${nome}: ${repetidas} linha(s) repetem a chave de desempate (${chave.join(", ")})`);
}

/**
 * @param {any} resposta `{ data, error }` do supabase-js
 * @param {string} nome
 * @returns {Record<string, unknown>[]}
 */
function lista(resposta, nome) {
  if (resposta.error) throw new Error(`${nome}: ${resposta.error.message}`);
  if (!Array.isArray(resposta.data)) throw new Error(`${nome}: a resposta não é uma lista`);
  return resposta.data;
}

/**
 * @param {any} db
 * @param {(typeof PAGINADAS)[number]} leitura
 */
async function lerRelacao(db, { nome, select = "*", ordem, chave }) {
  const linhas = await lerPaginado(nome, () => {
    let q = db.from(nome).select(select);
    for (const [coluna, ascending] of ordem) q = q.order(coluna, { ascending });
    for (const coluna of chave) q = q.order(coluna, { ascending: true });
    return q;
  });
  conferirChave(nome, linhas, chave);
  return linhas;
}

/**
 * R01–R22 (mapeamento §4.1). R01 confere que a sessão é de um admin.
 * @param {any} db cliente supabase-js com a sessão aberta
 * @param {string} usuario id do usuário da sessão
 * @returns {Promise<Record<string, Record<string, unknown>[]>>}
 */
export async function lerTudo(db, usuario) {
  const perfil = await db.from("profiles").select("*").eq("id", usuario).single();
  if (perfil.error) throw new Error(`profiles: ${perfil.error.message}`);
  if (perfil.data.role !== "admin") throw new Error("o snapshot pede a sessão de um admin (GATE-05)");
  /** @type {Record<string, Record<string, unknown>[]>} */
  const r = { profiles: [perfil.data] };
  for (const leitura of PAGINADAS) r[leitura.nome] = await lerRelacao(db, leitura);
  r.nps_analises = lista(await db.from("nps_analises").select("*").order("gerado_em", { ascending: false }).limit(1), "nps_analises");
  r.experiencia_adesao = lista(await db.rpc("experiencia_adesao", ADESAO), "experiencia_adesao");
  r.analise_ia_mentor = lista(await db.rpc("analise_ia_mentor"), "analise_ia_mentor");
  r.mentores_ativos = lista(await db.rpc("mentores_ativos"), "mentores_ativos");
  return r;
}

/**
 * Exclui a pasta do Time Machine. Fora do macOS não há o que excluir.
 * @param {string} pasta
 */
function excluirDoTimeMachine(pasta) {
  if (process.platform !== "darwin") return;
  execFileSync("tmutil", ["addexclusion", pasta]);
}

/**
 * Cria a pasta em 0700 ou recusa uma que exista com outro modo; grava em 0600.
 * @param {string} pasta
 * @param {string} nome
 * @param {string} conteudo
 * @param {(pasta: string) => void} [excluirDoBackup]
 * @returns {string} o caminho do arquivo
 */
export function gravarSnapshot(pasta, nome, conteudo, excluirDoBackup = excluirDoTimeMachine) {
  const info = lstatSync(pasta, { throwIfNoEntry: false });
  if (info === undefined) {
    mkdirSync(pasta, { mode: 0o700 });
    chmodSync(pasta, 0o700);
  } else if (!info.isDirectory() || (info.mode & 0o777) !== 0o700) {
    throw new Error(`${pasta} já existe e não é uma pasta 0700: o snapshot não grava nela`);
  }
  excluirDoBackup(pasta);
  const arquivo = join(pasta, nome);
  writeFileSync(arquivo, conteudo, { mode: 0o600 });
  chmodSync(arquivo, 0o600);
  return arquivo;
}

/** @param {Date} agora */
function dataSP(agora) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/**
 * Lê sem eco: o readline escreve cada tecla no `output`, que fica mudo depois
 * da pergunta.
 * @param {string} pergunta
 * @returns {Promise<string>}
 */
export function perguntarSemEco(pergunta) {
  return new Promise((resolve) => {
    let mudo = false;
    const saida = new Writable({
      write(pedaco, _codificacao, pronto) {
        if (!mudo) process.stderr.write(pedaco);
        pronto();
      },
    });
    const rl = createInterface({ input: process.stdin, output: saida, terminal: true });
    rl.on("SIGINT", () => {
      rl.close();
      process.exit(130);
    });
    rl.question(pergunta, (resposta) => {
      rl.close();
      process.stderr.write("\n");
      resolve(resposta);
    });
    mudo = true;
  });
}

/**
 * @param {{
 *   criarCliente?: (url: string, chave: string, opcoes: object) => any,
 *   perguntar?: (pergunta: string) => Promise<string>,
 *   pasta?: string,
 *   agora?: Date,
 *   escrever?: (linha: string) => void,
 *   excluirDoBackup?: (pasta: string) => void,
 * }} [opcoes]
 */
export async function executar({
  criarCliente = createClient,
  perguntar = perguntarSemEco,
  pasta = PASTA,
  agora = new Date(),
  escrever = (linha) => console.log(linha),
  excluirDoBackup = excluirDoTimeMachine,
} = {}) {
  // Antes das perguntas: no Node < 22 o realtime-js lança aqui (sem WebSocket
  // nativo), e a falha não deve vir depois de alguém digitar a senha.
  const db = criarCliente(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const email = (await perguntar("E-mail: ")).trim();
  const senha = await perguntar("Senha: ");
  let falha;
  try {
    const login = await db.auth.signInWithPassword({ email, password: senha });
    if (login.error) throw new Error(`login recusado: ${login.error.message}`);
    const relacoes = await lerTudo(db, login.data.user.id);
    const data = dataSP(agora);
    gravarSnapshot(pasta, `snapshot-${data}.json`, JSON.stringify({ data, relacoes }), excluirDoBackup);
    for (const [nome, linhas] of Object.entries(relacoes)) escrever(`${nome}: ${linhas.length}`);
  } catch (erro) {
    falha = erro;
  }
  // `local` encerra só esta sessão. O padrão (`global`) derrubaria o admin em
  // todo aparelho (auth-js 2.117.3, GoTrueClient.js:3414).
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
