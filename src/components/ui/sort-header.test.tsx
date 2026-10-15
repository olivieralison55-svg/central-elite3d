import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SortHeader, { type SortDirection } from "./sort-header";

const nada = () => {};
const markup = (direction: SortDirection) => renderToStaticMarkup(<SortHeader label="Nome" direction={direction} onToggle={nada} />);

// O ícone do lucide desenhado no cabeçalho, pela classe `lucide-<nome>`.
const icone = (html: string) => /\blucide-(arrow-[a-z-]+)(?=[\s"])/.exec(html)?.[1];

describe("SortHeader (UI-06)", () => {
  it("desenha um ícone para asc, outro para desc e outro sem direção", () => {
    expect(icone(markup("asc"))).toBe("arrow-up");
    expect(icone(markup("desc"))).toBe("arrow-down");
    expect(icone(markup(null))).toBe("arrow-up-down");
  });

  it("o aria-label diz a coluna e o estado da ordem", () => {
    const rotulo = (html: string) => /^<button\b[^>]*\baria-label="([^"]*)"/.exec(html)?.[1];
    expect(rotulo(markup("asc"))).toBe("Nome, ordem crescente");
    expect(rotulo(markup("desc"))).toBe("Nome, ordem decrescente");
    expect(rotulo(markup(null))).toBe("Nome, sem ordenação");
    expect(markup(null)).toMatch(/^<button\b[^>]*>Nome<svg\b/);
  });

  it("o cabeçalho é um botão, e o clique chama onToggle", () => {
    let cliques = 0;
    const botao = SortHeader({ label: "Nome", direction: "asc", onToggle: () => (cliques += 1) });
    expect(botao.type).toBe("button");
    const clicar: unknown = botao.props.onClick;
    if (typeof clicar !== "function") throw new Error("cabeçalho sem onClick");
    clicar();
    expect(cliques).toBe(1);
  });
});
