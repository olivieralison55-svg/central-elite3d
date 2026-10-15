import type { Config, UponSanitizeAttributeHookEvent } from "dompurify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  anexosDaNota,
  atalhoPara,
  caminhosDeAnexo,
  canonizarAnexos,
  citacoesDoAnexo,
  conferirArquivo,
  criarAutosave,
  dentroDoEditor,
  filtrarClasses,
  htmlDoAnexo,
  LIMITE_ANEXO,
  linkValido,
  NOTA_TAGS,
  pontoDoAnexo,
  type Purificador,
  resolverAnexos,
  sanitizarNota,
} from "./notas";

// O grupo "Notas" do harness antigo (tests/testes.mjs:1768–1783) e as regras do AD-004. O
// DOMPurify de verdade não sanitiza sem DOM: os testes de NOTE-02 injetam um falso que anota a
// config e roda o gancho de atributo sobre os eventos que o teste manda (design, componente 11).

type Gancho = (no: Element, evento: UponSanitizeAttributeHookEvent) => void;
type GanchoDeNo = (no: Node) => void;

// O nó que o gancho de imagem vê: o nome, os atributos e se foi tirado.
function no(nodeName: string, atributos: Record<string, string> = {}) {
  const falso = { nodeName, removido: false, getAttribute: (nome: string) => atributos[nome] ?? null, remove: () => void (falso.removido = true) };
  return falso;
}

function purificador({ suportado = true, eventos = [] as UponSanitizeAttributeHookEvent[], nos = [] as ReturnType<typeof no>[], falhar = false } = {}) {
  const ganchos: Gancho[] = [];
  const depois: GanchoDeNo[] = [];
  const chamadas: Array<[string, Config]> = [];
  const removidos: unknown[] = [];
  const lista = (ponto: string): unknown[] => (ponto === "uponSanitizeAttribute" ? ganchos : depois);
  const purify: Purificador = {
    isSupported: suportado,
    sanitize: (html, config) => {
      chamadas.push([html, config]);
      for (const evento of eventos) for (const gancho of ganchos) gancho({} as Element, evento);
      for (const n of nos) for (const gancho of depois) gancho(n as unknown as Node);
      if (falhar) throw new Error("falhou");
      return `[limpo]${html}`;
    },
    addHook: (ponto: string, gancho: Gancho | GanchoDeNo) => void lista(ponto).push(gancho),
    removeHook: (ponto: string, gancho?: Gancho | GanchoDeNo) => {
      removidos.push(gancho);
      lista(ponto).splice(lista(ponto).indexOf(gancho), 1);
    },
  };
  return { purify, chamadas, ganchos, depois, removidos };
}

const evento = (attrName: string, attrValue: string): UponSanitizeAttributeHookEvent => ({ attrName, attrValue, keepAttr: true, allowedAttributes: {}, forceKeepAttr: undefined });

describe("regras das notas (NOTE-02, NOTE-03, NOTE-04, NOTE-05, NOTE-07, NOTE-08)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("NOTE-02: as 22 tags de hoje e a img do anexo (AD-010)", () => {
    expect(NOTA_TAGS).toEqual(["p", "br", "div", "h1", "h2", "h3", "b", "strong", "i", "em", "u", "s", "strike", "ul", "ol", "li", "blockquote", "pre", "code", "hr", "a", "span", "img"]);
  });

  it("NOTE-02: sanitizarNota chama o purify com NOTA_TAGS, só href, class, src e alt, sem data-* e URI só http(s) ou anexo:, e devolve o que ele limpou", () => {
    const { purify, chamadas } = purificador();
    expect(sanitizarNota('<h1 data-x="1">Título</h1><a href="https://exemplo.com">x</a>', purify)).toBe('[limpo]<h1 data-x="1">Título</h1><a href="https://exemplo.com">x</a>');
    expect(chamadas).toHaveLength(1);
    const [html, config] = chamadas[0];
    expect(html).toBe('<h1 data-x="1">Título</h1><a href="https://exemplo.com">x</a>');
    expect({ ...config, ALLOWED_URI_REGEXP: undefined }).toEqual({ ALLOWED_TAGS: [...NOTA_TAGS], ALLOWED_ATTR: ["href", "class", "src", "alt"], ALLOW_DATA_ATTR: false, ALLOWED_URI_REGEXP: undefined });
    const uri = config.ALLOWED_URI_REGEXP;
    if (!uri) throw new Error("ALLOWED_URI_REGEXP ausente");
    for (const ok of ["http://exemplo.com", "https://exemplo.com/a?b=1", "HTTPS://EXEMPLO.COM", "anexo:m1/u1-a.png"]) expect(uri.test(ok), ok).toBe(true);
    for (const recusado of ["javascript:alert(1)", "data:text/html,<b>x</b>", "mailto:a@b.com", "ftp://exemplo.com", "/relativo", "#ancora", "vbscript:x"]) {
      expect(uri.test(recusado), recusado).toBe(false);
    }
    // O http(s) vale só no começo: outro esquema que cita http: ou https: depois não passa (THREAT-07).
    for (const recusado of ["javascript:alert('https://x')", "javascript:fetch('http://evil.example')", "data:text/html,https://x", "javascript:alert(1)//anexo:m1/u1-a.png", "xanexo:m1/a.png"]) {
      expect(uri.test(recusado), recusado).toBe(false);
    }
  });

  it("NOTE-03: sem suporte (o DOMPurify sem DOM) devolve null e não chama o sanitize", () => {
    const { purify, chamadas, ganchos } = purificador({ suportado: false });
    expect(sanitizarNota("<b>x</b>", purify)).toBeNull();
    expect([chamadas, ganchos]).toEqual([[], []]);
    // O DOMPurify de verdade, no vitest `node`, é esse caso: nada de HTML sem sanitizar.
    expect(sanitizarNota("<img src=x onerror=alert(1)>")).toBeNull();
  });

  it("NOTE-02 e THREAT-07: o gancho de atributo deixa no class só checklist, feito e anexo, tira o class vazio e não mexe no href", () => {
    const fixo = evento("class", "fixed inset-0 z-50 checklist");
    const so = evento("class", "fixed inset-0");
    const link = evento("href", "https://exemplo.com");
    const feito = evento("class", "checklist feito");
    const anexo = evento("class", "anexo fixed");
    const { purify, ganchos, depois, removidos } = purificador({ eventos: [fixo, so, link, feito, anexo] });
    sanitizarNota("<ul class='checklist'></ul>", purify);
    expect([fixo.attrValue, fixo.keepAttr]).toEqual(["checklist", true]);
    expect([so.attrValue, so.keepAttr]).toEqual(["", false]);
    expect([link.attrValue, link.keepAttr]).toEqual(["https://exemplo.com", true]);
    expect([feito.attrValue, feito.keepAttr]).toEqual(["checklist feito", true]);
    expect([anexo.attrValue, anexo.keepAttr]).toEqual(["anexo", true]);
    // Os ganchos saem depois de cada chamada, também quando o sanitize lança: não vazam para outro uso do DOMPurify.
    expect([ganchos, depois]).toEqual([[], []]);
    expect(removidos).toHaveLength(2);
    const comFalha = purificador({ falhar: true });
    expect(() => sanitizarNota("<b>x</b>", comFalha.purify)).toThrow("falhou");
    expect([comFalha.ganchos, comFalha.depois]).toEqual([[], []]);
  });

  it("AD-010 e THREAT-07: a img só fica com src anexo: no formato do bucket; img com src externo, data:, pixel de rastreio ou sem src some inteira", () => {
    const M = "0b9c3c1e-7d1a-4f7e-9a51-2f7c1d2e3a4b";
    const U = "2b0d6c3e-1111-4222-8333-444455556666";
    const fica = no("IMG", { src: `anexo:${M}/${U}-foto.png`, alt: "Foto" });
    const somem = [
      no("IMG", { src: "https://rastreio.example/pixel.gif" }),
      no("IMG", { src: "data:image/png;base64,iVBORw0KGgo=" }),
      no("IMG", { src: "http://exemplo.com/a.png" }),
      no("IMG", { src: `anexo:m1/${U}-foto.png` }),
      no("IMG", { src: `anexo:${M}/../${U}-foto.png` }),
      no("IMG", { src: `anexo:${M}/${U}-Foto Grande.png` }),
      no("IMG", { src: `anexo:${M}/${U}-${"a".repeat(81)}` }),
      no("IMG"),
    ];
    const link = no("A", { href: "https://exemplo.com" });
    sanitizarNota("<img>", purificador({ nos: [fica, ...somem, link] }).purify);
    expect(fica.removido).toBe(false);
    expect(somem.map((n) => n.removido)).toEqual(somem.map(() => true));
    expect(link.removido).toBe(false);
  });

  it("filtrarClasses deixa só checklist, feito e anexo", () => {
    expect(filtrarClasses("fixed inset-0 z-50 checklist")).toBe("checklist");
    expect(filtrarClasses("anexo fixed inset-0")).toBe("anexo");
    expect(filtrarClasses("feito")).toBe("feito");
    expect(filtrarClasses("checklist  feito")).toBe("checklist feito");
    expect(filtrarClasses("bg-danger text-white")).toBe("");
    expect(filtrarClasses("")).toBe("");
    // Só o nome exato: classe que apenas contém checklist ou feito sai (THREAT-07).
    expect(filtrarClasses("checklist-overlay xfeito [&_ul.checklist]:fixed checklist feito")).toBe("checklist feito");
  });

  it("NOTE-07: #, ##, ###, -, *, 1., > e [] seguidos de espaço viram os blocos de hoje", () => {
    const casos: [string, string][] = [
      ["#", "h1"],
      ["##", "h2"],
      ["###", "h3"],
      ["-", "ul"],
      ["*", "ul"],
      ["1.", "ol"],
      [">", "quote"],
      ["[]", "check"],
    ];
    for (const [marcador, comando] of casos) expect(atalhoPara(marcador, " "), marcador).toBe(comando);
    // O espaço duro do contenteditable conta como espaço.
    expect(atalhoPara("\u00a0##\u00a0", " ")).toBe("h2");
    for (const nada of ["####", "texto", "2.", "[x]", "", "constructor", "toString"]) expect(atalhoPara(nada, " "), nada).toBeNull();
  });

  it("NOTE-07: três crases e --- só valem com Enter; os marcadores de espaço não valem com Enter", () => {
    expect(atalhoPara("```", "Enter")).toBe("pre");
    expect(atalhoPara("---", "Enter")).toBe("hr");
    expect(atalhoPara("```", " ")).toBeNull();
    expect(atalhoPara("---", " ")).toBeNull();
    expect(atalhoPara("#", "Enter")).toBeNull();
    expect(atalhoPara("#", "a")).toBeNull();
  });

  it("NOTE-08: linkValido aceita http: e https: e recusa javascript:, data: e texto solto", () => {
    expect(linkValido("  https://exemplo.com/a  ")).toBe("https://exemplo.com/a");
    expect(linkValido("http://exemplo.com")).toBe("http://exemplo.com");
    expect(linkValido("HTTPS://EXEMPLO.COM")).toBe("HTTPS://EXEMPLO.COM");
    for (const recusado of ["javascript:alert(1)", "data:text/html,<b>x</b>", "texto solto", "exemplo.com", "", "ftp://exemplo.com", "mailto:a@b.com"]) {
      expect(linkValido(recusado), recusado).toBeNull();
    }
  });

  it("NOTE-04: grava 1 s depois da última mudança, uma vez, com o último HTML", () => {
    vi.useFakeTimers();
    const salvar = vi.fn();
    const autosave = criarAutosave({ salvar });
    autosave.mudou("<p>a</p>");
    vi.advanceTimersByTime(999);
    expect(salvar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(salvar.mock.calls).toEqual([["<p>a</p>"]]);

    // Cada mudança reagenda: digitar a cada 600 ms adia a gravação até a pausa.
    autosave.mudou("<p>b</p>");
    vi.advanceTimersByTime(600);
    autosave.mudou("<p>bc</p>");
    vi.advanceTimersByTime(600);
    expect(salvar).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400);
    expect(salvar.mock.calls).toEqual([["<p>a</p>"], ["<p>bc</p>"]]);
    vi.advanceTimersByTime(5000);
    expect(salvar).toHaveBeenCalledTimes(2);
  });

  it("NOTE-05: descarregar em 300 ms grava uma vez, na hora, com o último HTML, e o timer não grava de novo", async () => {
    vi.useFakeTimers();
    const salvar = vi.fn();
    const autosave = criarAutosave({ salvar, atraso: 1000 });
    autosave.mudou("<p>x</p>");
    autosave.mudou("<p>xy</p>");
    vi.advanceTimersByTime(300);
    await autosave.descarregar();
    expect(salvar.mock.calls).toEqual([["<p>xy</p>"]]);
    vi.advanceTimersByTime(5000);
    await autosave.descarregar();
    expect(salvar).toHaveBeenCalledTimes(1);
  });

  it("NOTE-05: descarregar sem nada pendente não grava, e com gravação pendente só termina quando ela termina", async () => {
    const salvar = vi.fn<(html: string) => Promise<unknown>>();
    const autosave = criarAutosave({ salvar, agendar: () => setTimeout(() => undefined, 0), cancelar: clearTimeout });
    await autosave.descarregar();
    expect(salvar).not.toHaveBeenCalled();

    let terminar: () => void = () => undefined;
    salvar.mockImplementation(() => new Promise<void>((resolve) => (terminar = resolve)));
    autosave.mudou("<p>sair</p>");
    let saiu = false;
    const saida = autosave.descarregar().then(() => (saiu = true));
    await Promise.resolve();
    expect([salvar.mock.calls, saiu]).toEqual([[["<p>sair</p>"]], false]);
    terminar();
    await saida;
    expect(saiu).toBe(true);
  });

  it("AD-010: htmlDoAnexo cita o anexo, imagem com o nome no alt e documento como link com a classe anexo, com o nome escapado", () => {
    expect(htmlDoAnexo("m1/u1-foto.png", "Foto.png", true)).toBe('<img src="anexo:m1/u1-foto.png" alt="Foto.png">');
    expect(htmlDoAnexo("m1/u1-plano.pdf", "Plano <final> & \"v2\".pdf", false)).toBe('<a href="anexo:m1/u1-plano.pdf" class="anexo">Plano &lt;final&gt; &amp; &quot;v2&quot;.pdf</a>');
    expect(htmlDoAnexo("m1/u1-x.png", '"><script>x</script>', true)).toBe('<img src="anexo:m1/u1-x.png" alt="&quot;&gt;&lt;script&gt;x&lt;/script&gt;">');
  });

  it("NOTE-04 e NOTE-05: canonizarAnexos volta a URL assinada do bucket para anexo:, sem o token, e ida e volta dá o HTML canônico", () => {
    const base = "https://matgynpiscyoshnjzolo.supabase.co";
    // A URL como o storage-js monta: encodeURI(`${url}/object/sign/<bucket>/<caminho>?token=…`).
    const assinar = (caminho: string) => encodeURI(`${base}/storage/v1/object/sign/notas-anexos/${caminho}?token=eyJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ4In0.c2ln`);
    const canonico = `<p>a</p>${htmlDoAnexo("m1/u1-foto.png", "Foto", true)}<p>${htmlDoAnexo("m1/u2-com espaco.pdf", "Doc", false)}</p>`;
    const exibido = canonico.replace(/anexo:([^"]+)/g, (_x, caminho: string) => assinar(caminho));
    expect(exibido).toContain("u2-com%20espaco.pdf?token=");
    expect(canonizarAnexos(exibido, base)).toBe(canonico);
    expect(canonizarAnexos(exibido, `${base}/`)).toBe(canonico);
    // Query com mais de um parâmetro, como o innerHTML a escreve.
    expect(canonizarAnexos(`<img src="${assinar("m1/u1-a.png")}&amp;download=">`, base)).toBe('<img src="anexo:m1/u1-a.png">');
    // Outro bucket, outro host, URL pública e link comum não mudam.
    for (const igual of [
      `<img src="${base}/storage/v1/object/sign/outro/m1/a.png?token=t">`,
      '<img src="https://evil.example/storage/v1/object/sign/notas-anexos/m1/a.png?token=t">',
      `<img src="${base}/storage/v1/object/public/notas-anexos/m1/a.png">`,
      '<a href="https://exemplo.com/doc?token=1">x</a>',
    ]) {
      expect(canonizarAnexos(igual, base), igual).toBe(igual);
    }
    // Escape malformado fica como está; o sanitizador decide.
    const malformado = `<a href="${base}/storage/v1/object/sign/notas-anexos/m1/a%E0%A4%A.pdf?token=t">x</a>`;
    expect(canonizarAnexos(malformado, base)).toBe(malformado);
  });

  it("AD-010: caminhosDeAnexo lista os anexo: sem repetir, e resolverAnexos troca src e href pela URL do mapa, com target e rel no documento", () => {
    const elemento = (tagName: string, atributos: Record<string, string>) => ({
      tagName,
      atributos,
      getAttribute: (nome: string) => atributos[nome] ?? null,
      setAttribute: (nome: string, valor: string) => void (atributos[nome] = valor),
    });
    const img = elemento("IMG", { src: "anexo:m1/u1-a.png", alt: "a" });
    const repetida = elemento("IMG", { src: "anexo:m1/u1-a.png" });
    const doc = elemento("A", { href: "anexo:m1/u2-b.pdf", class: "anexo" });
    const semLink = elemento("A", { href: "anexo:m1/u3-c.pdf" });
    const seletores: string[] = [];
    const raiz = {
      querySelectorAll: (seletor: string) => (seletores.push(seletor), [img, repetida, doc, semLink]),
    } as unknown as ParentNode;
    expect(caminhosDeAnexo(raiz)).toEqual(["m1/u1-a.png", "m1/u2-b.pdf", "m1/u3-c.pdf"]);
    resolverAnexos(raiz, new Map([["m1/u1-a.png", "https://x/a?token=1"], ["m1/u2-b.pdf", "https://x/b?token=2"]]));
    expect(seletores).toEqual(['img[src^="anexo:"], a[href^="anexo:"]', 'img[src^="anexo:"], a[href^="anexo:"]']);
    expect([img.atributos, repetida.atributos, doc.atributos, semLink.atributos]).toEqual([
      { src: "https://x/a?token=1", alt: "a" },
      { src: "https://x/a?token=1" },
      { href: "https://x/b?token=2", class: "anexo", target: "_blank", rel: "noopener noreferrer" },
      { href: "anexo:m1/u3-c.pdf" },
    ]);
  });

  it("AD-010: dentroDoEditor só guarda o intervalo do editor; pontoDoAnexo é o fim dele, colapsado, e null fora do editor ou sem intervalo", () => {
    const texto = { no: "texto do editor" };
    const editor = { contains: (no: unknown) => no === texto } as unknown as Node;
    const colapsos: boolean[] = [];
    const ponto = { collapse: (inicio: boolean) => void colapsos.push(inicio) };
    const dentro = { commonAncestorContainer: texto, cloneRange: () => ponto } as unknown as Range;
    const fora = { commonAncestorContainer: { no: "campo de fora" }, cloneRange: () => ponto } as unknown as Range;
    expect([dentroDoEditor(dentro, editor), dentroDoEditor(fora, editor), dentroDoEditor(null, editor)]).toEqual([dentro, null, null]);
    expect(pontoDoAnexo(dentro, editor)).toBe(ponto);
    // collapse(false): o anexo vai para o fim do trecho marcado e não o substitui.
    expect(colapsos).toEqual([false]);
    expect([pontoDoAnexo(fora, editor), pontoDoAnexo(null, editor)]).toEqual([null, null]);
    expect(colapsos).toEqual([false]);
  });

  it("AD-010: citacoesDoAnexo acha a imagem e o link do caminho, com anexo: ou já com a URL assinada, e só eles", () => {
    const base = "https://projeto.supabase.co";
    const elemento = (tagName: string, atributos: Record<string, string>) => ({ tagName, getAttribute: (nome: string) => atributos[nome] ?? null });
    const img = elemento("IMG", { src: "anexo:m1/u1-a.png" });
    const assinada = elemento("A", { href: `${base}/storage/v1/object/sign/notas-anexos/m1/u1-a.png?token=t`, class: "anexo" });
    const outro = elemento("IMG", { src: "anexo:m1/u2-b.png" });
    const externo = elemento("A", { href: "https://exemplo.com/m1/u1-a.png" });
    const seletores: string[] = [];
    const raiz = { querySelectorAll: (seletor: string) => (seletores.push(seletor), [img, assinada, outro, externo]) } as unknown as ParentNode;
    expect(citacoesDoAnexo(raiz, "m1/u1-a.png", base)).toEqual([img, assinada]);
    expect(citacoesDoAnexo(raiz, "m1/u9-z.png", base)).toEqual([]);
    expect(seletores).toEqual(["img[src], a[href]", "img[src], a[href]"]);
  });

  it("AD-010 e W22: anexosDaNota lista cada imagem e documento citado uma vez, resolvido ou não, com o nome do alt ou do texto do link", () => {
    const base = "https://projeto.supabase.co";
    const elemento = (tagName: string, atributos: Record<string, string>, textContent = "") => ({ tagName, textContent, getAttribute: (nome: string) => atributos[nome] ?? null });
    const raiz = {
      querySelectorAll: () => [
        elemento("IMG", { src: `${base}/storage/v1/object/sign/notas-anexos/m1/u1-foto.png?token=t`, alt: "Foto Ação.png" }),
        elemento("A", { href: "anexo:m1/u2-plano.pdf", class: "anexo" }, " Plano.pdf "),
        elemento("IMG", { src: "anexo:m1/u1-foto.png", alt: "repetida" }),
        elemento("A", { href: "https://exemplo.com/doc" }, "link comum"),
        elemento("IMG", { src: "anexo:m1/u3-sem-nome.png" }),
      ],
    } as unknown as ParentNode;
    expect(anexosDaNota(raiz, base)).toEqual([
      { caminho: "m1/u1-foto.png", imagem: true, nome: "Foto Ação.png" },
      { caminho: "m1/u2-plano.pdf", imagem: false, nome: "Plano.pdf" },
      { caminho: "m1/u3-sem-nome.png", imagem: true, nome: "u3-sem-nome.png" },
    ]);
  });

  it("EDGE: conferirArquivo recusa tipo fora da lista (SVG incluído) e arquivo acima de 10 MB, com a mensagem do toast", () => {
    expect(conferirArquivo({ name: "a.png", size: LIMITE_ANEXO, type: "image/png" }, true)).toBeNull();
    for (const tipo of ["image/jpeg", "image/webp", "image/gif"]) expect(conferirArquivo({ name: "a", size: 1, type: tipo }, true), tipo).toBeNull();
    for (const tipo of ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/csv", "text/plain", "application/vnd.ms-excel"]) {
      expect(conferirArquivo({ name: "a", size: 1, type: tipo }, false), tipo).toBeNull();
    }
    expect(conferirArquivo({ name: "logo.svg", size: 10, type: "image/svg+xml" }, true)).toBe('"logo.svg" não foi enviado: a imagem tem de ser PNG, JPEG, WEBP ou GIF.');
    expect(conferirArquivo({ name: "logo.svg", size: 10, type: "image/svg+xml" }, false)).toBe('"logo.svg" não foi enviado: o anexo tem de ser PDF, Word, Excel, PowerPoint, TXT ou CSV.');
    expect(conferirArquivo({ name: "a.pdf", size: 10, type: "application/pdf" }, true)).toBe('"a.pdf" não foi enviado: a imagem tem de ser PNG, JPEG, WEBP ou GIF.');
    expect(conferirArquivo({ name: "a.png", size: 10, type: "image/png" }, false)).toBe('"a.png" não foi enviado: o anexo tem de ser PDF, Word, Excel, PowerPoint, TXT ou CSV.');
    expect(conferirArquivo({ name: "x", size: 10, type: "" }, false)).toBe('"x" não foi enviado: o anexo tem de ser PDF, Word, Excel, PowerPoint, TXT ou CSV.');
    expect(conferirArquivo({ name: "grande.pdf", size: LIMITE_ANEXO + 1, type: "application/pdf" }, false)).toBe('"grande.pdf" não foi enviado: tem 10,0 MB, e o limite é 10 MB.');
    expect(conferirArquivo({ name: "foto.jpg", size: 15.4 * 1024 * 1024, type: "image/jpeg" }, true)).toBe('"foto.jpg" não foi enviado: tem 15,4 MB, e o limite é 10 MB.');
  });
});
