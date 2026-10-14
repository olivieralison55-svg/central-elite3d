import DOMPurify, { type Config, type UponSanitizeAttributeHookEvent } from "dompurify";

// O bloco de notas do mentorado (AD-004; index.html:3343–3437): o sanitizador, os atalhos de
// markdown, o link e a gravação automática. O componente (editor-notas.tsx) fica com o DOM, o
// `execCommand` e os efeitos.

// NOTE-02: as 22 tags de hoje.
export const NOTA_TAGS: readonly string[] = ["p", "br", "div", "h1", "h2", "h3", "b", "strong", "i", "em", "u", "s", "strike", "ul", "ol", "li", "blockquote", "pre", "code", "hr", "a", "span"];

const CLASSES: ReadonlySet<string> = new Set(["checklist", "feito"]);

// Só as duas classes que o editor põe. Com o Tailwind do app, `class` livre deixaria um mentor
// cobrir a tela de quem lê com "fixed inset-0 z-50" e um link falso (THREAT-07).
export const filtrarClasses = (valor: string): string =>
  valor
    .split(/\s+/)
    .filter((classe) => CLASSES.has(classe))
    .join(" ");

// O mínimo do DOMPurify que o sanitizador usa: o teste injeta um falso, porque sem DOM o de
// verdade não sanitiza.
type GanchoDeAtributo = (no: Element, evento: UponSanitizeAttributeHookEvent) => void;
export interface Purificador {
  isSupported: boolean;
  sanitize(html: string, config: Config): string;
  addHook(ponto: "uponSanitizeAttribute", gancho: GanchoDeAtributo): void;
  removeHook(ponto: "uponSanitizeAttribute", gancho?: GanchoDeAtributo): unknown;
}

const passarClasse: GanchoDeAtributo = (_no, evento) => {
  if (evento.attrName !== "class") return;
  evento.attrValue = filtrarClasses(evento.attrValue);
  if (!evento.attrValue) evento.keepAttr = false;
};

// NOTE-02 e NOTE-03: ao abrir, ao colar e ao salvar. Só as tags de NOTA_TAGS, `href` só http(s),
// `class` só checklist e feito, nenhum `data-*`. Sem DOM o DOMPurify devolve a entrada suja
// (purify.es.mjs:1197–1200): sem suporte, `null`, e quem chama não exibe nem grava nada.
export function sanitizarNota(html: string, purify: Purificador = DOMPurify): string | null {
  if (!purify.isSupported) return null;
  purify.addHook("uponSanitizeAttribute", passarClasse);
  try {
    return purify.sanitize(html, { ALLOWED_TAGS: [...NOTA_TAGS], ALLOWED_ATTR: ["href", "class"], ALLOW_DATA_ATTR: false, ALLOWED_URI_REGEXP: /^https?:/i });
  } finally {
    purify.removeHook("uponSanitizeAttribute", passarClasse);
  }
}

export type ComandoNota = "h1" | "h2" | "h3" | "p" | "bold" | "italic" | "underline" | "strikeThrough" | "code" | "ul" | "ol" | "check" | "quote" | "hr" | "link" | "pre";

// NOTE-07: o marcador digitado no começo do bloco, seguido de espaço.
const ATALHOS: ReadonlyMap<string, ComandoNota> = new Map([
  ["#", "h1"],
  ["##", "h2"],
  ["###", "h3"],
  ["-", "ul"],
  ["*", "ul"],
  ["1.", "ol"],
  [">", "quote"],
  ["[]", "check"],
]);

// O comando do marcador que o bloco tem antes do cursor. O espaço duro que o contenteditable põe
// conta como espaço. Três crases e `---` só valem com Enter.
export function atalhoPara(textoDoBloco: string, tecla: string): ComandoNota | null {
  const marcador = textoDoBloco.replace(/\u00a0/g, " ").trim();
  if (tecla === " ") return ATALHOS.get(marcador) ?? null;
  if (tecla !== "Enter") return null;
  if (marcador === "```") return "pre";
  return marcador === "---" ? "hr" : null;
}

// NOTE-08: o endereço do link, só http: ou https:, lido por `new URL`. `javascript:`, `data:` e
// texto que não é endereço voltam null.
export function linkValido(texto: string): string | null {
  const endereco = texto.trim();
  let url: URL;
  try {
    url = new URL(endereco);
  } catch (erro) {
    if (!(erro instanceof TypeError)) throw erro;
    return null;
  }
  return url.protocol === "http:" || url.protocol === "https:" ? endereco : null;
}

type Agendado = ReturnType<typeof setTimeout>;

export interface Autosave {
  mudou(html: string): void;
  descarregar(): Promise<void>;
}

// NOTE-04: grava `atraso` ms depois da última mudança. NOTE-05: `descarregar` grava na hora o que
// estiver pendente (troca de aba, de ficha ou de tela, aba escondida, logout) e devolve a gravação,
// para quem sai esperar por ela.
export function criarAutosave({
  salvar,
  atraso = 1000,
  agendar = setTimeout,
  cancelar = clearTimeout,
}: {
  salvar(html: string): Promise<unknown> | void;
  atraso?: number;
  agendar?(fn: () => void, ms: number): Agendado;
  cancelar?(agendado: Agendado): void;
}): Autosave {
  let pendente: string | null = null;
  let agendado: Agendado | null = null;
  const descarregar = async () => {
    if (agendado !== null) cancelar(agendado);
    agendado = null;
    if (pendente === null) return;
    const html = pendente;
    pendente = null;
    await salvar(html);
  };
  return {
    mudou(html) {
      pendente = html;
      if (agendado !== null) cancelar(agendado);
      agendado = agendar(() => void descarregar().catch((erro: unknown) => console.error("[central-elite3d] nota", erro)), atraso);
    },
    descarregar,
  };
}
