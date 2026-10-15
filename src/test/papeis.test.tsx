import type { ComponentProps, ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "@/components/modules/dashboard/dashboard";
import Ficha from "@/components/modules/ficha/ficha";
import Financeiro from "@/components/modules/financeiro/financeiro";
import Ia from "@/components/modules/ia/ia";
import Mentorados from "@/components/modules/mentorados/mentorados";
import Mentores from "@/components/modules/mentores/mentores";
import Nps from "@/components/modules/nps/nps";
import Rotas from "@/components/modules/rotas/rotas";
import Sessoes from "@/components/modules/sessoes/sessoes";
import Stlseller from "@/components/modules/stlseller/stlseller";
import { type Ui } from "@/components/shell/contexto";
import type { Dataset } from "@/lib/data/esquemas";
import { ABAS_FICHA } from "@/lib/endereco";
import { type Papel, pode } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

// WRITE-09 e GATE-08: os controles `data-escrita="Wnn"` que cada papel acha nas 10 telas, na
// ficha e nos modais que ele consegue abrir. A diretoria não acha nenhum, o admin acha pelo menos
// 10 e o mentor só os das capacidades dele (escreverSessao, escreverRotas, escreverNotas).

// Sem DOM, o setState depois do render no servidor não muda nada: o falso guarda o estado entre
// renders, com a chave no useId da chamada (a posição na árvore), para um modal que monta no meio
// da tela não deslocar o estado de quem vem depois. O editor de notas nasce pronto: a leitura da
// nota roda num efeito, que o render no servidor não roda, e é o editor pronto que leva o W10.
const estado = vi.hoisted(() => ({ valores: new Map<string, unknown>() }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  const carregando = (v: unknown) => typeof v === "object" && v !== null && (v as { fase?: unknown }).fase === "carregando";
  return {
    ...react,
    useState: (inicial: unknown) => {
      const id = react.useId();
      if (!estado.valores.has(id)) estado.valores.set(id, carregando(inicial) ? { fase: "pronto" } : typeof inicial === "function" ? (inicial as () => unknown)() : inicial);
      const definir = (valor: unknown) => {
        estado.valores.set(id, typeof valor === "function" ? (valor as (anterior: unknown) => unknown)(estado.valores.get(id)) : valor);
      };
      return [estado.valores.get(id), definir];
    },
  };
});
// O Button anota o onClick e desenha o de verdade: a varredura clica em cada um para abrir os modais.
const cliques = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  const evento = { preventDefault: () => undefined, stopPropagation: () => undefined, target: { value: "" }, currentTarget: { value: "" } };
  return {
    ...original,
    default: (props: ComponentProps<typeof original.default>) => {
      const onClick = props.onClick;
      if (onClick) cliques.push(() => onClick(evento as never));
      return createElement(original.default, props);
    },
  };
});
// O Dialog devolve null sem `document`: aberto, o falso desenha título, corpo e rodapé.
vi.mock("@/components/ui/dialog", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: { open: boolean; title?: ReactNode; children: ReactNode; footer?: ReactNode }) =>
      props.open ? createElement("dialog-falso", null, createElement("h2", null, props.title), props.children, props.footer) : null,
  };
});
// Nenhuma escrita sai: a porta responde com uma promessa que nunca termina.
vi.mock("@/lib/data/escritas", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/data/escritas")>();
  return Object.fromEntries(Object.entries(original).map(([nome, valor]) => [nome, typeof valor === "function" ? () => new Promise(() => undefined) : valor]));
});
vi.mock("@/lib/data/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/auth")>()),
  usuarioDaSessao: () => new Promise(() => undefined),
}));
vi.mock("react-hot-toast", () => ({ default: { error: () => undefined, success: () => undefined } }));

const escritasDe = (html: string) => [...html.matchAll(/data-escrita="(W\d+)"/g)].map((m) => m[1]);

// Os fixtures com um segundo canal na rota: o W06 só aparece quando a rota tem mais de um.
function dados(): Dataset {
  const d = datasetDeTeste();
  d.canais.push({ id: "c2", rota_id: "r1", nome: "Online", ordem: 2 });
  return d;
}

type Tela = { el: ReactElement; ui?: Partial<Ui> };

function render({ el, ui }: Tela, papel: Papel, manter = false): string {
  cliques.length = 0;
  if (!manter) estado.valores.clear();
  return renderTela(el, { papel, dados: dados(), ui });
}

// Repete os cliques de `caminho` a partir do estado inicial e devolve o HTML e os botões do fim.
function seguir(el: Tela, papel: Papel, caminho: number[]): { html: string; botoes: number } {
  let html = render(el, papel);
  for (const i of caminho) {
    cliques[i]();
    html = render(el, papel, true);
  }
  return { html, botoes: cliques.length };
}

// Os Wnn de uma tela de cara, depois de cada clique, e, quando o clique abre um modal, depois de
// cada clique dentro dele (o encontro em grupo abre a sessão de uma presença, por exemplo).
function varrer(el: Tela, papel: Papel): Set<string> {
  const achados = new Set<string>();
  const inicio = seguir(el, papel, []);
  escritasDe(inicio.html).forEach((w) => achados.add(w));
  for (let i = 0; i < inicio.botoes; i++) {
    const um = seguir(el, papel, [i]);
    escritasDe(um.html).forEach((w) => achados.add(w));
    if (!um.html.includes("<dialog-falso>") || inicio.html.includes("<dialog-falso>")) continue;
    for (let j = 0; j < um.botoes; j++) escritasDe(seguir(el, papel, [i, j]).html).forEach((w) => achados.add(w));
  }
  return achados;
}

// As telas que o papel abre (NAV-04, NAV-05), Rotas também com o marco aberto (o painel do W09),
// e a ficha nas abas que ele vê, de um mentorado com sessão 1:1, encontro em grupo, parcela e
// STLSeller (m1), de um com sessão aguardando confirmação (m2, o W04) e de um pausado (m4).
function telasDe(papel: Papel): Tela[] {
  const telas: Tela[] = [
    { el: <Dashboard modo="completo" /> },
    { el: <Dashboard modo="acompanhamento" /> },
    { el: <Mentorados /> },
    { el: <Sessoes /> },
    { el: <Rotas /> },
    { el: <Rotas />, ui: { marcoAberto: "mk1" } },
  ];
  if (pode(papel, "verIa")) telas.push({ el: <Ia /> });
  if (pode(papel, "verFinanceiro")) telas.push({ el: <Mentores /> }, { el: <Stlseller /> }, { el: <Nps /> }, { el: <Financeiro /> });
  const abas = ABAS_FICHA.filter((a) => pode(papel, "verFinanceiro") || (a !== "financeiro" && a !== "stlseller"));
  for (const id of ["m1", "m2", "m4"]) for (const aba of abas) telas.push({ el: <Ficha id={id} aba={aba} /> });
  return telas;
}

const varrerPapel = (papel: Papel) => {
  const achados = new Set<string>();
  for (const tela of telasDe(papel)) varrer(tela, papel).forEach((w) => achados.add(w));
  return [...achados].sort();
};

describe("controles de escrita por papel (WRITE-09, GATE-08)", () => {
  beforeEach(() => {
    estado.valores.clear();
  });

  it("diretoria: nenhum controle de escrita nas 10 telas, na ficha nas 5 abas e nos modais", () => {
    expect(telasDe("diretoria")).toHaveLength(11 + 3 * 5);
    expect(varrerPapel("diretoria")).toEqual([]);
  });

  it("admin: a mesma varredura acha pelo menos 10 controles de escrita diferentes", () => {
    const achados = varrerPapel("admin");
    expect(achados.length).toBeGreaterThanOrEqual(10);
    // As escritas que só o admin tem, uma de cada capacidade, aparecem: a varredura enxerga a tela.
    for (const w of ["W02", "W05", "W08", "W11", "W12", "W13", "W14", "W15", "W16", "W17", "W18", "W19", "W20", "W21"]) expect(achados, w).toContain(w);
  });

  it("mentor: só W01, W03, W04, W06, W07, W09 e W10", () => {
    expect(varrerPapel("mentor")).toEqual(["W01", "W03", "W04", "W06", "W07", "W09", "W10"]);
  });
});
