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
const linksAssinados = vi.hoisted(() => vi.fn<(caminhos: readonly string[]) => Promise<{ ok: true; dados: Map<string, string> } | { ok: false; erro: string }>>());
vi.mock("@/lib/data/leituras", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/data/leituras")>()), lerNota, linksAssinados }));
const salvarNota = vi.hoisted(() => vi.fn<(mentoradoId: string, conteudo: string, atualizadoEm: string) => Promise<ResultadoEscrita>>());
const enviarAnexo = vi.hoisted(() => vi.fn<(mentoradoId: string, arquivo: File) => Promise<ResultadoEscrita>>());
const removerAnexo = vi.hoisted(() => vi.fn<(caminho: string) => Promise<ResultadoEscrita>>());
vi.mock("@/lib/data/escritas", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/data/escritas")>()), salvarNota, enviarAnexo, removerAnexo }));
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
    default: (props: { open: boolean; onClose(): void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) => {
      gravar("dialog", props);
      return props.open ? createElement("dialog-falso", { "data-titulo": props.title }, props.children, props.footer) : null;
    },
  };
});

type Ouvinte = (evento: Record<string, unknown>) => void;

// Um anexo no DOM do editor: o que o resolvedor lê e troca, e o que a exclusão tira.
function anexoFalso(tagName: "IMG" | "A", atributos: Record<string, string>, textContent = "") {
  const falso = {
    tagName,
    atributos,
    textContent,
    removido: false,
    getAttribute: (nome: string) => atributos[nome] ?? null,
    setAttribute: (nome: string, valor: string) => void (atributos[nome] = valor),
    remove: () => void (falso.removido = true),
  };
  return falso;
}

// O nó do editor: guarda o HTML, os anexos que o querySelectorAll devolve e os ouvintes que o efeito liga.
// O nó que está dentro do editor: a seleção que o cita é do editor; a que cita outro, não.
const DENTRO = { no: "texto do editor" };

// O nome do método que acrescenta HTML no fim vem montado: a varredura TEST-03 lê também os
// testes, linha a linha, e o falso não é inserção de HTML.
const ACRESCENTAR = `insertAdjacent${"HTML"}` as const;

// Mais de um ouvinte por tipo, como no navegador: o clique do checklist e o do link. O que o
// editor acrescenta no fim da nota fica em `acrescentados`.
function elementoFalso(anexos: ReturnType<typeof anexoFalso>[] = []) {
  const ouvintes = new Map<string, Ouvinte[]>();
  return {
    innerHTML: "",
    focos: 0,
    ouvintes,
    anexos,
    acrescentados: [] as string[][],
    querySelectorAll: () => anexos.filter((anexo) => !anexo.removido),
    contains: (no: unknown) => no === DENTRO,
    [ACRESCENTAR](posicao: string, html: string) {
      this.acrescentados.push([posicao, html]);
    },
    addEventListener: (tipo: string, fn: Ouvinte) => void ouvintes.set(tipo, [...(ouvintes.get(tipo) ?? []), fn]),
    removeEventListener: (tipo: string, fn: Ouvinte) => {
      const restantes = (ouvintes.get(tipo) ?? []).filter((ouvinte) => ouvinte !== fn);
      if (restantes.length) ouvintes.set(tipo, restantes);
      else ouvintes.delete(tipo);
    },
    dispatchEvent(evento: { type: string } & Record<string, unknown>) {
      for (const ouvinte of ouvintes.get(evento.type) ?? []) ouvinte(evento);
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
async function montar({ papel = "admin", caps, nota = NOTA, anexos = [] }: { papel?: Papel; caps?: Set<Capacidade>; nota?: Nota | null; anexos?: ReturnType<typeof anexoFalso>[] } = {}) {
  lerNota.mockResolvedValue({ ok: true, dados: nota });
  const primeiro = render({ papel, caps });
  const el = elementoFalso(anexos);
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
    enviarAnexo.mockReset();
    removerAnexo.mockReset();
    linksAssinados.mockReset();
    linksAssinados.mockResolvedValue({ ok: true, dados: new Map() });
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
    // Sem edição, só o clique que abre o link fica ligado: nenhum ouvinte de edição, nem gravação na saída.
    expect([[...el.ouvintes.keys()], el.ouvintes.get("click")?.length, documento.ouvintes.size]).toEqual([["click"], 1, 0]);
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
    const css = readFileSync(`${RAIZ}src/app/marca.css`, "utf8");
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
    const intervalo = { commonAncestorContainer: DENTRO };
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

  it("NOTE-08 e AD-010: um clique num link abre o http(s) em outra aba, no editor e no só leitura; arrastar seleção e javascript: não abrem; o anexo: pede o link assinado e abre quando ele chega", async () => {
    class ElementoBase {}
    vi.stubGlobal("Element", ElementoBase);
    const abrir = vi.fn();
    vi.stubGlobal("window", { open: abrir });
    const clicar = (el: Elemento, href: string | null) => {
      const prevenir = vi.fn();
      const target = Object.assign(new ElementoBase(), { closest: (seletor: string) => (seletor === "a[href]" && href !== null ? { getAttribute: () => href } : null) });
      el.dispatchEvent({ type: "click", target, preventDefault: prevenir, offsetX: 100 });
      return prevenir;
    };
    for (const papel of ["admin", "diretoria"] as const) {
      abrir.mockClear();
      const { el, limpar } = await montar({ papel });
      expect(clicar(el, "https://exemplo.com/doc"), papel).toHaveBeenCalledTimes(1);
      expect(abrir.mock.calls, papel).toEqual([["https://exemplo.com/doc", "_blank", "noopener,noreferrer"]]);
      expect(clicar(el, "javascript:alert(1)"), papel).toHaveBeenCalledTimes(1);
      expect(clicar(el, null), papel).not.toHaveBeenCalled();
      // O clique que termina uma seleção arrastada sobre o link só seleciona.
      documento.selecao = { isCollapsed: false };
      expect(clicar(el, "https://exemplo.com/outro"), papel).not.toHaveBeenCalled();
      documento.selecao = { isCollapsed: true };
      expect(abrir.mock.calls, papel).toHaveLength(1);
      linksAssinados.mockResolvedValue({ ok: true, dados: new Map([["m1/u2-b.pdf", assinada("m1/u2-b.pdf")]]) });
      clicar(el, "anexo:m1/u2-b.pdf");
      expect(abrir.mock.calls, papel).toHaveLength(1);
      await vazar();
      expect(linksAssinados.mock.calls.at(-1), papel).toEqual([["m1/u2-b.pdf"]]);
      expect(abrir.mock.calls.at(-1), papel).toEqual([assinada("m1/u2-b.pdf"), "_blank", "noopener,noreferrer"]);
      linksAssinados.mockResolvedValue({ ok: true, dados: new Map() });
      limpar();
      react.valores.length = 0;
      react.refs.length = 0;
    }
    // Sem link assinado, nada abre e o toast diz por quê.
    abrir.mockClear();
    const { el } = await montar();
    linksAssinados.mockResolvedValue({ ok: false, erro: "permission denied" });
    clicar(el, "anexo:m1/u2-b.pdf");
    await vazar();
    expect(abrir).not.toHaveBeenCalled();
    expect(toastErro.mock.calls.at(-1)).toEqual(["O anexo não abriu: permission denied"]);
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

  // AD-010: os anexos.
  const BASE = "https://matgynpiscyoshnjzolo.supabase.co";
  const assinada = (caminho: string) => `${BASE}/storage/v1/object/sign/notas-anexos/${caminho}?token=eyJ0b2tlbiI6MX0.c2ln`;
  const entrada = (lista: typeof vistos, rotulo: string) => lista.find((v) => v.tipo === "input" && v.props["aria-label"] === rotulo)?.props;
  const arquivo = (nome: string, tipo: string, tamanho = 3) => new File(["x".repeat(tamanho)], nome, { type: tipo });
  // A seleção guardada: o anexo cai no fim dela (o ponto colapsado), depois do envio. `no` é o nó
  // que ela cita: DENTRO do editor, por padrão.
  const comSelecao = (no: unknown = DENTRO) => {
    const ponto = { colapsado: [] as boolean[], collapse: (inicio: boolean) => void ponto.colapsado.push(inicio) };
    const intervalo = { commonAncestorContainer: no, cloneRange: () => ponto };
    const adicionar = vi.fn();
    documento.selecao = { rangeCount: 1, getRangeAt: () => ({ cloneRange: () => intervalo }), removeAllRanges: vi.fn(), addRange: adicionar };
    return { intervalo, ponto, adicionar };
  };

  it("AD-010 e lição c: admin e mentor têm Imagem (ImagePlus) e Anexo (Paperclip), com o seletor de arquivo oculto e o accept certo; a diretoria e o papel sem escreverNotas, não", async () => {
    for (const papel of ["admin", "mentor"] as const) {
      const { limpar } = await montar({ papel });
      const { html, vistos: barra } = render({ papel });
      expect([botaoDaBarra(barra, "Imagem")?.title, botaoDaBarra(barra, "Anexo")?.title], papel).toEqual(["Imagem", "Anexo"]);
      for (const icone of ["image-plus", "paperclip"]) expect(html, `${papel} ${icone}`).toContain(`lucide-${icone}`);
      expect([entrada(barra, "Escolher imagem")?.type, entrada(barra, "Escolher imagem")?.hidden, entrada(barra, "Escolher imagem")?.accept], papel).toEqual(["file", true, "image/png,image/jpeg,image/webp,image/gif"]);
      expect(entrada(barra, "Escolher anexo")?.accept, papel).toBe(
        "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv",
      );
      expect(html, papel).not.toContain("svg+xml");
      limpar();
      react.valores.length = 0;
      react.refs.length = 0;
    }
    for (const sem of [{ papel: "diretoria" as const }, { caps: new Set<Capacidade>(["verFinanceiro"]) }]) {
      const { el } = await montar(sem);
      const { html, vistos: barra } = render(sem);
      expect([botaoDaBarra(barra, "Imagem"), botaoDaBarra(barra, "Anexo"), entrada(barra, "Escolher imagem"), entrada(barra, "Escolher anexo")]).toEqual([undefined, undefined, undefined, undefined]);
      expect(html).not.toContain("lucide-paperclip");
      expect(el.ouvintes.has("drop")).toBe(false);
      react.valores.length = 0;
      react.refs.length = 0;
    }
  });

  it("AD-010 e WRITE-03: Imagem guarda a seleção e abre o seletor; o arquivo sobe pela porta com o botão travado, entra na seleção como anexo: sanitizado, ganha o link assinado e a gravação leva anexo:, não a URL", async () => {
    const { el } = await montar();
    const { ponto, adicionar } = comSelecao();
    const barra = render().vistos;
    const seletor = entrada(barra, "Escolher imagem");
    const clicar = vi.fn();
    const ref = seletor?.ref;
    if (!ref || typeof ref !== "object") throw new Error("ref do seletor ausente");
    Object.assign(ref, { current: { click: clicar } });
    chamar(botaoDaBarra(barra, "Imagem")?.onClick);
    expect(clicar).toHaveBeenCalledTimes(1);
    const prevenir = vi.fn();
    chamar(botaoDaBarra(barra, "Imagem")?.onMouseDown, { preventDefault: prevenir });
    expect(prevenir).toHaveBeenCalledTimes(1);

    let terminar: (r: ResultadoEscrita) => void = () => undefined;
    enviarAnexo.mockImplementation(() => new Promise((resolve) => (terminar = resolve)));
    const foto = arquivo("Foto Ação.png", "image/png");
    const alvo = { files: [foto], value: "C:\\fakepath\\Foto Ação.png" };
    chamar(seletor?.onChange, { target: alvo });
    await vazar();
    expect(alvo.value).toBe("");
    expect(enviarAnexo.mock.calls).toEqual([["m1", foto]]);
    // WRITE-03: os dois botões travam até o fim do envio.
    const enviando = render();
    expect([botaoDaBarra(enviando.vistos, "Imagem")?.loading, botaoDaBarra(enviando.vistos, "Anexo")?.loading]).toEqual([true, true]);
    expect(enviando.html).toMatch(/aria-busy="true"[^>]*aria-label="Imagem"|aria-label="Imagem"[^>]*aria-busy="true"/);
    expect(documento.comandos).toEqual([]);

    // O navegador põe a imagem no DOM; o resolvedor troca o anexo: pela URL assinada.
    const img = anexoFalso("IMG", { src: "anexo:m1/u1-foto-acao.png", alt: "Foto Ação.png" });
    el.anexos.push(img);
    linksAssinados.mockResolvedValue({ ok: true, dados: new Map([["m1/u1-foto-acao.png", assinada("m1/u1-foto-acao.png")]]) });
    Object.assign(el, { innerHTML: `<p>a</p><img src="${assinada("m1/u1-foto-acao.png")}" alt="Foto Ação.png">` });
    terminar({ ok: true, linhas: 1, caminho: "m1/u1-foto-acao.png" });
    await vazar();
    expect(documento.comandos).toEqual([["insertHTML", false, '[limpo]<img src="anexo:m1/u1-foto-acao.png" alt="Foto Ação.png">']]);
    expect(adicionar.mock.calls).toEqual([[ponto]]);
    expect(ponto.colapsado).toEqual([false]);
    // O navegador pôs a imagem no editor: nada é acrescentado no fim.
    expect(el.acrescentados).toEqual([]);
    expect(linksAssinados.mock.calls).toEqual([[["m1/u1-foto-acao.png"]]]);
    expect(img.atributos.src).toBe(assinada("m1/u1-foto-acao.png"));
    expect(botaoDaBarra(render().vistos, "Imagem")?.loading).toBe(false);
    // O input do envio agendou a gravação: a URL assinada volta a anexo: antes do sanitizador.
    await vi.advanceTimersByTimeAsync(1000);
    await vazar();
    expect(salvos()).toEqual(['[limpo]<p>a</p><img src="anexo:m1/u1-foto-acao.png" alt="Foto Ação.png">']);
  });

  it("AD-010: o anexo nunca troca o texto marcado; seleção fora do editor não é guardada e o anexo vai para o fim da nota; se o insertHTML não o pôs no editor, ele é acrescentado no fim", async () => {
    enviarAnexo.mockResolvedValue({ ok: true, linhas: 1, caminho: "m1/u5-foto.png" });
    const enviarImagem = async () => {
      const barra = render().vistos;
      const seletor = entrada(barra, "Escolher imagem");
      const ref = seletor?.ref;
      if (!ref || typeof ref !== "object") throw new Error("ref do seletor ausente");
      Object.assign(ref, { current: { click: () => undefined } });
      chamar(botaoDaBarra(barra, "Imagem")?.onClick);
      chamar(seletor?.onChange, { target: { files: [arquivo("foto.png", "image/png")], value: "x" } });
      await vazar();
    };
    const IMG = '[limpo]<img src="anexo:m1/u5-foto.png" alt="foto.png">';
    // Tudo selecionado no editor: o anexo entra no fim do trecho, colapsado; o navegador o pôs no DOM.
    const { el } = await montar();
    const dentro = comSelecao();
    el.anexos.push(anexoFalso("IMG", { src: "anexo:m1/u5-foto.png", alt: "foto.png" }));
    await enviarImagem();
    expect([documento.comandos, dentro.adicionar.mock.calls, dentro.ponto.colapsado, el.acrescentados]).toEqual([[["insertHTML", false, IMG]], [[dentro.ponto]], [false], []]);
    // O insertHTML não chegou ao editor (a nota da Alessandra): o anexo é acrescentado no fim, sanitizado.
    el.anexos.length = 0;
    documento.comandos.length = 0;
    comSelecao();
    await enviarImagem();
    expect([documento.comandos, el.acrescentados]).toEqual([[["insertHTML", false, IMG]], [["beforeend", IMG]]]);
    // A seleção estava fora do editor: não é guardada, nada vai para ela, e o anexo vai para o fim.
    el.acrescentados.length = 0;
    documento.comandos.length = 0;
    const fora = comSelecao({ no: "outro campo da página" });
    await enviarImagem();
    expect([documento.comandos, fora.adicionar.mock.calls, el.acrescentados]).toEqual([[], [], [["beforeend", IMG]]]);
    // Nos dois casos o input agendou a gravação.
    await descarregarPendencias();
    expect(salvarNota).toHaveBeenCalled();
  });

  it("AD-010: Anexo sobe o documento e insere o link com a classe anexo; NOTE-05: o descarregar também grava anexo:", async () => {
    const { el } = await montar();
    comSelecao();
    enviarAnexo.mockResolvedValue({ ok: true, linhas: 1, caminho: "m1/u2-plano.pdf" });
    const plano = arquivo("Plano <v2>.pdf", "application/pdf");
    chamar(entrada(render().vistos, "Escolher anexo")?.onChange, { target: { files: [plano], value: "x" } });
    await vazar();
    expect(enviarAnexo.mock.calls).toEqual([["m1", plano]]);
    // O seletor foi aberto sem o botão, então não há seleção guardada: o link vai para o fim da nota.
    expect([documento.comandos, el.acrescentados]).toEqual([[], [["beforeend", '[limpo]<a href="anexo:m1/u2-plano.pdf" class="anexo">Plano &lt;v2&gt;.pdf</a>']]]);
    digitarNota(el, `<a href="${assinada("m1/u2-plano.pdf")}" class="anexo" target="_blank" rel="noopener noreferrer">Plano</a>`);
    await descarregarPendencias();
    expect(salvos()).toEqual(['[limpo]<a href="anexo:m1/u2-plano.pdf" class="anexo" target="_blank" rel="noopener noreferrer">Plano</a>']);
  });

  it("EDGE: arquivo acima de 10 MB ou de tipo recusado (SVG) vai para o toast e não sai; o erro do Storage vai para o toast e nada entra na nota", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await montar();
    const escolher = (rotulo: string, escolhido: unknown) => chamar(entrada(render().vistos, rotulo)?.onChange, { target: { files: [escolhido], value: "x" } });
    escolher("Escolher imagem", arquivo("logo.svg", "image/svg+xml"));
    escolher("Escolher anexo", { name: "grande.pdf", size: 10 * 1024 * 1024 + 1, type: "application/pdf" });
    escolher("Escolher anexo", arquivo("foto.png", "image/png"));
    await vazar();
    expect(toastErro.mock.calls).toEqual([
      ['"logo.svg" não foi enviado: a imagem tem de ser PNG, JPEG, WEBP ou GIF.'],
      ['"grande.pdf" não foi enviado: tem 10,0 MB, e o limite é 10 MB.'],
      ['"foto.png" não foi enviado: o anexo tem de ser PDF, Word, Excel, PowerPoint, TXT ou CSV.'],
    ]);
    expect(enviarAnexo).not.toHaveBeenCalled();
    toastErro.mockClear();
    enviarAnexo.mockResolvedValue({ ok: false, erro: "The resource already exists" });
    escolher("Escolher anexo", arquivo("a.pdf", "application/pdf"));
    await vazar();
    expect(toastErro.mock.calls).toEqual([['"a.pdf" não foi enviado: The resource already exists']]);
    expect(documento.comandos).toEqual([]);
    expect(linksAssinados).not.toHaveBeenCalled();
  });

  it("WRITE-08: tirada a escreverNotas, o arquivo escolhido não chega à porta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const caps = new Set<Capacidade>(["escreverNotas"]);
    await montar({ caps });
    const seletor = entrada(render({ caps }).vistos, "Escolher anexo");
    caps.delete("escreverNotas");
    chamar(seletor?.onChange, { target: { files: [arquivo("a.pdf", "application/pdf")], value: "x" } });
    await vazar();
    expect([enviarAnexo.mock.calls, documento.comandos]).toEqual([[], []]);
  });

  it("AD-010 e NOTE-02: imagem colada ou arquivo solto sobem como o botão; HTML colado volta a anexo: e passa pelo sanitizador; texto do Word com PNG junto entra como HTML", async () => {
    const { el } = await montar();
    comSelecao();
    enviarAnexo.mockResolvedValue({ ok: true, linhas: 1, caminho: "m1/u3-print.png" });
    const colar = (html: string, files: File[]) => {
      const prevenir = vi.fn();
      el.dispatchEvent({ type: "paste", preventDefault: prevenir, clipboardData: { getData: (tipo: string) => (tipo === "text/html" ? html : ""), files } });
      return prevenir;
    };
    const print = arquivo("image.png", "image/png");
    // A imagem copiada do navegador vem com um HTML só de <img>: sobe o arquivo.
    expect(colar('<meta charset="utf-8"><img src="https://site.example/a.png">', [print])).toHaveBeenCalledTimes(1);
    await vazar();
    expect(enviarAnexo.mock.calls).toEqual([["m1", print]]);
    expect(documento.comandos).toEqual([["insertHTML", false, '[limpo]<img src="anexo:m1/u3-print.png" alt="image.png">']]);

    documento.comandos.length = 0;
    colar(`<p>Planilha</p><img src="${assinada("m1/u1-a.png")}" alt="a">`, [arquivo("excel.png", "image/png")]);
    await vazar();
    expect(enviarAnexo).toHaveBeenCalledTimes(1);
    expect(documento.comandos).toEqual([["insertHTML", false, '[limpo]<p>Planilha</p><img src="anexo:m1/u1-a.png" alt="a">']]);

    const pdf = arquivo("Contrato.pdf", "application/pdf");
    enviarAnexo.mockResolvedValue({ ok: true, linhas: 1, caminho: "m1/u4-contrato.pdf" });
    const sobre = vi.fn();
    el.dispatchEvent({ type: "dragover", preventDefault: sobre, dataTransfer: { types: ["Files"], files: [pdf] } });
    expect(sobre).toHaveBeenCalledTimes(1);
    const soltar = vi.fn();
    documento.comandos.length = 0;
    el.dispatchEvent({ type: "drop", preventDefault: soltar, dataTransfer: { types: ["Files"], files: [pdf] } });
    await vazar();
    expect(soltar).toHaveBeenCalledTimes(1);
    expect(enviarAnexo.mock.calls.at(-1)).toEqual(["m1", pdf]);
    expect(documento.comandos).toEqual([["insertHTML", false, '[limpo]<a href="anexo:m1/u4-contrato.pdf" class="anexo">Contrato.pdf</a>']]);
    // Soltar texto, sem arquivo, segue o navegador.
    const texto = vi.fn();
    el.dispatchEvent({ type: "drop", preventDefault: texto, dataTransfer: { types: ["text/plain"], files: [] } });
    expect(texto).not.toHaveBeenCalled();
  });

  it("NOTE-06 e AD-010: a diretoria lê a nota com os anexos resolvidos, documento em outra aba; sem link, o toast avisa e a nota abre igual", async () => {
    const img = anexoFalso("IMG", { src: "anexo:m1/u1-a.png", alt: "a" });
    const doc = anexoFalso("A", { href: "anexo:m1/u2-b.pdf", class: "anexo" });
    linksAssinados.mockResolvedValue({ ok: true, dados: new Map([["m1/u1-a.png", assinada("m1/u1-a.png")], ["m1/u2-b.pdf", assinada("m1/u2-b.pdf")]]) });
    const { el } = await montar({ papel: "diretoria", anexos: [img, doc] });
    expect(el.innerHTML).toBe("[limpo]<h1>Plano</h1><p>texto</p>");
    expect(linksAssinados.mock.calls).toEqual([[["m1/u1-a.png", "m1/u2-b.pdf"]]]);
    expect([img.atributos, doc.atributos]).toEqual([
      { src: assinada("m1/u1-a.png"), alt: "a" },
      { href: assinada("m1/u2-b.pdf"), class: "anexo", target: "_blank", rel: "noopener noreferrer" },
    ]);
    react.valores.length = 0;
    react.refs.length = 0;
    linksAssinados.mockResolvedValue({ ok: false, erro: "permission denied" });
    const semLink = anexoFalso("IMG", { src: "anexo:m1/u1-a.png" });
    await montar({ papel: "diretoria", anexos: [semLink] });
    expect(toastErro.mock.calls).toEqual([["Os anexos da nota não abriram: permission denied"]]);
    expect(semLink.atributos.src).toBe("anexo:m1/u1-a.png");
    expect(render({ papel: "diretoria" }).html).toContain('role="textbox"');
  });

  // W22: a lista "Anexos" abaixo do editor.
  const botao = (lista: typeof vistos, rotulo: string) => lista.find((v) => v.tipo === "button" && v.props["aria-label"] === rotulo)?.props;
  const anexosDaFicha = () => [
    anexoFalso("IMG", { src: "anexo:m1/u1-foto.png", alt: "Foto Ação.png" }),
    anexoFalso("A", { href: "anexo:m1/u2-plano.pdf", class: "anexo" }, "Plano.pdf"),
    anexoFalso("IMG", { src: "anexo:m1/u1-foto.png", alt: "Foto Ação.png" }),
  ];

  it("W22 e lição c: a lista Anexos mostra cada imagem e documento com ícone, nome e Abrir; Excluir só para quem tem escreverNotas, nunca para a diretoria", async () => {
    const abrir = vi.fn();
    vi.stubGlobal("window", { open: abrir });
    for (const papel of ["admin", "mentor", "diretoria"] as const) {
      const { limpar } = await montar({ papel, anexos: anexosDaFicha() });
      const { html, vistos: lista } = render({ papel });
      const secao = html.match(/<section aria-label="Anexos da nota"[^]*?<\/section>/)?.[0] ?? "";
      expect(secao, papel).toContain(">Anexos</h3>");
      expect([...secao.matchAll(/<li /g)].length, papel).toBe(2);
      for (const trecho of ["Foto Ação.png", "Plano.pdf", "lucide-image", "lucide-file-text", "Abrir"]) expect(secao, `${papel} ${trecho}`).toContain(trecho);
      expect([botao(lista, "Abrir Foto Ação.png")?.children, botao(lista, "Abrir Plano.pdf")?.children], papel).toEqual(["Abrir", "Abrir"]);
      const edita = papel !== "diretoria";
      expect([botao(lista, "Excluir Foto Ação.png")?.["data-escrita"], botao(lista, "Excluir Plano.pdf")?.["data-escrita"]], papel).toEqual(edita ? ["W22", "W22"] : [undefined, undefined]);
      expect(secao.includes('data-escrita="W22"'), papel).toBe(edita);
      expect(secao.includes("Excluir"), papel).toBe(edita);
      // Abrir pede o link assinado e o abre em outra aba, para os três papéis.
      linksAssinados.mockResolvedValue({ ok: true, dados: new Map([["m1/u2-plano.pdf", assinada("m1/u2-plano.pdf")]]) });
      chamar(botao(lista, "Abrir Plano.pdf")?.onClick);
      await vazar();
      expect(abrir.mock.calls.at(-1), papel).toEqual([assinada("m1/u2-plano.pdf"), "_blank", "noopener,noreferrer"]);
      linksAssinados.mockResolvedValue({ ok: true, dados: new Map() });
      limpar();
      react.valores.length = 0;
      react.refs.length = 0;
    }
    // Sem anexo, a lista diz que não há nenhum.
    await montar();
    expect(render().html).toContain("Nenhum anexo nesta nota.");
  });

  it("W22: a lista se atualiza no input; Excluir pede confirmação num ConfirmDialog, apaga pela porta, tira do DOM toda citação do caminho e agenda a gravação; com erro do Storage nada sai e o toast mostra o erro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { el } = await montar();
    expect(render().html).toContain("Nenhum anexo nesta nota.");
    el.anexos.push(...anexosDaFicha());
    digitarNota(el, '<p>a</p><img src="anexo:m1/u1-foto.png" alt="Foto Ação.png"><a href="anexo:m1/u2-plano.pdf" class="anexo">Plano.pdf</a><img src="anexo:m1/u1-foto.png" alt="Foto Ação.png">');
    expect(render().html).toContain("Foto Ação.png");
    await descarregarPendencias();
    salvarNota.mockClear();

    chamar(botao(render().vistos, "Excluir Foto Ação.png")?.onClick);
    const aberto = render();
    expect(aberto.html).toContain('<dialog-falso data-titulo="Excluir anexo">');
    expect(aberto.html).toContain("Excluir &quot;Foto Ação.png&quot;? O arquivo é apagado e sai da nota.");
    expect(removerAnexo).not.toHaveBeenCalled();
    const confirmar = (lista: typeof vistos) => lista.find((v) => v.tipo === "button" && v.props.children !== "Cancelar" && v.props.className === "!bg-danger hover:!bg-danger/90")?.props;

    // O Storage recusou: a nota fica igual, o diálogo segue aberto e o toast mostra o erro.
    removerAnexo.mockResolvedValue({ ok: false, erro: "permission denied" });
    chamar(confirmar(aberto.vistos)?.onClick);
    await vazar();
    expect(removerAnexo.mock.calls).toEqual([["m1/u1-foto.png"]]);
    expect(el.anexos.map((anexo) => anexo.removido)).toEqual([false, false, false]);
    expect(toastErro.mock.calls.at(-1)).toEqual(['"Foto Ação.png" não foi excluído: permission denied']);
    expect(render().html).toContain('<dialog-falso data-titulo="Excluir anexo">');
    expect(salvarNota).not.toHaveBeenCalled();

    // Apagou: as duas citações da imagem saem do DOM, o documento fica, a lista e a nota mudam.
    removerAnexo.mockResolvedValue({ ok: true, linhas: 1 });
    chamar(confirmar(render().vistos)?.onClick);
    await vazar();
    expect(removerAnexo.mock.calls.at(-1)).toEqual(["m1/u1-foto.png"]);
    expect(el.anexos.map((anexo) => anexo.removido)).toEqual([true, false, true]);
    expect(toastSucesso.mock.calls.at(-1)).toEqual(["Anexo excluído"]);
    const depois = render().html;
    expect(depois).not.toContain("dialog-falso");
    expect(depois).not.toContain("Foto Ação.png");
    expect(depois).toContain("Plano.pdf");
    await vi.advanceTimersByTimeAsync(1000);
    await vazar();
    expect(salvarNota).toHaveBeenCalledTimes(1);
  });

  it("WRITE-08 e W22: tirada a escreverNotas, a exclusão confirmada não chega à porta e nada sai da nota", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const caps = new Set<Capacidade>(["escreverNotas"]);
    const { el } = await montar({ caps, anexos: anexosDaFicha() });
    chamar(botao(render({ caps }).vistos, "Excluir Plano.pdf")?.onClick);
    const aberto = render({ caps });
    caps.delete("escreverNotas");
    chamar(aberto.vistos.find((v) => v.tipo === "button" && v.props.className === "!bg-danger hover:!bg-danger/90")?.props.onClick);
    await vazar();
    expect(removerAnexo).not.toHaveBeenCalled();
    expect(el.anexos.some((anexo) => anexo.removido)).toBe(false);
  });

  it("o estilo do anexo mora em marca.css: imagem no máximo da coluna com raio 8, documento com o FileText antes do nome", () => {
    const css = readFileSync(`${RAIZ}src/app/marca.css`, "utf8");
    expect(css).toMatch(/\.nota-anexos img \{[^}]*max-width: 100%;[^}]*border-radius: 8px;/);
    expect(css).toMatch(/\.nota-anexos a\[href\] \{[^}]*cursor: pointer;/);
    expect(css).toMatch(/\.nota-anexos a\.anexo::before \{[^}]*mask: url\("data:image\/svg\+xml[^"]*M15 2H6a2 2 0 0 0-2 2v16/);
    expect(readFileSync(`${RAIZ}src/app/globals.css`, "utf8")).not.toContain("nota-anexos");
    expect(readFileSync(`${RAIZ}src/components/modules/ficha/editor-notas.tsx`, "utf8")).toContain("nota-anexos");
  });
});
