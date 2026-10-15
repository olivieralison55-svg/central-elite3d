import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Navegador, NavegarProvider, UI_INICIAL, UiProvider, useNavegar, useUi, type ValorUi } from "./contexto";

// O roteador do Next só existe dentro do App Router: aqui ele é um falso que anota os pedidos.
const roteador = vi.hoisted(() => ({ pedidos: [] as Array<["push" | "replace", string]> }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (destino: string) => roteador.pedidos.push(["push", destino]),
    replace: (destino: string) => roteador.pedidos.push(["replace", destino]),
  }),
  usePathname: () => "/sessoes",
}));

const ORIGEM = "https://central-elite3d.vercel.app";

function navegadorMontado(): Navegador {
  const visto: { valor?: Navegador } = {};
  function Sonda() {
    visto.valor = useNavegar();
    return null;
  }
  renderToStaticMarkup(
    <NavegarProvider>
      <Sonda />
    </NavegarProvider>,
  );
  if (!visto.valor) throw new Error("NavegarProvider não entregou o navegador");
  return visto.valor;
}

describe("contextos da casca (STACK-02, SEC-01)", () => {
  beforeEach(() => {
    roteador.pedidos.length = 0;
    vi.stubGlobal("window", { location: { origin: ORIGEM } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("useNavegar embrulha useRouter e usePathname: o caminho atual, e o destino da mesma origem entregue ao roteador", () => {
    const navegar = navegadorMontado();
    expect(navegar.caminho).toBe("/sessoes");
    navegar.ir("/mentorado/m1/financeiro");
    navegar.substituir("/dash");
    navegar.ir(`${ORIGEM}/rotas`);
    expect(roteador.pedidos).toEqual([
      ["push", "/mentorado/m1/financeiro"],
      ["replace", "/dash"],
      ["push", `${ORIGEM}/rotas`],
    ]);
  });

  it("SEC-01: os vetores do THREAT-01, como caminho, vão para /dash e não chegam ao roteador", () => {
    // O caminho que uma ponte ingênua montaria de cada hash: sem o `#`, decodificado.
    const hashes = [
      "#//evil.example/login",
      "#/\\evil.example",
      "#/\\\\evil.example",
      "#/%2F%2Fevil.example",
      "#/%09/evil.example",
      "#javascript:alert(1)",
    ];
    const navegar = navegadorMontado();
    for (const hash of hashes) {
      const destino = decodeURIComponent(hash.slice(1));
      expect(new URL(destino, ORIGEM).origin, destino).not.toBe(ORIGEM);
      navegar.ir(destino);
      navegar.substituir(destino);
    }
    expect(roteador.pedidos).toEqual(hashes.flatMap(() => [["push", "/dash"], ["replace", "/dash"]]));
  });

  it("Ui começa com as chaves do design: o filtro inteiro de hoje, voltarPara em /mentorados e o resto vazio", () => {
    const visto: { valor?: ValorUi } = {};
    function Sonda() {
      visto.valor = useUi();
      return null;
    }
    renderToStaticMarkup(
      <UiProvider>
        <Sonda />
      </UiProvider>,
    );
    const esperado = {
      filtro: {
        q: "",
        mentor: "",
        statusFin: "",
        tipoSessao: "",
        qDash: "",
        qSessoes: "",
        qFin: "",
        qRotas: "",
        qAnalise: "",
        qNps: "",
        npsPeriodo: "semana",
        npsMentor: "",
        mentorSel: "",
        npsPagPeriodo: 1,
        npsPagResp: 1,
        npsAba: "sessoes",
        iaAba: "geral",
        iaSel: "",
      },
      mesMatriz: null,
      foco: null,
      rotaAtual: null,
      rotaMentoradoId: null,
      marcoAberto: null,
      voltarPara: "/mentorados",
      sortState: {},
    };
    expect(UI_INICIAL).toEqual(esperado);
    expect(visto.valor?.ui).toEqual(esperado);
  });
});
