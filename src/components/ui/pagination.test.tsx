import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Button from "./button";
import Pagination from "./pagination";

type Elemento = ReactElement<Record<string, unknown>>;

// Os elementos de uma árvore devolvida por um componente sem hooks: serve para clicar sem DOM.
function elementos(no: unknown): Elemento[] {
  if (Array.isArray(no)) return no.flatMap(elementos);
  if (!isValidElement<Record<string, unknown>>(no)) return [];
  return [no, ...Object.values(no.props).flatMap(elementos)];
}

// Os botões do markup, na ordem: o rótulo acessível e se estão desabilitados.
const botoes = (html: string) =>
  [...html.matchAll(/<button\b([^>]*)>/g)].map(([, atributos]) => ({
    rotulo: /\baria-label="([^"]*)"/.exec(atributos)?.[1],
    desabilitado: /\bdisabled=""/.test(atributos),
  }));

const nada = () => {};
const markup = (page: number, pageCount: number) =>
  renderToStaticMarkup(<Pagination page={page} pageCount={pageCount} onChange={nada} label="Paginação das respostas" />);

describe("Pagination (UI-06, GER-03)", () => {
  it("na página 1, Anterior fica desabilitado e Próxima não; o texto diz 'Página 1 de 3'", () => {
    const html = markup(1, 3);
    expect(botoes(html).map((b) => b.desabilitado)).toEqual([true, false]);
    expect(html).toContain("Página 1 de 3");
  });

  it("na última página, Próxima fica desabilitado e Anterior não; com uma página só, os dois", () => {
    const html = markup(3, 3);
    expect(botoes(html).map((b) => b.desabilitado)).toEqual([false, true]);
    expect(html).toContain("Página 3 de 3");
    expect(botoes(markup(2, 3)).map((b) => b.desabilitado)).toEqual([false, false]);
    expect(botoes(markup(1, 1)).map((b) => b.desabilitado)).toEqual([true, true]);
  });

  it("os dois botões têm aria-label, e a navegação leva o label dela", () => {
    const html = markup(2, 3);
    expect(botoes(html).map((b) => b.rotulo)).toEqual(["Página anterior", "Próxima página"]);
    expect(html).toMatch(/^<nav\b[^>]*\baria-label="Paginação das respostas"/);
  });

  it("Anterior pede a página de antes e Próxima a de depois", () => {
    const pedidas: number[] = [];
    const arvore = Pagination({ page: 2, pageCount: 3, onChange: (pagina) => pedidas.push(pagina), label: "Paginação" });
    const [anterior, proxima] = elementos(arvore).filter((el) => el.type === Button);
    for (const botao of [anterior, proxima]) {
      const clicar = botao.props.onClick;
      if (typeof clicar !== "function") throw new Error("botão sem onClick");
      clicar();
    }
    expect(pedidas).toEqual([1, 3]);
  });
});
