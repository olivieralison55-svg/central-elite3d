import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessaoContexto, type ValorSessao } from "@/components/shell/contexto";
import type { Nota } from "@/lib/data/esquemas";
import type { ResultadoEscrita } from "@/lib/data/escritas";
import type { Capacidade, Papel } from "@/lib/papeis";
import { descarregarPendencias } from "@/lib/sessao";
import { renderTela } from "@/test/render";

import EditorNotas from "./editor-notas";

const RAIZ = fileURLToPath(new URL("../../../../", import.meta.url));

// Sem DOM, o React do vitest `node` não roda efeito nem liga ref. O falso guarda o estado e as refs
// entre renders, na ordem em que o componente os pede, como o React faz, e anota cada useEffect
// para o teste rodar. A primeira ref do editor é a do nó: o teste aponta ela para um elemento falso.
const react = vi.hoisted(() => ({
  valores: [] as unknown[],
  proximo: 0,
  refs: [] as Array<{ current: unknown }>,
  proximaRef: 0,
  efeitos: [] as Array<() => unknown>,
}));
vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  return {
    ...original,
    useState: (inicial: unknown) => {
      const i = react.proximo++;
      if (!(i in react.valores)) react.valores[i] = typeof inicial === "function" ? (inicial as () => unknown)() : inicial;
      const definir = (valor: unknown) => {
        react.valores[i] = typeof valor === "function" ? (valor as (anterior: unknown) => unknown)(react.valores[i]) : valor;
      };
      return [react.valores[i], definir];
    },
    useRef: (inicial: unknown) => {
      const i = react.proximaRef++;
      if (!(i in react.refs)) react.refs[i] = { current: inicial };
      return react.refs[i];
    },
    useEffect: (fn: () => unknown) => {
      react.efeitos.push(fn);
    },
  };
});

const toastErro = vi.hoisted(() => vi.fn());
const toastSucesso = vi.hoisted(() => vi.fn());
vi.mock("react-hot-toast", () => ({ default: { error: toastErro, success: toastSucesso } }));
const sessaoDoCliente = vi.hoisted(() => ({ id: "usuario-admin" }));
vi.mock("@/lib/data/auth", () => ({ usuarioDaSessao: () => Promise.resolve(sessaoDoCliente.id) }));
const lerNota = vi.hoisted(() => vi.fn<(mentoradoId: string, usuarioId: string) => Promise<{ ok: true; dados: Nota | null } | { ok: false; erro: string }>>());
vi.mock("@/lib/data/leituras", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/data/leituras")>()), lerNota }));
const salvarNota = vi.hoisted(() => vi.fn<(mentoradoId: string, conteudo: string, atualizadoEm: string) => Promise<ResultadoEscrita>>());
vi.mock("@/lib/data/escritas", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/data/escritas")>()), salvarNota }));
// O sanitizador de verdade não roda sem DOM (design, componente 11): o falso marca o que limpou,
// ou falta, como num navegador sem suporte. Sem marca, devolve a entrada, como o DOMPurify faz com
// HTML já limpo e com "" (purify.es.mjs:1182).
const sanitizador = vi.hoisted(() => ({ suporte: true, marca: "[limpo]" }));
vi.mock("@/lib/notas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notas")>()),
  sanitizarNota: (html: string) => (sanitizador.suporte ? `${sanitizador.marca}${html}` : null),
}));

const vistos = vi.hoisted(() => [] as Array<{ tipo: string; props: Record<string, unknown> }>);
const gravar = vi.hoisted(() => (tipo: string, props: object) => vistos.push({ tipo, props: { ...props } as Record<string, unknown> }));
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("button", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/input", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/input")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("input", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/dialog", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: { open: boolean; onClose(): void; title?: ReactNode; children: ReactNode }) => {
      gravar("dialog", props);
      return props.open ? createElement("dialog-falso", { "data-titulo": props.title }, props.children) : null;
    },
  };
});

type Ouvinte = (evento: Record<string, unknown>) => void;

// O nó do editor: guarda o HTML e os ouvintes que o efeito liga.
function elementoFalso() {
  const ouvintes = new Map<string, Ouvinte>();
  return {
    innerHTML: "",
    focos: 0,
    ouvintes,
    addEventListener: (tipo: string, fn: Ouvinte) => void ouvintes.set(tipo, fn),
    removeEventListener: (tipo: string, fn: Ouvinte) => {
      if (ouvintes.get(tipo) === fn) ouvintes.delete(tipo);
    },
    dispatchEvent(evento: { type: string } & Record<string, unknown>) {
      ouvintes.get(evento.type)?.(evento);
      return true;
    },
    focus() {
      this.focos++;
    },
  };
}
type Elemento = ReturnType<typeof elementoFalso>;

// O document que o editor usa: a visibilidade, a seleção e os comandos de edição.
const documento = {
  visibilityState: "visible",
  ouvintes: new Map<string, () => void>(),
  comandos: [] as unknown[][],
  selecao: null as unknown,
  addEventListener(tipo: string, fn: () => void) {
    this.ouvintes.set(tipo, fn);
  },
  removeEventListener(tipo: string, fn: () => void) {
    if (this.ouvintes.get(tipo) === fn) this.ouvintes.delete(tipo);
  },
  execCommand(...args: unknown[]) {
    this.comandos.push(args);
    return true;
  },
  getSelection() {
    return this.selecao;
  },
};

function sessaoCom(caps: Set<Capacidade>): ValorSessao {
  const usuario = { id: "usuario-admin", email: "admin@exemplo.com" };
  return { usuario, perfil: { id: usuario.id, role: "admin", nome: "admin", email: usuario.email }, papel: "admin", pode: (cap) => caps.has(cap), sair: () => Promise.resolve() };
}

function render({ papel = "admin", caps }: { papel?: Papel; caps?: Set<Capacidade> } = {}) {
  react.proximo = 0;
  react.proximaRef = 0;
  react.efeitos.length = 0;
  vistos.length = 0;
  sessaoDoCliente.id = `usuario-${papel}`;
  const el = <EditorNotas mentoradoId="m1" />;
  const html = renderTela(caps ? <SessaoContexto.Provider value={sessaoCom(caps)}>{el}</SessaoContexto.Provider> : el, { papel });
  return { html, vistos: [...vistos], efeitos: [...react.efeitos] };
}

// As promessas e os timers de 0 ms que já podem andar.
async function vazar() {
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

const NOTA: Nota = { conteudo: "<h1>Plano</h1><p>texto</p>", atualizado_em: "2026-10-14T12:00:00Z" };
const limpezas: Array<() => void> = [];

// Monta como o React: o render, a ref apontando para o nó e o efeito rodando. Devolve o cleanup.
async function montar({ papel = "admin", caps, nota = NOTA }: { papel?: Papel; caps?: Set<Capacidade>; nota?: Nota | null } = {}) {
  lerNota.mockResolvedValue({ ok: true, dados: nota });
  const primeiro = render({ papel, caps });
  const el = elementoFalso();
  react.refs[0].current = el;
  const cleanup = primeiro.efeitos[0]();
  const limpar = typeof cleanup === "function" ? (cleanup as () => void) : () => undefined;
  limpezas.push(limpar);
  await vazar();
  return { el, limpar, primeiro };
}

const digitarNota = (el: Elemento, html: string) => {
  Object.assign(el, { innerHTML: html });
  el.dispatchEvent({ type: "input" });
};
const salvos = () => salvarNota.mock.calls.map(([, conteudo]) => conteudo);
const botaoDaBarra = (lista: typeof vistos, titulo: string) => lista.find((v) => v.tipo === "button" && v.props["aria-label"] === titulo)?.props;
const chamar = (fn: unknown, ...args: unknown[]) => {
  if (typeof fn !== "function") throw new Error("handler ausente");
  return fn(...args);
};
const editor = (html: string) => html.match(/<div[^>]*role="textbox"[^>]*>[^<]*<\/div>/)?.[0] ?? "";

describe("editor de notas (NOTE-01, NOTE-03, NOTE-05, NOTE-06, NOTE-08, EDGE-04, TEST-03, SEC-06)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-14T15:00:00Z") });
    vi.stubGlobal("document", documento);
    react.valores.length = 0;
    react.refs.length = 0;
    documento.visibilityState = "visible";
    documento.ouvintes.clear();
    documento.comandos.length = 0;
    documento.selecao = null;
    sanitizador.suporte = true;
    sanitizador.marca = "[limpo]";
    lerNota.mockReset();
    salvarNota.mockReset();
    salvarNota.mockResolvedValue({ ok: true, linhas: 1 });
  });
  afterEach(async () => {
    // O cleanup grava o que ficou pendente: a gravação termina aqui, não no teste seguinte.
    for (const limpar of limpezas.splice(0)) limpar();
    await vazar();
    await descarregarPendencias();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  it("TEST-03 e NOTE-02: o JSX do editor não tem filho; o HTML entra pela ref, com a saída do sanitizador, e a leitura vai com o usuário da tela", async () => {
    const { el, primeiro } = await montar();
    expect(editor(primeiro.html)).toMatch(/><\/div>$/);
    expect(primeiro.html).not.toContain("Plano");
    expect(lerNota.mock.calls).toEqual([["m1", "usuario-admin"]]);
    expect(el.innerHTML).toBe("[limpo]<h1>Plano</h1><p>texto</p>");
    const depois = render().html;
    expect(editor(depois)).toMatch(/><\/div>$/);
    expect(depois).not.toContain("Plano");
    expect(depois).toContain("Salvo 14/10/2026, 09:00");
    // Nota que ainda não existe abre vazia, sem "Salvo".
    const vazia = await montar({ nota: null });
    expect(vazia.el.innerHTML).toBe("[limpo]");
  });

  it("NOTE-01 e NOTE-06: admin e mentor editam com a barra; a diretoria lê o conteúdo sanitizado sem barra e sem contentEditable", async () => {
    for (const papel of ["admin", "mentor"] as const) {
      const { limpar } = await montar({ papel });
      const { html } = render({ papel });
      expect(editor(html), papel).toMatch(/contentEditable="true"/i);
      expect(editor(html), papel).toContain('data-escrita="W10"');
      expect(html, papel).toContain('role="toolbar"');
      limpar();
      react.valores.length = 0;
      react.refs.length = 0;
    }
    const { el } = await montar({ papel: "diretoria" });
    expect(el.innerHTML).toBe("[limpo]<h1>Plano</h1><p>texto</p>");
    const { html } = render({ papel: "diretoria" });
    expect(editor(html)).not.toMatch(/contentEditable/i);
    expect(editor(html)).not.toContain("data-escrita");
    expect(html).not.toContain('role="toolbar"');
    expect(html).toContain("Somente leitura para o seu papel.");
    // Sem edição, nada fica ligado: nem ouvinte, nem gravação na saída.
    expect([el.ouvintes.size, documento.ouvintes.size]).toEqual([0, 0]);
    await descarregarPendencias();
    expect(salvarNota).not.toHaveBeenCalled();
  });

  it("NOTE-03: sem sanitizador, Alert, nenhum HTML na tela e nada gravado", async () => {
    sanitizador.suporte = false;
    const { el, primeiro } = await montar();
    expect(lerNota).not.toHaveBeenCalled();
    expect(el.innerHTML).toBe("");
    expect(editor(primeiro.html)).toMatch(/><\/div>$/);
    const { html } = render();
    expect(html).toContain("O editor não abriu com segurança neste navegador");
    expect(html).not.toContain('role="textbox"');
    expect([el.ouvintes.size, documento.ouvintes.size]).toEqual([0, 0]);
    digitarNota(el, "<p>x</p>");
    await vi.advanceTimersByTimeAsync(5000);
    await descarregarPendencias();
    expect(salvarNota).not.toHaveBeenCalled();
  });

  it("NOTE-03: o sanitizador presente que limpa \"\" para \"\", como o DOMPurify, abre o editor sem Alert, com a nota, e grava", async () => {
    // Sem sanitizador é o null; a string vazia é a nota vazia de quem sanitiza.
    sanitizador.marca = "";
    const { el } = await montar();
    expect(lerNota.mock.calls).toEqual([["m1", "usuario-admin"]]);
    expect(el.innerHTML).toBe("<h1>Plano</h1><p>texto</p>");
    const { html } = render();
    expect(html).not.toContain("O editor não abriu com segurança neste navegador");
    expect(editor(html)).toMatch(/contentEditable="true"/i);
    digitarNota(el, "<p>novo</p>");
    await vi.advanceTimersByTimeAsync(1000);
    await vazar();
    expect(salvos()).toEqual(["<p>novo</p>"]);
  });

  it("NOTE-04 e W10: grava 1 s depois da última tecla, o conteúdo sanitizado com o instante da gravação; o aviso diz Editando e depois Salvo", async () => {
    const { el } = await montar();
    digitarNota(el, "<p>a</p>");
    await vi.advanceTimersByTimeAsync(500);
    digitarNota(el, "<p>abc</p>");
    expect(render().html).toContain("Editando…");
    await vi.advanceTimersByTimeAsync(999);
    expect(salvarNota).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vazar();
    expect(salvarNota.mock.calls).toEqual([["m1", "[limpo]<p>abc</p>", "2026-10-14T15:00:01.500Z"]]);
    expect(render().html).toContain("Salvo 14/10/2026, 12:00");
  });

  it("NOTE-05: desmontar com gravação pendente grava o último HTML digitado, sem ler o nó, que já pode estar solto", async () => {
    const { el, limpar } = await montar();
    digitarNota(el, "<p>pendente</p>");
    // O React solta a ref antes do cleanup, e o nó já mudou.
    react.refs[0].current = null;
    Object.assign(el, { innerHTML: "" });
    limpar();
    await vazar();
    expect(salvos()).toEqual(["[limpo]<p>pendente</p>"]);
    expect([el.ouvintes.size, documento.ouvintes.size]).toEqual([0, 0]);
    // O timer do autosave foi cancelado: nada grava de novo depois.
    await vi.advanceTimersByTimeAsync(5000);
    expect(salvarNota).toHaveBeenCalledTimes(1);
  });

  it("NOTE-05: visibilitychange para hidden grava o pendente; para visible, não", async () => {
    const { el } = await montar();
    digitarNota(el, "<p>x</p>");
    chamar(documento.ouvintes.get("visibilitychange"));
    await vazar();
    expect(salvarNota).not.toHaveBeenCalled();
    documento.visibilityState = "hidden";
    chamar(documento.ouvintes.get("visibilitychange"));
    await vazar();
    expect(salvos()).toEqual(["[limpo]<p>x</p>"]);
  });

  it("SEC-06: o descarregar fica em registrarPendencia enquanto o editor está montado: o sair grava a nota antes; desmontado, sai da lista", async () => {
    const { el, limpar } = await montar();
    digitarNota(el, "<p>antes de sair</p>");
    await descarregarPendencias();
    expect(salvos()).toEqual(["[limpo]<p>antes de sair</p>"]);
    limpar();
    digitarNota(el, "<p>depois</p>");
    await descarregarPendencias();
    await vazar();
    expect(salvarNota).toHaveBeenCalledTimes(1);
  });

  it("EDGE-04: o erro do banco vai para o toast e o texto fica no editor", async () => {
    salvarNota.mockResolvedValue({ ok: false, erro: "value too long for type character varying(500000)" });
    const { el } = await montar();
    digitarNota(el, "<p>muito longo</p>");
    await vi.advanceTimersByTimeAsync(1000);
    await vazar();
    expect(toastErro.mock.calls).toEqual([["Notas não salvas: value too long for type character varying(500000)"]]);
    expect(el.innerHTML).toBe("<p>muito longo</p>");
    expect(render().html).toContain("Erro ao salvar");
  });

  it("a barra desenha ícones lucide, sem caractere, e cada botão guarda o rótulo de sempre no aria-label", async () => {
    await montar();
    const { html, vistos: barra } = render();
    const rotulos = barra.filter((v) => v.tipo === "button" && v.props["aria-label"]).map((v) => v.props["aria-label"]);
    expect(rotulos).toEqual(expect.arrayContaining(["Checklist", "Citação", "Link", "Divisor", "Negrito (⌘B)"]));
    for (const icone of ["list-checks", "quote", "link", "minus", "bold", "heading1", "list-ordered"]) expect(html, icone).toContain(`lucide-${icone}`);
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]/u);
    expect(html).not.toContain(">¶<");
  });

  it("a caixa da checklist é CSS (borda e check em SVG), sem ☐ nem ☑", () => {
    const css = readFileSync(`${RAIZ}src/app/globals.css`, "utf8");
    expect(css).toMatch(/\.nota-checklist ul\.checklist > li::before \{\s*content: "";/);
    expect(css).toMatch(/li\.feito::before \{[^}]*background-image: url\("data:image\/svg\+xml/);
    expect(readFileSync(`${RAIZ}src/components/modules/ficha/editor-notas.tsx`, "utf8")).not.toMatch(/[☐☑]/);
  });

  it("NOTE-01: a barra usa os comandos de edição do navegador, sem tirar o foco da seleção, e cada comando agenda a gravação", async () => {
    const { el } = await montar();
    const barra = render().vistos;
    const casos: [string, unknown[]][] = [
      ["Título", ["formatBlock", false, "h1"]],
      ["Seção", ["formatBlock", false, "h3"]],
      ["Negrito (⌘B)", ["bold"]],
      ["Lista", ["insertUnorderedList"]],
      ["Lista numerada", ["insertOrderedList"]],
      ["Citação", ["formatBlock", false, "blockquote"]],
      ["Divisor", ["insertHorizontalRule"]],
    ];
    for (const [titulo, comando] of casos) {
      documento.comandos.length = 0;
      chamar(botaoDaBarra(barra, titulo)?.onClick);
      expect(documento.comandos, titulo).toEqual([comando]);
    }
    expect(el.focos).toBe(casos.length);
    const prevenir = vi.fn();
    chamar(botaoDaBarra(barra, "Negrito (⌘B)")?.onMouseDown, { preventDefault: prevenir });
    expect(prevenir).toHaveBeenCalledTimes(1);
    // Cada comando termina num input: a gravação sai com o HTML do momento.
    Object.assign(el, { innerHTML: "<h1>novo</h1>" });
    chamar(botaoDaBarra(barra, "Título")?.onClick);
    await vi.advanceTimersByTimeAsync(1000);
    await vazar();
    expect(salvos()).toEqual(["[limpo]<h1>novo</h1>"]);
  });

  it("NOTE-07: o atalho no começo do bloco vira o bloco de hoje; fora do começo, nada", async () => {
    const { el } = await montar();
    const teclar = (texto: string, tecla: string, offset = texto.length) => {
      const no = { nodeType: 3, textContent: texto, parentNode: el };
      documento.selecao = { anchorNode: no, anchorOffset: offset };
      documento.comandos.length = 0;
      const prevenir = vi.fn();
      el.dispatchEvent({ type: "keydown", key: tecla, preventDefault: prevenir });
      return { no, prevenir };
    };
    const titulo = teclar("#", " ");
    expect([titulo.prevenir.mock.calls.length, titulo.no.textContent, documento.comandos]).toEqual([1, "", [["formatBlock", false, "h1"]]]);
    expect(teclar("[]", " ").prevenir).toHaveBeenCalledTimes(1);
    expect(documento.comandos).toEqual([["insertUnorderedList"]]);
    const codigo = teclar("```", "Enter");
    expect([codigo.prevenir.mock.calls.length, documento.comandos]).toEqual([1, [["formatBlock", false, "pre"]]]);
    // "#" com mais texto no bloco não está no começo: segue texto.
    const meio = teclar("#titulo", " ", 1);
    expect([meio.prevenir.mock.calls.length, meio.no.textContent, documento.comandos]).toEqual([0, "#titulo", []]);
    expect(teclar("#", "a").prevenir).not.toHaveBeenCalled();
  });

  it("NOTE-02: colar passa pelo sanitizador; texto puro entra como texto", async () => {
    const { el } = await montar();
    const colar = (html: string, texto: string) => {
      const prevenir = vi.fn();
      el.dispatchEvent({ type: "paste", preventDefault: prevenir, clipboardData: { getData: (tipo: string) => (tipo === "text/html" ? html : texto) } });
      return prevenir;
    };
    expect(colar('<b>x</b><img src=x onerror="roubar()">', "x")).toHaveBeenCalledTimes(1);
    expect(documento.comandos).toEqual([["insertHTML", false, '[limpo]<b>x</b><img src=x onerror="roubar()">']]);
    documento.comandos.length = 0;
    colar("", "só texto");
    expect(documento.comandos).toEqual([["insertText", false, "só texto"]]);
  });

  it("NOTE-08: o link é pedido num Dialog e só aceita http(s), aplicado na seleção guardada", async () => {
    await montar();
    const intervalo = { marcado: true };
    const removerTodos = vi.fn();
    const adicionar = vi.fn();
    documento.selecao = { rangeCount: 1, getRangeAt: () => ({ cloneRange: () => intervalo }), removeAllRanges: removerTodos, addRange: adicionar };
    chamar(botaoDaBarra(render().vistos, "Link")?.onClick);
    const aberto = render();
    expect(aberto.html).toContain('<dialog-falso data-titulo="Inserir link">');
    const campo = (lista: typeof vistos) => lista.find((v) => v.tipo === "input" && v.props.id === "nota-link")?.props;
    const inserir = (lista: typeof vistos) => lista.find((v) => v.tipo === "button" && v.props.children === "Inserir link")?.props;
    chamar(campo(aberto.vistos)?.onChange, { target: { value: "javascript:alert(1)" } });
    chamar(inserir(render().vistos)?.onClick);
    expect(render().html).toContain("Use um endereço que comece com http:// ou https://.");
    expect(documento.comandos.some(([nome]) => nome === "createLink")).toBe(false);
    chamar(campo(render().vistos)?.onChange, { target: { value: " https://exemplo.com/doc " } });
    chamar(inserir(render().vistos)?.onClick);
    expect(documento.comandos).toContainEqual(["createLink", false, "https://exemplo.com/doc"]);
    expect([removerTodos.mock.calls.length, adicionar.mock.calls]).toEqual([1, [[intervalo]]]);
    expect(render().html).not.toContain("dialog-falso");
  });

  it("WRITE-08: o W10 pede escreverNotas; tirada a capacidade, a gravação pendente não chega à porta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const caps = new Set<Capacidade>(["escreverNotas"]);
    const { el } = await montar({ caps });
    digitarNota(el, "<p>com</p>");
    await descarregarPendencias();
    expect(salvos()).toEqual(["[limpo]<p>com</p>"]);
    caps.delete("escreverNotas");
    digitarNota(el, "<p>sem</p>");
    await descarregarPendencias();
    await vazar();
    expect(salvos()).toEqual(["[limpo]<p>com</p>"]);
  });
});
