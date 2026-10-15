import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SearchInput from "@/components/ui/search-input";
import type { Mentorado } from "@/lib/data/esquemas";
import { datasetDeTeste } from "@/test/fixtures";

import EscolherMentorado, { mentoradosQueCasam, mentoradoMostrado, PainelDeEscolha } from "./escolher-mentorado";

// Sem DOM o setState de depois do render não muda nada: o falso guarda o estado entre chamadas,
// na ordem dos useState, como o React faz no re-render. Com ele, o painel se chama como função.
const estado = vi.hoisted(() => ({ valores: [] as unknown[], proximo: 0 }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (inicial: unknown) => {
      const i = estado.proximo++;
      if (!(i in estado.valores)) estado.valores[i] = inicial;
      return [estado.valores[i], (valor: unknown) => void (estado.valores[i] = valor)];
    },
  };
});

// O Popover devolve só o gatilho sem DOM. O falso o deixa aberto e entrega o `fechar` ao filho.
const fechar = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/popover", () => ({
  default: ({ trigger, children }: { trigger(aberto: boolean): ReactNode; children: ReactNode | ((fechar: () => void) => ReactNode) }) => (
    <div>
      {trigger(true)}
      {typeof children === "function" ? children(fechar) : children}
    </div>
  ),
}));

type Props = Record<string, unknown> & { children?: ReactNode };
// Todo elemento da árvore (props.children) que a regra aceita.
function achar(no: ReactNode, regra: (el: ReactElement<Props>) => boolean): ReactElement<Props>[] {
  if (Array.isArray(no)) return no.flatMap((filho) => achar(filho, regra));
  if (typeof no !== "object" || no === null || !("props" in no)) return [];
  const el = no as ReactElement<Props>;
  return [...(regra(el) ? [el] : []), ...achar(el.props.children, regra)];
}

const ATIVOS = datasetDeTeste().mentorados.filter((m) => m.situacao === "ativo");
const [ANA, BRUNO, DIEGO] = ATIVOS;
// Mais dois nomes com "Silva" e acento, para a busca por partes.
const mais = (id: string, nome: string): Mentorado => ({ ...ANA, id, nome });
const LISTA = [...ATIVOS, mais("m5", "José da Silva"), mais("m6", "Ana Paula da Silva")];

// O painel numa chamada: lê o estado guardado (o destaque), como um re-render.
function painel(extra: { ativos?: Mentorado[]; escolhidoId?: string | null; termo?: string } = {}) {
  estado.proximo = 0;
  const onTermo = vi.fn<(termo: string) => void>();
  const onEscolher = vi.fn<(id: string) => void>();
  const arvore = PainelDeEscolha({ ativos: extra.ativos ?? LISTA, escolhidoId: extra.escolhidoId ?? null, termo: extra.termo ?? "", onTermo, onEscolher, fechar });
  const [campo] = achar(arvore, (el) => el.type === SearchInput) as [ReactElement<{ onChange(e: { target: { value: string } }): void; onKeyDown(e: { key: string; preventDefault(): void }): void }>];
  const linhas = achar(arvore, (el) => el.props.role === "option") as ReactElement<{ onClick(): void; "aria-selected": boolean; children: ReactNode }>[];
  return { arvore, campo: campo.props, linhas, onTermo, onEscolher };
}
const tecla = (p: ReturnType<typeof painel>, key: string) => {
  const preventDefault = vi.fn();
  p.campo.onKeyDown({ key, preventDefault });
  return preventDefault;
};
const nomes = (p: ReturnType<typeof painel>) => p.linhas.map((l) => renderToStaticMarkup(<>{l.props.children}</>).replace(/<[^>]+>/g, ""));

describe("escolha de mentorado (UI-06, OPS-10)", () => {
  beforeEach(() => {
    estado.valores.length = 0;
    fechar.mockClear();
  });

  it("OPS-10: a busca casa sem caixa, sem acento e por partes, e só entre os ativos que a tela passa", () => {
    expect(mentoradosQueCasam(LISTA, "jose").map((m) => m.id)).toEqual(["m5"]);
    expect(mentoradosQueCasam(LISTA, "JOSÉ SILVA").map((m) => m.id)).toEqual(["m5"]);
    expect(mentoradosQueCasam(LISTA, "ana silva").map((m) => m.id)).toEqual(["m6"]);
    expect(mentoradosQueCasam(LISTA, "da silva").map((m) => m.id)).toEqual(["m5", "m6"]);
    expect(mentoradosQueCasam(LISTA, "  ").map((m) => m.id)).toEqual(LISTA.map((m) => m.id));
    expect(mentoradosQueCasam(LISTA, "carla")).toEqual([]);
  });

  it("sem escolha, a tela mostra o primeiro ativo; o escolhido vale enquanto for ativo, e sem ativo ninguém", () => {
    expect(mentoradoMostrado(ATIVOS, null)).toBe("m1");
    expect(mentoradoMostrado(ATIVOS, "m2")).toBe("m2");
    // O escolhido deixou de ser ativo (pausou, cancelou): volta ao primeiro.
    expect(mentoradoMostrado(ATIVOS, "m4")).toBe("m1");
    expect(mentoradoMostrado(ATIVOS.slice(1), "m1")).toBe("m2");
    expect(mentoradoMostrado([], "m1")).toBeNull();
  });

  it("a lista traz só quem casa com o termo; o nome com HTML aparece escapado", () => {
    expect(nomes(painel({ termo: "da silva" }))).toEqual(["José da Silva", "Ana Paula da Silva"]);
    expect(nomes(painel())).toHaveLength(LISTA.length);
    const html = renderToStaticMarkup(<EscolherMentorado ativos={[DIEGO]} escolhidoId={null} termo="" onTermo={() => undefined} onEscolher={() => undefined} />);
    expect(html).not.toContain("<img");
    expect(html).toContain("Diego &quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
  });

  it("digitar só recorta a lista: avisa o termo e não escolhe ninguém", () => {
    const p = painel();
    p.campo.onChange({ target: { value: "bruno" } });
    expect(p.onTermo.mock.calls).toEqual([["bruno"]]);
    expect(p.onEscolher).not.toHaveBeenCalled();
    expect(fechar).not.toHaveBeenCalled();
  });

  it("Enter escolhe o primeiro que casa e fecha a lista", () => {
    const p = painel({ termo: "da silva" });
    expect(tecla(p, "Enter")).toHaveBeenCalled();
    expect(p.onEscolher.mock.calls).toEqual([["m5"]]);
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it("a seta troca o destaque antes do Enter, sem passar das pontas", () => {
    const termo = "da silva";
    tecla(painel({ termo }), "ArrowDown");
    expect(painel({ termo }).linhas.map((l) => l.props["aria-selected"])).toEqual([false, true]);
    tecla(painel({ termo }), "ArrowDown"); // já no último: fica
    expect(painel({ termo }).linhas.map((l) => l.props["aria-selected"])).toEqual([false, true]);
    const ultimo = painel({ termo });
    tecla(ultimo, "Enter");
    expect(ultimo.onEscolher.mock.calls).toEqual([["m6"]]);
    tecla(painel({ termo }), "ArrowUp");
    tecla(painel({ termo }), "ArrowUp"); // já no primeiro: fica
    expect(painel({ termo }).linhas.map((l) => l.props["aria-selected"])).toEqual([true, false]);
  });

  it("digitar volta o destaque ao primeiro; escolher também", () => {
    tecla(painel({ termo: "da silva" }), "ArrowDown");
    painel({ termo: "da silva" }).campo.onChange({ target: { value: "da silv" } });
    expect(painel({ termo: "da silv" }).linhas.map((l) => l.props["aria-selected"])).toEqual([true, false]);
    tecla(painel({ termo: "da silva" }), "ArrowDown");
    painel({ termo: "da silva" }).linhas[1].props.onClick();
    expect(painel({ termo: "da silva" }).linhas.map((l) => l.props["aria-selected"])).toEqual([true, false]);
  });

  it("Enter sem ninguém que case não escolhe nem fecha, e a lista diz que não achou", () => {
    const p = painel({ termo: "zzz" });
    tecla(p, "Enter");
    expect(p.onEscolher).not.toHaveBeenCalled();
    expect(fechar).not.toHaveBeenCalled();
    expect(p.linhas).toEqual([]);
    expect(renderToStaticMarkup(<>{p.arvore}</>)).toContain("Nenhum mentorado ativo com esse nome.");
  });

  it("o clique numa linha escolhe aquele mentorado e fecha; a linha do escolhido diz 'aberto agora'", () => {
    const p = painel({ escolhidoId: "m2" });
    p.linhas[1].props.onClick();
    expect(p.onEscolher.mock.calls).toEqual([[BRUNO.id]]);
    expect(fechar).toHaveBeenCalledTimes(1);
    const html = renderToStaticMarkup(<>{p.arvore}</>);
    expect(html.match(/aberto agora/g)).toHaveLength(1);
    expect(html).toMatch(/Bruno Dias<\/span><small[^>]*>aberto agora/);
  });
});
