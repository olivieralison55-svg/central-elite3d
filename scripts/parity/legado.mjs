/* Carregador do app antigo para a paridade (GATE-06, design componente 10).
 *
 * Executa o <script> inline de um `index.html` (o do merge-base, extraído por
 * `git show`) pela técnica de tests/ambiente.mjs: recorta o script a partir do
 * marcador de CONFIG, tira o `boot()` e roda o resto com `new Function`, com
 * stubs de DOM e de `location`. O cliente Supabase falso responde do snapshot.
 * Quem lê os dados é o `afterLogin` real, que roda o `loadAll` real: o que cada
 * papel pede é o que o app antigo pede.
 *
 * Os stubs vivem em `globalThis`: uma instância por vez. A seguinte substitui a
 * anterior, que passa a ler um DOM que ninguém mais escreve.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const MARCADOR = "<script>\n/* ================= CONFIG";

/**
 * Grava o `index.html` do merge-base entre `main` e `HEAD` em `destino` (0600) e
 * devolve o sha. É o app antigo que a paridade compara, e ele continua no
 * merge-base depois que a branch apaga o arquivo.
 * @param {{ cwd: string, destino: string, base?: string }} opcoes
 * @returns {{ sha: string, arquivo: string }}
 */
export function indexDoMergeBase({ cwd, destino, base = "main" }) {
  const sha = execFileSync("git", ["merge-base", base, "HEAD"], { cwd, encoding: "utf8" }).trim();
  const html = execFileSync("git", ["show", `${sha}:index.html`], { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(destino, html, { mode: 0o600 });
  return { sha, arquivo: destino };
}

/**
 * O script inline do app, sem o `boot()`.
 * @param {string} html
 */
export function scriptDoApp(html) {
  const texto = html.replace(/\r\n/g, "\n");
  const i = texto.indexOf(MARCADOR);
  const j = texto.indexOf("</script>", i);
  if (i < 0 || j < 0) throw new Error("não localizei o <script> inline do index.html");
  const codigo = texto.slice(i + "<script>".length, j);
  if (!/\nboot\(\);\s*$/.test(codigo)) throw new Error("o script do index.html não termina em boot()");
  return codigo.replace(/\nboot\(\);\s*$/, "\n");
}

/**
 * Cliente supabase-js falso que responde do snapshot. A ordem das linhas é a do
 * snapshot, que foi lido com a ordem de hoje e o desempate da porta (DATA-04):
 * reordenar aqui no JS trocaria a ordem do Postgres pela do `<` (o numeric vem
 * como texto). Escrita não grava nada: fica anotada e volta vazia.
 * @param {Record<string, Record<string, unknown>[]>} relacoes
 * @param {Record<string, unknown>} perfil a linha de `profiles` do usuário da sessão
 */
export function clienteDoSnapshot(relacoes, perfil) {
  /** @type {{ relacao: string, operacao: string }[]} */
  const consultas = [];
  /** @type {{ relacao: string, operacao: string, dados?: unknown }[]} */
  const escritas = [];
  const linhasDe = (/** @type {string} */ relacao) => {
    if (relacao === "profiles") return [perfil];
    const linhas = relacoes[relacao];
    if (!Array.isArray(linhas)) throw new Error(`o snapshot não tem a relação ${relacao}`);
    return linhas;
  };
  const from = (/** @type {string} */ relacao) => {
    consultas.push({ relacao, operacao: "select" });
    /** @type {((linhas: Record<string, unknown>[]) => Record<string, unknown>[])[]} */
    const passos = [];
    let unico = /** @type {null | "single" | "maybeSingle"} */ (null);
    let escrita = false;
    const q = {
      select: () => q,
      order: () => q,
      eq: (/** @type {string} */ coluna, /** @type {unknown} */ valor) => (passos.push((l) => l.filter((x) => x[coluna] === valor)), q),
      in: (/** @type {string} */ coluna, /** @type {unknown[]} */ valores) => (passos.push((l) => l.filter((x) => valores.includes(x[coluna]))), q),
      is: (/** @type {string} */ coluna, /** @type {unknown} */ valor) => (passos.push((l) => l.filter((x) => x[coluna] === valor)), q),
      range: (/** @type {number} */ de, /** @type {number} */ ate) => (passos.push((l) => l.slice(de, ate + 1)), q),
      limit: (/** @type {number} */ n) => (passos.push((l) => l.slice(0, n)), q),
      single: () => ((unico = "single"), q),
      maybeSingle: () => ((unico = "maybeSingle"), q),
      ...Object.fromEntries(
        ["insert", "update", "upsert", "delete"].map((operacao) => [
          operacao,
          (/** @type {unknown} */ dados) => {
            escrita = true;
            escritas.push({ relacao, operacao, dados });
            return q;
          },
        ]),
      ),
      then(/** @type {(r: unknown) => unknown} */ resolver, /** @type {(e: unknown) => unknown} */ rejeitar) {
        try {
          if (escrita) return Promise.resolve(resolver({ data: [], error: null }));
          const linhas = passos.reduce((l, passo) => passo(l), linhasDe(relacao));
          if (unico === null) return Promise.resolve(resolver({ data: linhas, error: null }));
          if (linhas.length > 1 || (unico === "single" && linhas.length === 0)) {
            return Promise.resolve(resolver({ data: null, error: { message: `${relacao}: ${linhas.length} linhas para .${unico}()` } }));
          }
          return Promise.resolve(resolver({ data: linhas[0] ?? null, error: null }));
        } catch (erro) {
          return Promise.reject(erro).catch(rejeitar);
        }
      },
    };
    return q;
  };
  const db = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: perfil.id } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signOut: async () => ({ error: null }),
    },
    from,
    rpc: async (/** @type {string} */ nome) => {
      consultas.push({ relacao: `rpc:${nome}`, operacao: "rpc" });
      return { data: linhasDe(nome), error: null };
    },
  };
  return { db, consultas, escritas };
}

/**
 * Um nó do DOM falso por seletor: guarda o `innerHTML` que o app atribui.
 * @param {Map<string, any>} nos
 * @param {string} chave
 */
function no(nos, chave) {
  if (nos.has(chave)) return nos.get(chave);
  const el = {
    _chave: chave,
    style: {},
    dataset: {},
    className: "",
    isConnected: true,
    textContent: "",
    innerHTML: "",
    value: "",
    checked: false,
    disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {},
    getAttribute: () => null,
    focus() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    dispatchEvent() {},
    querySelector: () => no(nos, chave + " *"),
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
  };
  nos.set(chave, el);
  return el;
}

/**
 * Carrega o app antigo com os dados do snapshot, no papel pedido, e espera o
 * `loadAll` terminar. `avaliar` lê qualquer símbolo do script (estado e funções)
 * no escopo dele, como o app os vê.
 * @param {{ arquivo: string, relacoes: Record<string, Record<string, unknown>[]>, papel: "admin" | "diretoria" | "mentor" }} opcoes
 */
export async function carregarLegado({ arquivo, relacoes, papel }) {
  const codigo = scriptDoApp(readFileSync(arquivo, "utf8"));
  const perfil = { id: `paridade-${papel}`, role: papel, nome: "Paridade", email: `paridade-${papel}@example.invalid` };
  const cliente = clienteDoSnapshot(relacoes, perfil);
  /** @type {Map<string, any>} */
  const nos = new Map();
  /** @type {Map<string, (() => void)[]>} */
  const ouvintes = new Map();
  let hash = "";
  const g = /** @type {any} */ (globalThis);
  g.document = {
    querySelector: (/** @type {string} */ sel) => no(nos, sel),
    getElementById: (/** @type {string} */ id) => no(nos, "#" + id),
    querySelectorAll: () => [],
    createElement: () => no(nos, "__criado__" + nos.size),
    documentElement: {},
    body: { appendChild() {} },
    addEventListener() {},
  };
  g.getComputedStyle = () => ({ getPropertyValue: () => "" });
  g.Event = class {
    /** @param {string} tipo */
    constructor(tipo) {
      this.type = tipo;
    }
  };
  g.KeyboardEvent = g.Event;
  g.confirm = () => false;
  g.alert = () => undefined;
  g.supabase = { createClient: () => cliente.db };
  g.addEventListener = (/** @type {string} */ evento, /** @type {() => void} */ fn) => {
    ouvintes.set(evento, [...(ouvintes.get(evento) ?? []), fn]);
  };
  g.location = {
    get hash() {
      return hash;
    },
    set hash(/** @type {string} */ valor) {
      const novo = valor.startsWith("#") ? valor : "#" + valor;
      if (novo === hash) return;
      hash = novo;
      for (const fn of ouvintes.get("hashchange") ?? []) fn();
    },
  };
  g.window = globalThis;
  g.innerWidth = 1280;
  g.innerHeight = 800;

  /** @type {(expressao: string) => any} */
  const avaliar = new Function(`${codigo}\n;return (expressao) => eval(expressao);`)();
  await avaliar("afterLogin")({ user: { id: perfil.id } });
  if (!avaliar("dadosProntos")) throw new Error(`o loadAll do app antigo não terminou (${papel})`);
  return {
    avaliar,
    consultas: cliente.consultas,
    escritas: cliente.escritas,
    /** O HTML que o app pôs num seletor. */
    tela: (sel = "#app") => (nos.has(sel) ? nos.get(sel).innerHTML : ""),
    /** Navega pelo hash, como o link do menu. */
    navegar: (/** @type {string} */ destino) => {
      g.location.hash = destino;
    },
  };
}
