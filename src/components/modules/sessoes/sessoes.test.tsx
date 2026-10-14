import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { UI_INICIAL, type Ui, UiContexto } from "@/components/shell/contexto";
import EmptyState from "@/components/ui/empty-state";
import type { Dataset, Sessao } from "@/lib/data/esquemas";
import type { Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Sessoes from "./sessoes";

// Os falsos anotam as props de Button, Select, SearchInput, SegmentedControl e SortHeader e
// desenham o de verdade: o teste chama o handler anotado, que não vai para o HTML.
const vistos = vi.hoisted(() => [] as Array<{ tipo: string; props: Record<string, unknown> }>);
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return {
    ...original,
    default: (props: ComponentProps<typeof original.default>) => {
      vistos.push({ tipo: "button", props: { ...props } });
      return createElement(original.default, props);
    },
  };
});
vi.mock("@/components/ui/select", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/select")>();
  return {
    ...original,
    default: (props: ComponentProps<typeof original.default>) => {
      vistos.push({ tipo: "select", props });
      return createElement(original.default, props);
    },
  };
});
vi.mock("@/components/ui/search-input", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/search-input")>();
  return {
    ...original,
    default: (props: ComponentProps<typeof original.default>) => {
      vistos.push({ tipo: "busca", props: { ...props } });
      return createElement(original.default, props);
    },
  };
});
vi.mock("@/components/ui/segmented-control", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/segmented-control")>();
  return {
    ...original,
    default: (props: ComponentProps<typeof original.default<string>>) => {
      vistos.push({ tipo: "tipo", props });
      return createElement(original.default<string>, props);
    },
  };
});
vi.mock("@/components/ui/sort-header", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/sort-header")>();
  return {
    ...original,
    default: (props: ComponentProps<typeof original.default>) => {
      vistos.push({ tipo: "ordem", props });
      return createElement(original.default, props);
    },
  };
});

// Sem DOM, o setState que chega depois do render no servidor não muda nada: o falso guarda o
// estado entre renders, na ordem dos useState, como o React faz no re-render.
const estado = vi.hoisted(() => ({ valores: [] as unknown[], proximo: 0 }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (inicial: unknown) => {
      const i = estado.proximo++;
      if (!(i in estado.valores)) estado.valores[i] = typeof inicial === "function" ? (inicial as () => unknown)() : inicial;
      const definir = (valor: unknown) => {
        estado.valores[i] = typeof valor === "function" ? (valor as (anterior: unknown) => unknown)(estado.valores[i]) : valor;
      };
      return [estado.valores[i], definir];
    },
  };
});
// O Dialog devolve null sem `document`: o falso desenha o conteúdo num elemento falso quando aberto.
vi.mock("@/components/ui/dialog", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: { open: boolean; onClose(): void; title?: ReactNode; children: ReactNode }) => {
      vistos.push({ tipo: "dialog", props: { ...props } });
      return props.open ? createElement("dialog-falso", { "data-titulo": props.title }, props.children) : null;
    },
  };
});

// `manter` re-renderiza com o estado do render anterior; sem ele, a tela começa do zero.
function tela(papel: Papel, { dados = datasetDeTeste(), ui = {}, manter = false }: { dados?: Dataset; ui?: Partial<Ui>; manter?: boolean } = {}) {
  const mudancas: Array<Partial<Ui>> = [];
  vistos.length = 0;
  estado.proximo = 0;
  if (!manter) estado.valores.length = 0;
  const html = renderTela(
    <UiContexto.Provider value={{ ui: { ...UI_INICIAL, ...ui }, mudar: (parcial) => mudancas.push(parcial) }}>
      <Sessoes />
    </UiContexto.Provider>,
    { papel, dados },
  );
  return { html, mudancas, vistos: [...vistos] };
}
function prop(lista: typeof vistos, tipo: string, casa: (p: Record<string, unknown>) => boolean, nome: string): unknown {
  const achados = lista.filter((v) => v.tipo === tipo && casa(v.props));
  expect(achados, `${tipo} único`).toHaveLength(1);
  return achados[0].props[nome];
}
const chamar = (fn: unknown, ...args: unknown[]) => {
  if (typeof fn !== "function") throw new Error("handler ausente");
  return fn(...args);
};
const secao = (html: string, rotulo: string) => {
  const inicio = html.indexOf(`<section aria-label="${rotulo}"`);
  return inicio < 0 ? "" : html.slice(inicio, html.indexOf("</section></section>", inicio));
};
// [título, contagem] de cada bloco (Section do DS) de uma seção.
const blocos = (html: string) => [...html.matchAll(/<header[^>]*><span[^>]*>([^<]*)(?:<span[^>]*>(\d+)<\/span>)?<\/span><\/header>/g)].map((m) => [m[1], m[2] === undefined ? null : Number(m[2])]);
const filtro = (campos: Partial<Ui["filtro"]>) => ({ filtro: { ...UI_INICIAL.filtro, ...campos } });

const sessao = (campos: Partial<Sessao> & { id: string }): Sessao => ({
  mentorado_id: "m1",
  etapa: "Checkup 1",
  ordem: 3,
  status: "Concluída",
  mentor: "Luan",
  data: null,
  hora: null,
  link_meet: null,
  link_gravacao: null,
  link_anotacoes: null,
  google_event_id: null,
  etapa_deduzida: false,
  ...campos,
});
// O par dobrado, a concluída sem data e uma sem nada de errado (o cenário de "Alertas que focam linhas").
const ALERTAS = [
  sessao({ id: "x1", etapa: "Plano de Ação", ordem: 2, mentor: "Evaldo", data: "2026-07-16", hora: "14:00:00", google_event_id: "ev1" }),
  sessao({ id: "x2", etapa: "Checkup 5", ordem: 7, mentor: "Evaldo", data: "2026-07-16", hora: "14:00:00" }),
  sessao({ id: "x3", mentorado_id: "m2" }),
  sessao({ id: "x5", mentorado_id: "m3", mentor: "Sergio", data: "2026-07-22", hora: "09:00:00" }),
];

describe("tela Sessões (NAV-10, OPS-07, OPS-09, OPS-10, SEC-05)", () => {
  it("OPS-09 e OPS-07: as 1:1 nos blocos Aguardando, Agendadas, Concluídas (últimas 30) e Bloqueadas; os encontros por categoria; o topo conta a operação", () => {
    const { html } = tela("admin");
    expect(html).toContain("2 sessões 1:1 concluídas · 1 agendadas · 2 encontro(s) em grupo");
    expect(blocos(secao(html, "Sessões 1:1 com mentores"))).toEqual([
      ["Aguardando confirmação", 1],
      ["Agendadas", 1],
      ["Concluídas (últimas 30)", 2],
      ["Bloqueadas", 1],
    ]);
    const individuais = secao(html, "Sessões 1:1 com mentores");
    expect(individuais.slice(individuais.indexOf("Aguardando confirmação"), individuais.indexOf("Agendadas"))).toContain("Bruno Dias");
    const grupo = secao(html, "Sessões em grupo");
    expect(blocos(grupo)).toEqual([
      ["Plantão de Dúvida Semanal · 1 encontro(s)", null],
      ["Sessão de Implementação Mensal · 1 encontro(s)", null],
    ]);
    expect(grupo).toMatch(/<td[^>]*>3<\/td>/);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x");
  });

  it("SEC-05: link_meet, link_gravacao e link_anotacoes viram <a> só com http(s), com rel=\"noopener noreferrer\"; o resto aparece como texto", () => {
    const sessoes = [
      sessao({ id: "l1", data: "2026-09-01", link_meet: "https://meet.google.com/abc", link_gravacao: "javascript:alert(1)", link_anotacoes: "data:text/html,oi" }),
      sessao({ id: "l2", etapa: "Plantão de Dúvida Semanal", ordem: 90, data: "2026-09-02", hora: "19:00:00", link_gravacao: "https://exemplo.com/g" }),
    ];
    const { html } = tela("admin", { dados: { ...datasetDeTeste(), sessoes } });
    expect(html).toContain('<a href="https://meet.google.com/abc" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('<a href="https://exemplo.com/g" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('<span class="text-muted" title="javascript:alert(1)">gravação*</span>');
    expect(html).toContain('<span class="text-muted" title="data:text/html,oi">anotações*</span>');
    expect(html).not.toMatch(/href="(?:javascript|data):/);
  });

  it("as marcas por linha: contada, ignorada · mesma reunião, sem data, sem mentor e etapa deduzida, com a explicação no title", () => {
    const comPar = tela("admin", { dados: { ...datasetDeTeste(), sessoes: ALERTAS } }).html;
    expect(comPar).toContain(">contada</span>");
    expect(comPar).toContain(">ignorada · mesma reunião</span>");
    expect(comPar).toContain(">sem data</span>");
    const fixtures = tela("admin").html;
    expect(fixtures).toContain('<span title="Sem mentor na linha, a sessão não será creditada a ninguém"><span class="');
    expect(fixtures).toContain(">sem mentor</span>");
    expect(fixtures).toContain('<span title="O título do evento não dizia a etapa; o sync deduziu pela trilha. Abra a sessão e salve para confirmar ou corrigir.">');
    expect(fixtures).toContain(">etapa deduzida</span>");
  });

  it("NAV-10: sob foco, só as linhas do aviso, com o título, a dica e 'mostrar todas as sessões', que descarta o foco; Concluídas sem corte", () => {
    const foco = { ids: ["x1", "x2"], titulo: "Reuniões gravadas em duas etapas", dica: "Cada par abaixo é a mesma reunião." };
    const focado = tela("admin", { dados: { ...datasetDeTeste(), sessoes: ALERTAS }, ui: { foco } });
    expect(focado.html).toContain("Reuniões gravadas em duas etapas · 2 linha(s)");
    expect(focado.html).toContain("Cada par abaixo é a mesma reunião.");
    const individuais = secao(focado.html, "Sessões 1:1 com mentores");
    expect(blocos(individuais)).toEqual([
      ["Aguardando confirmação", 0],
      ["Agendadas", 0],
      ["Concluídas", 2],
      ["Bloqueadas", 0],
    ]);
    expect(individuais).toContain(">Plano de Ação");
    expect(individuais).toContain(">Checkup 5");
    expect(individuais).not.toContain("Diego");
    expect(focado.html).not.toContain('aria-label="Sessões em grupo"');
    chamar(prop(focado.vistos, "button", (p) => p.children === "mostrar todas as sessões", "onClick"));
    expect(focado.mudancas).toEqual([{ foco: null }]);

    const resolvido = tela("admin", { ui: { foco: { ...foco, ids: ["nada"] } } }).html;
    expect(resolvido).toContain(
      renderToStaticMarkup(<EmptyState title="Nada a conferir aqui — as linhas apontadas pelo alerta já foram resolvidas. Volte ao dashboard para recarregar a contagem." />),
    );
    expect(resolvido).not.toContain('aria-label="Sessões 1:1 com mentores"');
    expect(tela("admin").html).not.toContain("mostrar todas as sessões");
  });

  it("OPS-10: tipo, mentor e busca gravam o filtro; o tipo esconde a outra seção, e a busca mostra o selo sem mudar o topo", () => {
    const padrao = tela("admin");
    chamar(prop(padrao.vistos, "tipo", () => true, "onChange"), "Somente em grupo");
    chamar(prop(padrao.vistos, "select", (p) => p.id === "sessoes-mentor", "onChange"), "__sem__");
    chamar(prop(padrao.vistos, "busca", () => true, "onChange"), { target: { value: "bruno" } });
    expect(padrao.mudancas).toEqual([filtro({ tipoSessao: "grupo" }), filtro({ mentor: "__sem__" }), filtro({ qSessoes: "bruno" })]);
    expect(prop(padrao.vistos, "tipo", () => true, "items")).toEqual(["Todos os tipos", "Somente 1:1 com mentores", "Somente em grupo"]);

    const soGrupo = tela("admin", { ui: filtro({ tipoSessao: "grupo" }) }).html;
    expect(soGrupo).not.toContain('aria-label="Sessões 1:1 com mentores"');
    expect(soGrupo).toContain('aria-label="Sessões em grupo"');
    const so1a1 = tela("admin", { ui: filtro({ tipoSessao: "individual" }) }).html;
    expect(so1a1).toContain('aria-label="Sessões 1:1 com mentores"');
    expect(so1a1).not.toContain('aria-label="Sessões em grupo"');

    const busca = tela("admin", { ui: filtro({ qSessoes: "bruno" }) }).html;
    expect(busca).toContain("Busca: “bruno” · 4 de 7 sessão(ões) e encontro(s)");
    expect(busca).toContain("2 sessões 1:1 concluídas · 1 agendadas · 2 encontro(s) em grupo");
    expect(secao(busca, "Sessões 1:1 com mentores")).not.toContain("Ana Clara");
  });

  it("UI-06: as tabelas ordenam pela T37: Concluídas da mais recente, as outras da mais antiga; o cabeçalho grava a ordem do bloco", () => {
    const { html, vistos: lista, mudancas } = tela("admin");
    const concluidas = secao(html, "Sessões 1:1 com mentores").split("Concluídas (últimas 30)")[1] ?? "";
    expect(concluidas.indexOf("Ana Clara")).toBeLessThan(concluidas.indexOf("Carla"));
    const ordens = lista.filter((v) => v.tipo === "ordem" && v.props.label === "Data");
    expect(ordens).toHaveLength(6);
    // O terceiro bloco 1:1 é Concluídas.
    chamar(ordens[2].props.onToggle);
    expect(mudancas).toEqual([{ sortState: { sessoes_concluidas: { coluna: "data", direcao: "asc" } } }]);
    const crescente = secao(tela("admin", { ui: { sortState: { sessoes_concluidas: { coluna: "data", direcao: "asc" } } } }).html, "Sessões 1:1 com mentores").split(
      "Concluídas (últimas 30)",
    )[1];
    expect(crescente.indexOf("Carla")).toBeLessThan(crescente.indexOf("Ana Clara"));
  });

  it("OPS-07: o encontro abre pelo botão da primeira célula, no detalhe daquele encontro; fechar o descarta", () => {
    const fechada = tela("admin");
    expect(fechada.html).not.toContain("dialog-falso");
    chamar(prop(fechada.vistos, "button", (p) => p["aria-label"] === "Abrir o encontro Plantão de Dúvida Semanal de 06/08/2026", "onClick"));
    const aberta = tela("admin", { manter: true });
    expect(aberta.html).toContain('<dialog-falso data-titulo="Plantão de Dúvida Semanal">');
    expect(aberta.html).toContain("06/08/2026 · 19:00 · Sergio · 3 participante(s)");
    expect(aberta.html).toMatch(/<button[^>]*data-escrita="W01"[^>]*>Marcar 1 como concluída<\/button>/);
    chamar(prop(aberta.vistos, "dialog", (p) => p.open === true, "onClose"));
    expect(tela("admin", { manter: true }).html).not.toContain("dialog-falso");
  });

  it("WRITE-09: '+ Sessão em grupo' (data-escrita=\"W02\") e '+ Novo mentorado' só com as capacidades; bloco vazio mostra EmptyState", () => {
    const admin = tela("admin").html;
    expect(admin).toMatch(/<button[^>]*data-escrita="W02"[^>]*>\+ Sessão em grupo<\/button>/);
    expect(admin).toMatch(/<button[^>]*data-escrita="W14"[^>]*>\+ Novo mentorado<\/button>/);
    for (const papel of ["diretoria", "mentor"] as const) {
      const { html } = tela(papel);
      expect(html, papel).not.toContain("data-escrita=");
      expect(html, papel).toContain("Sessões 1:1 com mentores");
    }
    const vazio = tela("admin", { ui: filtro({ qSessoes: "ana" }) }).html;
    expect(vazio).toContain(renderToStaticMarkup(<EmptyState title="Nada por aqui." />));
    const semGrupo = (papel: Papel) => tela(papel, { dados: { ...datasetDeTeste(), sessoes: ALERTAS } }).html;
    expect(semGrupo("admin")).toContain(renderToStaticMarkup(<EmptyState title={'Nenhum encontro registrado — use "+ Sessão em grupo".'} />));
    expect(semGrupo("mentor")).toContain(renderToStaticMarkup(<EmptyState title="Nenhum encontro registrado." />));
  });
});
