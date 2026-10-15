import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import NaoEncontrado from "./not-found";
import Inicio from "./page";

// O roteador do Next só existe dentro do App Router: aqui ele é um falso que anota os pedidos.
const roteador = vi.hoisted(() => ({ pedidos: [] as Array<["push" | "replace", string]> }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (destino: string) => roteador.pedidos.push(["push", destino]),
    replace: (destino: string) => roteador.pedidos.push(["replace", destino]),
  }),
  usePathname: () => "/",
}));

// Sem DOM, o React não roda efeito: o falso só guarda cada useEffect do render.
const efeitos = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (fn: () => unknown) => {
    efeitos.push(fn);
  },
}));

const ORIGEM = "https://central-elite3d.vercel.app";

// Abre a página como o browser: o servidor renderiza, e o mount roda os efeitos com o hash do
// endereço. Devolve o que chegou ao roteador.
function abrir(Pagina: ComponentType, hash: string) {
  efeitos.length = 0;
  roteador.pedidos.length = 0;
  renderToStaticMarkup(<Pagina />);
  vi.stubGlobal("window", { location: { origin: ORIGEM, hash } });
  for (const efeito of efeitos) efeito();
  return [...roteador.pedidos];
}

describe("ponte do link antigo e caminho desconhecido (NAV-02, NAV-03, CUT-02, SEC-01)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("NAV-02 e CUT-02: o hash antigo de tela conhecida troca o endereço pelo caminho dela, sem entrada nova no histórico", () => {
    expect(abrir(Inicio, "#/mentorado/m1/financeiro")).toEqual([["replace", "/mentorado/m1/financeiro"]]);
    expect(abrir(Inicio, "#/sessoes")).toEqual([["replace", "/sessoes"]]);
  });

  it("NAV-02 e SEC-01: sem hash, ou com hash fora das formas conhecidas, abre o /dash", () => {
    for (const hash of ["", "#//evil.example/login"]) expect(abrir(Inicio, hash), hash).toEqual([["replace", "/dash"]]);
  });

  it("NAV-03: caminho desconhecido abre o /dash", () => {
    expect(abrir(NaoEncontrado, "")).toEqual([["replace", "/dash"]]);
  });
});
