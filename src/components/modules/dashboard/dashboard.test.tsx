import type { ComponentProps, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DadosContexto, UI_INICIAL, type Ui, UiContexto } from "@/components/shell/contexto";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import { LINK_PESQUISA_EXP } from "@/lib/constantes";
import type { Dataset, ErrosDeCarga, Sessao } from "@/lib/data/esquemas";
import { AVISOS } from "@/lib/matriz";
import type { Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { navegadorFalso, renderTela } from "@/test/render";

import Dashboard from "./dashboard";

// O render no servidor não guarda handler: os falsos de Button, Select e SearchInput anotam as
// props de cada um e desenham o de verdade. O teste chama o onClick/onChange anotado.
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

// A tela com o estado de tela do teste: cada `mudar` e cada navegação ficam anotados. `manter`
// re-renderiza com o estado do render anterior; sem ele, a tela começa do zero.
function tela(
  el: ReactElement,
  papel: Papel,
  { dados = datasetDeTeste(), ui = {}, erros = {}, manter = false }: { dados?: Dataset; ui?: Partial<Ui>; erros?: ErrosDeCarga; manter?: boolean } = {},
) {
  const mudancas: Array<Partial<Ui>> = [];
  const navegar = navegadorFalso("/dash");
  vistos.length = 0;
  estado.proximo = 0;
  if (!manter) estado.valores.length = 0;
  const html = renderTela(
    <DadosContexto.Provider value={{ dados, erros, recarregando: false, recarregar: () => Promise.resolve() }}>
      <UiContexto.Provider value={{ ui: { ...UI_INICIAL, ...ui }, mudar: (parcial) => mudancas.push(parcial) }}>{el}</UiContexto.Provider>
    </DadosContexto.Provider>,
    { papel, dados, navegar },
  );
  return { html, mudancas, chamadas: navegar.chamadas, vistos: [...vistos] };
}

// O handler anotado do único componente que casa.
function handler(lista: typeof vistos, tipo: string, casa: (props: Record<string, unknown>) => boolean, nome: string): (...args: unknown[]) => unknown {
  const achados = lista.filter((v) => v.tipo === tipo && casa(v.props));
  expect(achados, `${tipo} único`).toHaveLength(1);
  const fn = achados[0].props[nome];
  if (typeof fn !== "function") throw new Error(`${tipo} sem ${nome}`);
  return fn as (...args: unknown[]) => unknown;
}

const secao = (html: string, rotulo: string) => {
  const inicio = html.indexOf(`<section aria-label="${rotulo}"`);
  return inicio < 0 ? "" : html.slice(inicio, html.indexOf("</section>", inicio));
};
// [rótulo, contagem] de cada linha do painel de atenção.
const linhasDoPainel = (html: string) =>
  [...secao(html, "Precisa de atenção").matchAll(/<li[^>]*><span[^>]*>([^<]*)<\/span><span[^>]*><span[^>]*>(\d+)<\/span>/g)].map((m) => [m[1], Number(m[2])]);
const vazio = (titulo: string) => renderToStaticMarkup(<EmptyState title={titulo} />);

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

describe("Dashboard e Acompanhamento (OPS-01, OPS-04, OPS-10, NAV-10, GER-08, UI-07)", () => {
  it("OPS-01: o painel mostra os itens do papel com a contagem; o mentor não vê os de dinheiro; nomes do banco saem escapados", () => {
    const admin = tela(<Dashboard modo="completo" />, "admin").html;
    expect(secao(admin, "Precisa de atenção")).toContain("Precisa de atenção agora");
    expect(linhasDoPainel(admin)).toEqual([
      ["Contratos pendentes de assinatura", 1],
      ["Parcelas vencidas em aberto", 1],
      ["Mentorados criados pela Lia, sem cadastro completo", 1],
      ["Mentorados sem sessão há +30 dias", 2],
      ["Mentorados sem subir de marco há +30 dias", 2],
      ["Mentorados que ainda não fizeram a sessão de implementação", 3],
      ["Sessões aguardando confirmação", 1],
      ["Cobranças da Lia sem mentorado identificado", 2],
      ["Pesquisa de satisfação da sessão não respondida", 0],
      ["Pesquisa de Experiência não respondida (anônima: 0 resposta(s) de 0 mentorado(s) com sessão)", 0],
    ]);
    const mentor = tela(<Dashboard modo="completo" />, "mentor").html;
    expect(linhasDoPainel(mentor).map(([rotulo]) => rotulo)).toEqual([
      "Mentorados criados pela Lia, sem cadastro completo",
      "Mentorados sem sessão há +30 dias",
      "Mentorados sem subir de marco há +30 dias",
      "Mentorados que ainda não fizeram a sessão de implementação",
      "Sessões aguardando confirmação",
    ]);
    for (const html of [admin, mentor]) {
      expect(html).toContain("&lt;img");
      expect(html).not.toContain("<img src=x");
    }
  });

  it("OPS-01: o 'ver' leva à tela do item (Mentorados já filtrada nos criados pela Lia) ou à lista do próprio Dashboard; contagem 0 não tem 'ver'", () => {
    const admin = tela(<Dashboard modo="completo" />, "admin", { ui: { filtro: { ...UI_INICIAL.filtro, q: "ana" } } });
    handler(admin.vistos, "button", (p) => p["aria-label"] === "Ver: Parcelas vencidas em aberto", "onClick")();
    expect([admin.mudancas, admin.chamadas]).toEqual([[], [["ir", "/financeiro"]]]);
    handler(admin.vistos, "button", (p) => p["aria-label"] === "Ver: Mentorados criados pela Lia, sem cadastro completo", "onClick")();
    expect(admin.mudancas).toEqual([{ filtro: { ...UI_INICIAL.filtro, q: "ana", statusFin: "incompletos" } }]);
    expect(admin.chamadas.at(-1)).toEqual(["ir", "/mentorados"]);
    expect(admin.html).toContain('<a href="#risco" aria-label="Ver: Mentorados sem sessão há +30 dias"');
    expect(admin.html).toContain('id="risco"');
    expect(admin.html).not.toContain('aria-label="Ver: Pesquisa de satisfação da sessão não respondida"');
  });

  it("Acompanhamento: o painel e as listas, sem números gerais, progressão e detalhe; o Dashboard tem tudo", () => {
    const acompanhamento = tela(<Dashboard modo="acompanhamento" />, "admin").html;
    expect(acompanhamento).toContain(">Acompanhamento</h1>");
    expect(acompanhamento).toContain("Precisa de atenção agora");
    expect(acompanhamento).toContain('id="risco"');
    for (const bloco of ["Números gerais", "Progressão por faturamento", "Detalhe analítico", "Sessões concluídas por mentor", "Próximas sessões agendadas"]) {
      expect(acompanhamento, bloco).not.toContain(bloco);
    }
    const dashboard = tela(<Dashboard modo="completo" />, "admin").html;
    expect(dashboard).toContain(">Dashboard</h1>");
    for (const bloco of ["Números gerais", "Progressão por faturamento", "Detalhe analítico", "Sessões concluídas por mentor", "Próximas sessões agendadas"]) {
      expect(dashboard, bloco).toContain(bloco);
    }
  });

  it("OPS-10: a busca recorta as listas sem mudar o painel, os números e o subtítulo; a caixa grava qDash", () => {
    const sem = tela(<Dashboard modo="completo" />, "admin");
    const com = tela(<Dashboard modo="completo" />, "admin", { ui: { filtro: { ...UI_INICIAL.filtro, qDash: "bruno" } } }).html;
    expect(secao(com, "Precisa de atenção")).toBe(secao(sem.html, "Precisa de atenção"));
    expect(secao(com, "Números gerais")).toBe(secao(sem.html, "Números gerais"));
    for (const html of [sem.html, com]) expect(html).toContain("Visão geral da operação · 3 mentorados ativos");
    expect(com).toContain("Busca: “bruno” · 1 de 3 mentorado(s) ativo(s) · os totais continuam da operação inteira");
    const risco = (html: string) => html.slice(html.indexOf('id="risco"'), html.indexOf('id="sem-implementacao"'));
    expect(risco(sem.html)).toContain("Diego");
    expect(risco(com)).not.toContain("Diego");
    expect(risco(com)).toContain('<a class="font-medium text-ink hover:text-primary hover:underline" href="/mentorado/m2/sessoes">Bruno Dias</a>');
    expect(secao(sem.html, "Detalhe analítico")).toContain("Ana Clara");
    expect(secao(com, "Detalhe analítico")).not.toContain("Ana Clara");
    handler(sem.vistos, "busca", () => true, "onChange")({ target: { value: "bruno" } });
    expect(sem.mudancas).toEqual([{ filtro: { ...UI_INICIAL.filtro, qDash: "bruno" } }]);
  });

  it("OPS-04: sem escolha a matriz abre no mês mais recente com reunião; o seletor grava o mês escolhido e a matriz segue o mês", () => {
    const padrao = tela(<Dashboard modo="completo" />, "admin");
    const seletor = padrao.vistos.find((v) => v.tipo === "select" && v.props.id === "mes-matriz")?.props;
    expect(seletor?.value).toBe("2026-08");
    expect(seletor?.options).toEqual(
      expect.arrayContaining([
        { value: "", label: "Todos os meses" },
        { value: "2026-08", label: "Agosto 2026" },
        { value: "2026-02", label: "Fevereiro 2026" },
        { value: "2025-12", label: "Dezembro 2025" },
      ]),
    );
    expect(secao(padrao.html, "Detalhe analítico")).toContain(">Agosto 2026</span>");
    handler(padrao.vistos, "select", (p) => p.id === "mes-matriz", "onChange")("2026-02");
    expect(padrao.mudancas).toEqual([{ mesMatriz: "2026-02" }]);

    const fevereiro = secao(tela(<Dashboard modo="completo" />, "admin", { ui: { mesMatriz: "2026-02" } }).html, "Detalhe analítico");
    expect(fevereiro).toContain("Evaldo");
    expect(fevereiro).toContain("fora do projeto");
    expect(fevereiro).not.toContain(">Grupo</span>");
    const agosto = secao(padrao.html, "Detalhe analítico");
    expect(agosto).toContain("Sergio");
    expect(agosto).toContain(">Grupo</span>");
  });

  it("NAV-10: cada um dos 4 avisos da matriz grava o foco daquele aviso, zera tipo e mentor e leva a /sessoes", () => {
    const sessoes = [
      sessao({ id: "x1", etapa: "Plano de Ação", ordem: 2, mentor: "Evaldo", data: "2026-07-16", hora: "14:00:00", google_event_id: "ev1" }),
      sessao({ id: "x2", etapa: "Checkup 5", ordem: 7, mentor: "Evaldo", data: "2026-07-16", hora: "14:00:00" }),
      sessao({ id: "x3", mentorado_id: "m2" }),
      sessao({ id: "x4", mentorado_id: "m2", etapa: "Checkup 2", ordem: 4, status: "Aguardando confirmação", mentor: null, data: "2026-07-20" }),
      sessao({ id: "x5", mentorado_id: "m3", mentor: "Sergio", data: "2026-07-22", hora: "09:00:00" }),
      sessao({ id: "x6", mentorado_id: "m3", etapa: "Checkup 2", ordem: 4, status: "Agendada", data: "2099-01-01", etapa_deduzida: true }),
    ];
    const filtro = { ...UI_INICIAL.filtro, tipoSessao: "grupo", mentor: "Sergio", qSessoes: "ana" };
    const dash = tela(<Dashboard modo="completo" />, "admin", { dados: { ...datasetDeTeste(), sessoes }, ui: { mesMatriz: "2026-07", filtro } });
    const detalhe = secao(dash.html, "Detalhe analítico");
    expect(detalhe).toContain("1 reunião(ões) gravada(s) em duas etapas — contei uma vez cada");
    expect(detalhe).toContain("1 sessão(ões) concluída(s) sem data — fora de qualquer mês");
    expect(detalhe).toContain("1 sessão(ões) aguardando confirmação sem mentor definido");
    expect(detalhe).toContain("1 sessão(ões) com etapa escolhida pelo sync, sem confirmação");
    const ids = { dobradas: ["x1", "x2"], semData: ["x3"], semMentor: ["x4"], etapaDeduzida: ["x6"] } as const;
    for (const chave of ["dobradas", "semData", "semMentor", "etapaDeduzida"] as const) {
      handler(dash.vistos, "button", (p) => p["data-aviso"] === chave, "onClick")();
      expect(dash.mudancas.at(-1), chave).toEqual({ foco: { ids: ids[chave], ...AVISOS[chave] }, filtro: { ...filtro, tipoSessao: "", mentor: "" } });
      expect(dash.chamadas.at(-1), chave).toEqual(["ir", "/sessoes"]);
    }
    expect(dash.chamadas).toHaveLength(4);
  });

  it("GER-08: o mentor vê o aviso de adesão com os números e o link da pesquisa; o admin não", () => {
    const dados = { ...datasetDeTeste(), adesao: { respostas: 2, mentorados_com_sessao: 10 } };
    const mentor = tela(<Dashboard modo="completo" />, "mentor", { dados }).html;
    expect(mentor).toContain("Poucas respostas na Pesquisa de Experiência");
    expect(mentor).toContain("Desde 13/10/2026, 2 resposta(s) para 10 mentorado(s) com sessão (20%, a meta é 70%).");
    expect(mentor).toContain(`<a href="${LINK_PESQUISA_EXP}" target="_blank" rel="noopener noreferrer"`);
    expect(tela(<Dashboard modo="acompanhamento" />, "mentor", { dados }).html).toContain("Poucas respostas na Pesquisa de Experiência");
    expect(tela(<Dashboard modo="completo" />, "admin", { dados }).html).not.toContain("Poucas respostas");
  });

  it("UI-07: lista vazia mostra EmptyState: a busca que não casa ninguém, a matriz e as próximas sem sessão", () => {
    const busca = tela(<Dashboard modo="completo" />, "admin", { ui: { filtro: { ...UI_INICIAL.filtro, qDash: "zzz" } } }).html;
    expect(busca).toContain(vazio("Nenhum dos 2 mentorados sem sessão casa com a busca."));
    expect(busca).toContain(vazio("Nenhuma sessão agendada para essa busca."));
    const semSessoes = tela(<Dashboard modo="completo" />, "admin", { dados: { ...datasetDeTeste(), sessoes: [] } }).html;
    expect(semSessoes).toContain(vazio("Nenhuma sessão concluída registrada."));
    expect(semSessoes).toContain(vazio("Nenhuma sessão agendada. Agende pela ficha do mentorado."));
  });

  it("WRITE-09: '+ Novo mentorado' no Dashboard e no Acompanhamento só com criarMentorado, com data-escrita=\"W14\"", () => {
    for (const modo of ["completo", "acompanhamento"] as const) {
      expect(tela(<Dashboard modo={modo} />, "admin").html, modo).toMatch(/<button[^>]*data-escrita="W14"[^>]*>\+ Novo mentorado<\/button>/);
      for (const papel of ["diretoria", "mentor"] as const) expect(tela(<Dashboard modo={modo} />, papel).html, `${modo} ${papel}`).not.toContain('data-escrita="W14"');
    }
  });

  it("o encontro em grupo das próximas abre pelo botão da primeira célula, no detalhe daquele encontro; fechar o descarta", () => {
    const fechada = tela(<Dashboard modo="completo" />, "admin");
    expect(fechada.html).not.toContain("dialog-falso");
    handler(fechada.vistos, "button", (p) => p["aria-label"] === "Abrir o encontro Sessão de Implementação Mensal de 15/10/2099", "onClick")();
    const aberta = tela(<Dashboard modo="completo" />, "admin", { manter: true });
    expect(aberta.html).toContain('<dialog-falso data-titulo="Sessão de Implementação Mensal">');
    expect(aberta.html).toContain("15/10/2099 · 20:00 · Michelle · 2 participante(s)");
    handler(aberta.vistos, "dialog", (p) => p.open === true, "onClose")();
    expect(tela(<Dashboard modo="completo" />, "admin", { manter: true }).html).not.toContain("dialog-falso");
  });

  it("Contatar abre a conversa no wa.me com o número do Canal WhatsApp, em aba nova; sem número, fica o selo", () => {
    // Uma 1:1 concluída antiga tira os dois de "Nunca começou". "link whats" é o texto que a produção guarda no lugar do número.
    const dados = datasetDeTeste();
    Object.assign(dados.mentorados[1], { link_whatsapp: "link whats" });
    Object.assign(dados.mentorados[2], { link_whatsapp: "(11) 99999-8888" });
    dados.sessoes.push(sessao({ id: "s6", mentorado_id: "m2", data: "2026-05-04" }), sessao({ id: "s7", mentorado_id: "m3", data: "2026-05-04" }));
    const html = tela(<Dashboard modo="completo" />, "admin", { dados }).html;
    const risco = html.slice(html.indexOf('id="risco"'), html.indexOf('id="sem-implementacao"'));
    expect(risco).toMatch(/<a href="https:\/\/wa\.me\/5511999998888" target="_blank" rel="noopener noreferrer"[^>]*>.*?Contatar<span class="sr-only"> no WhatsApp<\/span><\/a>/);
    expect(risco).toContain(renderToStaticMarkup(<Badge variant="warning">Contatar</Badge>));
    expect(risco).not.toContain("link whats");
  });

  it("DATA-07: relação complementar que falhou vira aviso no topo, e o resto do Dashboard renderiza", () => {
    const html = tela(<Dashboard modo="completo" />, "admin", { erros: { sessoes_orfas: "permission denied" } }).html;
    expect(html).toContain("Parte dos dados não carregou");
    expect(html).toContain("sessoes_orfas: permission denied");
    expect(html).toContain("Precisa de atenção agora");
  });
});
