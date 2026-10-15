import DOMPurify, { type Config, type UponSanitizeAttributeHookEvent } from "dompurify";

// O bloco de notas do mentorado (AD-004; index.html:3343–3437): o sanitizador, os atalhos de
// markdown, o link e a gravação automática. O componente (editor-notas.tsx) fica com o DOM, o
// `execCommand` e os efeitos.

// NOTE-02: as 22 tags de hoje e a imagem do anexo (AD-010).
export const NOTA_TAGS: readonly string[] = ["p", "br", "div", "h1", "h2", "h3", "b", "strong", "i", "em", "u", "s", "strike", "ul", "ol", "li", "blockquote", "pre", "code", "hr", "a", "span", "img"];

const CLASSES: ReadonlySet<string> = new Set(["checklist", "feito", "anexo"]);

// Só as classes que o editor põe. Com o Tailwind do app, `class` livre deixaria um mentor
// cobrir a tela de quem lê com "fixed inset-0 z-50" e um link falso (THREAT-07).
export const filtrarClasses = (valor: string): string =>
  valor
    .split(/\s+/)
    .filter((classe) => CLASSES.has(classe))
    .join(" ");

// O mínimo do DOMPurify que o sanitizador usa: o teste injeta um falso, porque sem DOM o de
// verdade não sanitiza.
type GanchoDeAtributo = (no: Element, evento: UponSanitizeAttributeHookEvent) => void;
type GanchoDeNo = (no: Node) => void;
export interface Purificador {
  isSupported: boolean;
  sanitize(html: string, config: Config): string;
  addHook(ponto: "uponSanitizeAttribute", gancho: GanchoDeAtributo): void;
  addHook(ponto: "afterSanitizeAttributes", gancho: GanchoDeNo): void;
  removeHook(ponto: "uponSanitizeAttribute", gancho?: GanchoDeAtributo): unknown;
  removeHook(ponto: "afterSanitizeAttributes", gancho?: GanchoDeNo): unknown;
}

const passarClasse: GanchoDeAtributo = (_no, evento) => {
  if (evento.attrName !== "class") return;
  evento.attrValue = filtrarClasses(evento.attrValue);
  if (!evento.attrValue) evento.keepAttr = false;
};

// O caminho do anexo no bucket (AD-010): `<mentorado_id>/<uuid>-<nome-saneado>`, o que o
// `enviarAnexo` da porta monta.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const CAMINHO_ANEXO = new RegExp(`^${UUID}/${UUID}-[a-z0-9._-]{1,80}$`);
export const ANEXO = "anexo:";

// A imagem só fica com `src` de anexo do bucket: imagem externa, `data:` (que o DOMPurify deixa no
// `img` por padrão) e pixel de rastreio saem inteiros, sem sobrar um `img` sem fonte (THREAT-07).
const soImagemDeAnexo: GanchoDeNo = (no) => {
  if (no.nodeName !== "IMG") return;
  const img = no as Element;
  const src = img.getAttribute("src") ?? "";
  if (!src.startsWith(ANEXO) || !CAMINHO_ANEXO.test(src.slice(ANEXO.length))) img.remove();
};

// NOTE-02 e NOTE-03: ao abrir, ao colar e ao salvar. Só as tags de NOTA_TAGS, `href` e `src` só
// http(s) ou `anexo:`, `img` só de anexo, `class` só checklist, feito e anexo, nenhum `data-*`. Sem
// DOM o DOMPurify devolve a entrada suja (purify.es.mjs:1197–1200): sem suporte, `null`, e quem
// chama não exibe nem grava nada.
export function sanitizarNota(html: string, purify: Purificador = DOMPurify): string | null {
  if (!purify.isSupported) return null;
  purify.addHook("uponSanitizeAttribute", passarClasse);
  purify.addHook("afterSanitizeAttributes", soImagemDeAnexo);
  try {
    return purify.sanitize(html, {
      ALLOWED_TAGS: [...NOTA_TAGS],
      ALLOWED_ATTR: ["href", "class", "src", "alt"],
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:https?:|anexo:)/i,
    });
  } finally {
    purify.removeHook("uponSanitizeAttribute", passarClasse);
    purify.removeHook("afterSanitizeAttributes", soImagemDeAnexo);
  }
}

const escaparHtml = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A citação canônica do anexo no HTML da nota (AD-010): imagem com o nome no `alt`, documento como
// link com o nome por texto. Quem insere ainda passa pelo sanitizador.
export function htmlDoAnexo(caminho: string, nome: string, imagem: boolean): string {
  const ref = escaparHtml(`${ANEXO}${caminho}`);
  return imagem ? `<img src="${ref}" alt="${escaparHtml(nome)}">` : `<a href="${ref}" class="anexo">${escaparHtml(nome)}</a>`;
}

// NOTE-04 e NOTE-05: antes de salvar, a URL assinada do bucket volta a ser `anexo:<caminho>`. O
// `encodeURI` do storage-js vira `%20` no caminho; aqui ele é desfeito. O token e o resto da query saem.
export function canonizarAnexos(html: string, urlBase: string): string {
  const base = urlBase.replace(/\/+$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const assinada = new RegExp(`${base}/storage/v1/object/sign/notas-anexos/([^?"'\\s<>]+)\\?[^"'\\s<>]*`, "g");
  return html.replace(assinada, (url, caminho: string) => {
    try {
      return `${ANEXO}${decodeURI(caminho)}`;
    } catch (erro) {
      // Escape malformado não é URL que o storage-js montou: fica como está, e o sanitizador decide.
      if (!(erro instanceof URIError)) throw erro;
      return url;
    }
  });
}

// O que o editor resolve: imagem e documento que ainda citam `anexo:`.
const SELETOR_ANEXO = `img[src^="${ANEXO}"], a[href^="${ANEXO}"]`;
type Raiz = Pick<ParentNode, "querySelectorAll">;
const atributoDo = (no: Element) => (no.tagName === "IMG" ? "src" : "href");

// Os caminhos dos anexos ainda sem link, sem repetir.
export function caminhosDeAnexo(raiz: Raiz): string[] {
  const caminhos = Array.from(raiz.querySelectorAll(SELETOR_ANEXO), (no) => (no.getAttribute(atributoDo(no)) ?? "").slice(ANEXO.length));
  return [...new Set(caminhos)];
}

// Troca no DOM cada `anexo:` pela URL assinada do mapa; o documento abre em outra aba, sem `opener`.
// O caminho sem link fica como está.
export function resolverAnexos(raiz: Raiz, links: ReadonlyMap<string, string>): void {
  for (const no of Array.from(raiz.querySelectorAll(SELETOR_ANEXO))) {
    const atributo = atributoDo(no);
    const url = links.get((no.getAttribute(atributo) ?? "").slice(ANEXO.length));
    if (!url) continue;
    no.setAttribute(atributo, url);
    if (atributo === "href") {
      no.setAttribute("target", "_blank");
      no.setAttribute("rel", "noopener noreferrer");
    }
  }
}

// Os tipos que o bucket aceita (20261015_notas_anexos.sql). SVG fica fora (AD-010).
export const TIPOS_IMAGEM: readonly string[] = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const TIPOS_DOCUMENTO: readonly string[] = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];
export const LIMITE_ANEXO = 10 * 1024 * 1024;

// EDGE: o arquivo grande ou de tipo recusado não sai; a mensagem vai para o toast. Null é aceito.
export function conferirArquivo(arquivo: { name: string; size: number; type: string }, imagem: boolean): string | null {
  const tipos = imagem ? TIPOS_IMAGEM : TIPOS_DOCUMENTO;
  if (!tipos.includes(arquivo.type)) {
    return `"${arquivo.name}" não foi enviado: ${imagem ? "a imagem tem de ser PNG, JPEG, WEBP ou GIF" : "o anexo tem de ser PDF, Word, Excel, PowerPoint, TXT ou CSV"}.`;
  }
  if (arquivo.size > LIMITE_ANEXO) return `"${arquivo.name}" não foi enviado: tem ${(arquivo.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB, e o limite é 10 MB.`;
  return null;
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
