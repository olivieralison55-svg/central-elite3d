import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import LayoutDoApp from "@/app/(app)/layout";
import type { Papel } from "@/lib/papeis";
import { navegadorFalso, renderTela } from "@/test/render";

import Casca, { aplicarCaminho, Moldura } from "./casca";
import { UI_INICIAL, type Ui, UiContexto } from "./contexto";
import { Carregando } from "./sessao";

// O roteador do Next só existe dentro do App Router: aqui é um falso que não navega.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  usePathname: () => "/sessoes",
}));

// Sem DOM, o React não roda efeito: o falso só guarda cada useEffect (função e deps) do render.
const efeitos = vi.hoisted(() => [] as Array<{ fn: () => unknown; deps?: readonly unknown[] }>);
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (fn: () => unknown, deps?: readonly unknown[]) => {
    efeitos.push({ fn, deps });
  },
}));

const RAIZ = fileURLToPath(new URL("../../..", import.meta.url));

// Aplica os caminhos em ordem sobre o estado de tela, como o efeito da Moldura a cada troca.
function percorrer(papel: Papel, caminhos: string[], inicio: Partial<Ui> = {}) {
  let ui: Ui = { ...UI_INICIAL, ...inicio };
  const mudancas: Array<Partial<Ui>> = [];
  const navegar = navegadorFalso();
  for (const caminho of caminhos) {
    aplicarCaminho(
      caminho,
      papel,
      (parcial) => {
        mudancas.push(parcial);
        ui = { ...ui, ...parcial };
      },
      navegar.substituir,
    );
  }
  return { ui, mudancas, chamadas: navegar.chamadas };
}

// A troca de caminho com a casca montada: o layout do App Router não remonta, a Moldura só
// re-renderiza, e o React roda de novo cada efeito cujas deps mudaram (Object.is, na ordem dos
// hooks). Sessão, estado de tela e navegação ficam os mesmos; só o caminho muda.
function trocarCaminho(papel: Papel, de: string, para: string) {
  const mudancas: Array<Partial<Ui>> = [];
  const mudar = (parcial: Partial<Ui>) => {
    mudancas.push(parcial);
  };
  const navegar = navegadorFalso(de);
  const render = (caminho: string) => {
    efeitos.length = 0;
    renderTela(
      <UiContexto.Provider value={{ ui: UI_INICIAL, mudar }}>
        <Moldura>
          <p>tela</p>
        </Moldura>
      </UiContexto.Provider>,
      { papel, navegar: { ...navegar, caminho } },
    );
    return [...efeitos];
  };
  const antes = render(de);
  render(para).forEach(({ fn, deps }, i) => {
    const anteriores = antes[i]?.deps;
    if (!deps || !anteriores || deps.length !== anteriores.length || deps.some((dep, j) => !Object.is(dep, anteriores[j]))) fn();
  });
  return { chamadas: navegar.chamadas, mudancas };
}

const FOCO = { ids: ["s3"], titulo: "Aguardando confirmação sem mentor definido", dica: "Defina o mentor pela ficha do mentorado." };

describe("casca (NAV-04, NAV-07, NAV-10, UI-08)", () => {
  it("NAV-04: tela sem permissão → substituir('/dash'), e a tela nem renderiza", () => {
    for (const caminho of ["/financeiro", "/analise", "/nps", "/mentores"]) {
      const mentor = percorrer("mentor", [caminho]);
      expect([mentor.chamadas, mentor.mudancas], caminho).toEqual([[["substituir", "/dash"]], []]);
      for (const papel of ["admin", "diretoria"] as const) expect(percorrer(papel, [caminho]).chamadas, `${papel} ${caminho}`).toEqual([]);
    }

    const tela = (papel: Papel) => renderTela(<Moldura><p>tela financeira</p></Moldura>, { papel, navegar: navegadorFalso("/financeiro") });
    expect(tela("mentor")).not.toContain("tela financeira");
    expect(tela("mentor")).toContain(renderToStaticMarkup(<Carregando />));
    expect(tela("diretoria")).toContain("<p>tela financeira</p>");
  });

  it("NAV-10: o foco do aviso fica em Sessões e é descartado quando a pessoa sai de lá", () => {
    const emSessoes = percorrer("admin", ["/sessoes"], { foco: FOCO });
    expect([emSessoes.ui.foco, emSessoes.mudancas]).toEqual([FOCO, [{ voltarPara: "/sessoes" }]]);
    for (const destino of ["/dash", "/rotas", "/mentorado/m1"]) {
      expect(percorrer("admin", ["/sessoes", destino], { foco: FOCO }).ui.foco, destino).toBeNull();
    }
  });

  it("voltarPara: toda tela fora da ficha o grava; a ficha o mantém, e o link colado fica com /mentorados", () => {
    expect(percorrer("admin", ["/dash", "/sessoes", "/mentorado/m1/financeiro"]).mudancas).toEqual([
      { foco: null, voltarPara: "/dash" },
      { voltarPara: "/sessoes" },
      { foco: null },
    ]);
    expect(percorrer("mentor", ["/sessoes", "/mentorado/m1/sessoes"]).ui.voltarPara).toBe("/sessoes");
    expect(percorrer("mentor", ["/sessoes", "/mentorado/m1", "/mentorados"]).ui.voltarPara).toBe("/mentorados");
    expect(percorrer("mentor", ["/mentorado/m1"]).ui.voltarPara).toBe("/mentorados");
  });

  it("NAV-04, NAV-07 e NAV-10: a casca fica montada na troca de caminho, e as regras rodam de novo no caminho novo", () => {
    // Clique, voltar e avançar só entregam o caminho novo à mesma Moldura (NAV-07).
    expect(trocarCaminho("mentor", "/sessoes", "/financeiro")).toEqual({ chamadas: [["substituir", "/dash"]], mudancas: [] });
    expect(trocarCaminho("admin", "/sessoes", "/dash")).toEqual({ chamadas: [], mudancas: [{ foco: null, voltarPara: "/dash" }] });
  });

  it("NAV-07: a navegação usa só o roteador do Next: ninguém escreve no location nem no history, nem ouve hashchange ou popstate", () => {
    const roteadorProprio = /location\.(?:hash|href)\s*=(?!=)|location\.(?:assign|replace)\s*\(|history\.(?:pushState|replaceState)\s*\(|["'`](?:hashchange|popstate)["'`]|\bon(?:hashchange|popstate)\b|\buseRouter\s*\(/g;
    const ruim = 'location.hash = "#/dash";\nwindow.location.href = destino;\nhistory.pushState(null, "", "/x");\naddEventListener("hashchange", f);\nwindow.onpopstate = f;\nconst r = useRouter();';
    expect(ruim.match(roteadorProprio)).toHaveLength(6);

    const arquivos = ["src/components/shell", "src/components/modules", "src/app"]
      .filter((pasta) => existsSync(join(RAIZ, pasta)))
      .flatMap((pasta) => readdirSync(join(RAIZ, pasta), { recursive: true, withFileTypes: true }))
      .filter((d) => d.isFile() && /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name))
      .map((d) => relative(RAIZ, join(d.parentPath, d.name)));
    expect(arquivos).toEqual(expect.arrayContaining(["src/components/shell/casca.tsx", "src/components/shell/menu.tsx", "src/app/layout.tsx"]));
    // O useRouter só dentro da useNavegar, que recusa destino de outra origem (SEC-01).
    const achados = arquivos.flatMap((caminho) =>
      [...readFileSync(join(RAIZ, caminho), "utf8").matchAll(roteadorProprio)]
        .filter((m) => !(caminho === "src/components/shell/contexto.tsx" && m[0].startsWith("useRouter")))
        .map((m) => `${caminho}: ${m[0]}`),
    );
    expect(achados).toEqual([]);
  });

  it("o servidor renderiza só o Skeleton: nada de sessão, dado, menu ou relógio, na Casca e no layout do grupo (app)", () => {
    const skeleton = renderToStaticMarkup(<Carregando />);
    expect(renderToStaticMarkup(<Casca><p>tela</p></Casca>)).toBe(skeleton);
    expect(renderToStaticMarkup(<LayoutDoApp><p>tela</p></LayoutDoApp>)).toBe(skeleton);
  });
});
