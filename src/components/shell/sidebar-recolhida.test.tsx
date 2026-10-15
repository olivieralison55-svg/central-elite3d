import { describe, expect, it, vi } from "vitest";

import { navegadorFalso, renderTela } from "@/test/render";

import { Moldura } from "./casca";
import { Usuario } from "./menu";

// A sidebar recolhe como a da product-ops: 68px, o selo 3D, só os ícones e o avatar.
// Sem DOM não há clique: o estado de recolhida é a primeira chamada de useState da Moldura, e o
// falso força o valor dele para conferir o deslocamento do conteúdo.
const estado = vi.hoisted(() => ({ chamada: 0, recolhida: undefined as boolean | undefined }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useEffect: () => undefined,
    useState: <T,>(inicial: T | (() => T)) => {
      const par = react.useState(inicial);
      if (estado.chamada++ === 0 && estado.recolhida !== undefined) return [estado.recolhida as T, par[1]] as const;
      return par;
    },
  };
});

const tela = (recolhida: boolean) => {
  estado.chamada = 0;
  estado.recolhida = recolhida;
  return renderTela(<Moldura><p>tela</p></Moldura>, { papel: "admin", navegar: navegadorFalso("/dash") });
};

describe("sidebar recolhível (como a product-ops)", () => {
  it("aberta: 240px, a logo inteira, os rótulos e o botão Recolher; o conteúdo começa em 240px", () => {
    const html = tela(false);
    expect(html).toMatch(/<aside class="[^"]*w-\[240px\]/);
    expect(html).toMatch(/<main class="[^"]*md:ml-\[240px\]/);
    expect(html).toContain('aria-label="Recolher o menu"');
    expect(html).not.toContain('aria-label="Expandir o menu"');
    expect(html).toContain(">Mentorados</a>");
  });

  it("recolhida: 68px, o selo 3D nas duas cores, ícones sem rótulo (o nome no title), avatar e Sair; o conteúdo começa em 68px", () => {
    const html = tela(true);
    const aside = /<aside[\s\S]*?<\/aside>/.exec(html)?.[0] ?? "";
    expect(aside).toMatch(/^<aside class="[^"]*w-\[68px\]/);
    expect(html).toMatch(/<main class="[^"]*md:ml-\[68px\]/);
    expect(aside).toContain('aria-label="Expandir o menu"');
    expect(aside).not.toContain('aria-label="Recolher o menu"');
    expect(aside).toContain('src="/logo-elite3d-icone-preta.png"');
    expect(aside).toContain('src="/logo-elite3d-icone-branca.png"');
    expect(aside).not.toContain("logo-elite3d-preta.png");
    expect(aside).toContain('title="Mentorados"');
    expect(aside).not.toContain(">Mentorados</a>");
    expect(aside).toContain('aria-label="Sair"');
    // O cabeçalho mobile não recolhe: segue com a logo inteira.
    expect(html.slice(html.indexOf("</aside>"))).toContain('src="/logo-elite3d-preta.png"');
  });

  it("o Usuario recolhido leva nome e papel no title e o Sair chama sair", async () => {
    estado.recolhida = undefined;
    const sair = vi.fn(() => Promise.resolve());
    const el = Usuario({ nome: "Chay", papel: "admin", sair, recolhido: true });
    expect(el.props.title).toBe("Chay · Administrador");
    const botao = (el.props.children as Array<{ props: { onClick: () => void; "aria-label": string } }>)[1];
    expect(botao.props["aria-label"]).toBe("Sair");
    botao.props.onClick();
    expect(sair).toHaveBeenCalledTimes(1);
  });

});
