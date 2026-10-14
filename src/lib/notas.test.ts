import type { Config, UponSanitizeAttributeHookEvent } from "dompurify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { atalhoPara, criarAutosave, filtrarClasses, linkValido, NOTA_TAGS, type Purificador, sanitizarNota } from "./notas";

// O grupo "Notas" do harness antigo (tests/testes.mjs:1768–1783) e as regras do AD-004. O
// DOMPurify de verdade não sanitiza sem DOM: os testes de NOTE-02 injetam um falso que anota a
// config e roda o gancho de atributo sobre os eventos que o teste manda (design, componente 11).

type Gancho = (no: Element, evento: UponSanitizeAttributeHookEvent) => void;

function purificador({ suportado = true, eventos = [] as UponSanitizeAttributeHookEvent[], falhar = false } = {}) {
  const ganchos: Gancho[] = [];
  const chamadas: Array<[string, Config]> = [];
  const removidos: unknown[] = [];
  const purify: Purificador = {
    isSupported: suportado,
    sanitize: (html, config) => {
      chamadas.push([html, config]);
      for (const evento of eventos) for (const gancho of ganchos) gancho({} as Element, evento);
      if (falhar) throw new Error("falhou");
      return `[limpo]${html}`;
    },
    addHook: (_ponto, gancho) => void ganchos.push(gancho),
    removeHook: (_ponto, gancho) => {
      removidos.push(gancho);
      ganchos.splice(ganchos.indexOf(gancho as Gancho), 1);
    },
  };
  return { purify, chamadas, ganchos, removidos };
}

const evento = (attrName: string, attrValue: string): UponSanitizeAttributeHookEvent => ({ attrName, attrValue, keepAttr: true, allowedAttributes: {}, forceKeepAttr: undefined });

describe("regras das notas (NOTE-02, NOTE-03, NOTE-04, NOTE-05, NOTE-07, NOTE-08)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("NOTE-02: as 22 tags de hoje", () => {
    expect(NOTA_TAGS).toEqual(["p", "br", "div", "h1", "h2", "h3", "b", "strong", "i", "em", "u", "s", "strike", "ul", "ol", "li", "blockquote", "pre", "code", "hr", "a", "span"]);
  });

  it("NOTE-02: sanitizarNota chama o purify com NOTA_TAGS, só href e class, sem data-* e href só http(s), e devolve o que ele limpou", () => {
    const { purify, chamadas } = purificador();
    expect(sanitizarNota('<h1 data-x="1">Título</h1><a href="https://exemplo.com">x</a>', purify)).toBe('[limpo]<h1 data-x="1">Título</h1><a href="https://exemplo.com">x</a>');
    expect(chamadas).toHaveLength(1);
    const [html, config] = chamadas[0];
    expect(html).toBe('<h1 data-x="1">Título</h1><a href="https://exemplo.com">x</a>');
    expect({ ...config, ALLOWED_URI_REGEXP: undefined }).toEqual({ ALLOWED_TAGS: [...NOTA_TAGS], ALLOWED_ATTR: ["href", "class"], ALLOW_DATA_ATTR: false, ALLOWED_URI_REGEXP: undefined });
    const uri = config.ALLOWED_URI_REGEXP;
    if (!uri) throw new Error("ALLOWED_URI_REGEXP ausente");
    for (const ok of ["http://exemplo.com", "https://exemplo.com/a?b=1", "HTTPS://EXEMPLO.COM"]) expect(uri.test(ok), ok).toBe(true);
    for (const recusado of ["javascript:alert(1)", "data:text/html,<b>x</b>", "mailto:a@b.com", "ftp://exemplo.com", "/relativo", "#ancora", "vbscript:x"]) {
      expect(uri.test(recusado), recusado).toBe(false);
    }
    // O http(s) vale só no começo: outro esquema que cita http: ou https: depois não passa (THREAT-07).
    for (const recusado of ["javascript:alert('https://x')", "javascript:fetch('http://evil.example')", "data:text/html,https://x"]) {
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

  it("NOTE-02 e THREAT-07: o gancho de atributo deixa no class só checklist e feito, tira o class vazio e não mexe no href", () => {
    const fixo = evento("class", "fixed inset-0 z-50 checklist");
    const so = evento("class", "fixed inset-0");
    const link = evento("href", "https://exemplo.com");
    const feito = evento("class", "checklist feito");
    const { purify, ganchos, removidos } = purificador({ eventos: [fixo, so, link, feito] });
    sanitizarNota("<ul class='checklist'></ul>", purify);
    expect([fixo.attrValue, fixo.keepAttr]).toEqual(["checklist", true]);
    expect([so.attrValue, so.keepAttr]).toEqual(["", false]);
    expect([link.attrValue, link.keepAttr]).toEqual(["https://exemplo.com", true]);
    expect([feito.attrValue, feito.keepAttr]).toEqual(["checklist feito", true]);
    // O gancho sai depois de cada chamada, também quando o sanitize lança: não vaza para outro uso do DOMPurify.
    expect(ganchos).toEqual([]);
    expect(removidos).toHaveLength(1);
    const comFalha = purificador({ falhar: true });
    expect(() => sanitizarNota("<b>x</b>", comFalha.purify)).toThrow("falhou");
    expect(comFalha.ganchos).toEqual([]);
  });

  it("filtrarClasses deixa só checklist e feito", () => {
    expect(filtrarClasses("fixed inset-0 z-50 checklist")).toBe("checklist");
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
});
