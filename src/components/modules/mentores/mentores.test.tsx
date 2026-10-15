import type { ComponentProps, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, UI_INICIAL, type Ui, UiContexto } from "@/components/shell/contexto";
import type { Dataset, Relacao, Sessao } from "@/lib/data/esquemas";
import type { Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Mentores from "./mentores";

const vistos = vi.hoisted(() => [] as Array<{ tipo: string; props: Record<string, unknown> }>);
const gravar = vi.hoisted(() => (tipo: string, props: object) => vistos.push({ tipo, props: { ...props } as Record<string, unknown> }));
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("button", props), createElement(original.default, props)) };
});

let ui: Ui;
const mudancas: Array<Partial<Ui>> = [];
const filtro = (parcial: Partial<Ui["filtro"]>): Partial<Ui> => ({ filtro: { ...UI_INICIAL.filtro, ...parcial } });

function render(el: ReactElement, { papel = "admin", dados = dadosDeMentores(), erros = {}, estado }: { papel?: Papel; dados?: Dataset; erros?: Partial<Record<Relacao, string>>; estado?: Partial<Ui> } = {}) {
  vistos.length = 0;
  ui = { ...UI_INICIAL, ...estado };
  const mudar = (parcial: Partial<Ui>) => {
    mudancas.push(parcial);
    ui = { ...ui, ...parcial };
  };
  const html = renderTela(
    <DadosContexto.Provider value={{ dados, erros, recarregando: false, recarregar: () => Promise.resolve() }}>
      <UiContexto.Provider value={{ ui, mudar }}>{el}</UiContexto.Provider>
    </DadosContexto.Provider>,
    { papel, dados },
  );
  return { html, vistos: [...vistos] };
}
const tela = (opcoes: Parameters<typeof render>[1] = {}) => render(<Mentores />, opcoes);
const botao = (v: ReturnType<typeof tela>["vistos"], rotulo: string) => {
  const achado = v.find((x) => x.tipo === "button" && x.props.children === rotulo);
  if (!achado) throw new Error(`botão ${rotulo} ausente`);
  return achado.props;
};
const chamar = (fn: unknown, ...args: unknown[]) => {
  if (typeof fn !== "function") throw new Error("handler ausente");
  return fn(...args);
};
const texto = (html: string) => html.replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, " ").replace(/\s+/g, " ");
const ESCAPADO = "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;";

// Hoje é 15/10/2026, então o corte dos 30 dias é 15/09. O fixture traz o Evaldo (1:1 em fevereiro
// e uma agendada), o Israel (só dezembro de 2025), o Sergio (grupo em agosto), a Michelle (grupo
// agendado) e o NPS do Diovani; aqui entram as sessões e as calls do Diovani.
const sessao = (id: string, mentorado: string, status: string, data: string, extra: Partial<Sessao> = {}): Sessao => ({
  ...datasetDeTeste().sessoes[0],
  id,
  mentorado_id: mentorado,
  mentor: "Diovani",
  etapa: "Plano de Ação",
  status,
  data,
  hora: "10:00:00",
  ...extra,
});
function dadosDeMentores(): Dataset {
  const d = datasetDeTeste();
  const grupo = { etapa: "Plantão de Dúvida Semanal", hora: "19:00:00" };
  return {
    ...d,
    sessoes: [
      ...d.sessoes,
      sessao("d1", "m1", "Concluída", "2026-09-20"),
      sessao("d2", "m2", "Concluída", "2026-10-01"),
      sessao("d3", "m1", "Concluída", "2026-07-01"),
      sessao("d7", "m3", "Concluída", "2026-06-01"),
      sessao("d4", "m1", "Agendada", "2026-10-20", { hora: "14:00:00", etapa: "Checkup 1" }),
      sessao("d5", "m2", "Concluída", "2026-10-06", grupo),
      sessao("d6", "m1", "Concluída", "2026-10-06", grupo),
    ],
    transcricoes: [
      { drive_id: "t1", mentor: "Diovani", status: "aceita", realizada_em: "2026-10-01T12:00:00Z", mentorado_id: "m1" },
      { drive_id: "t2", mentor: "Diovani", status: "aceita", realizada_em: "2026-10-02T12:00:00Z", mentorado_id: "m2" },
      { drive_id: "t3", mentor: "Diovani", status: "rejeitada", realizada_em: "2026-10-03T12:00:00Z", mentorado_id: null },
      { drive_id: "t4", mentor: "Luan", status: "aceita", realizada_em: "2026-10-03T12:00:00Z", mentorado_id: null },
    ],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T15:00:00Z"));
  mudancas.length = 0;
});
afterEach(() => vi.useRealTimers());

describe("tela Mentores, visão geral (GER-07)", () => {
  it("os cards somam todos os mentores: 1:1 e grupo em 30 dias e no total, agendadas e o NPS de 30 dias de todas as respostas", () => {
    const t = texto(tela().html);
    // 1:1 por reunião: Evaldo (fev.), Israel (dez.) e do Diovani d1, d2, d3, d7: seis, duas em 30 dias.
    expect(t).toContain("Sessões 1:1 · 30 dias 2 6 no total");
    // Grupo: Sergio (ago.) e Diovani (06/10): dois encontros, um em 30 dias.
    expect(t).toContain("Encontros em grupo · 30 dias 1 2 no total");
    // Agendadas: Evaldo 1, Michelle 2 presenças e Diovani 1.
    expect(t).toContain("Agendadas 4 de hoje em diante");
    // Respostas dos últimos 30 dias: n2 (8) e n3 (5): média 6,5 e NPS -50.
    expect(t).toContain("NPS · 30 dias 6,5 NPS -50");
  });

  it("a tabela traz a carteira, 1:1 e grupo (30d / total), agendadas, média e NPS do mentor, calls e a última atividade", () => {
    const t = texto(tela().html);
    expect(t).toContain("Mentores · 8");
    // Diovani: carteira m3, m1 e m2; 1:1 2 / 4; grupo 1 / 1; 1 agendada; 3 respostas, média 9,0, NPS +67; 2 calls; última 06/10.
    expect(t).toContain("Diovani 3 2 / 4 1 / 1 1 9,0 (3) +67 2 06/10/2026");
    // Sem nada: carteira 0, zeros, traço no NPS e nas calls e na data.
    expect(t).toContain("Gabriella 0 0 / 0 0 / 0 0 — — — —");
  });

  it("o mentor fora da lista atual e sem 1:1 em 30 dias nem agenda vai para o Histórico; o com agenda fica na lista", () => {
    const { html } = tela();
    const t = texto(html);
    expect(t).toContain("Histórico · 1");
    expect(t).toContain("Fora da lista atual e sem sessão nos últimos 30 dias nem agenda.");
    const [lista, historico] = t.split("Histórico · 1");
    // O Israel só teve 1:1 em dezembro e não está na lista atual: fica só no Histórico, com a etiqueta.
    expect(historico).toContain("Israel histórico 0 0 / 1 0 / 0 0");
    expect(lista.slice(lista.indexOf("Mentores · 8"))).not.toContain("Israel");
    // O Evaldo não é da lista atual, mas tem uma agendada: está em "Mentores", com a etiqueta.
    expect(lista.slice(lista.indexOf("Mentores · 8"))).toContain("Evaldo histórico");
    expect(t).toMatch(/Evaldo histórico 0 0 \/ 1 0 \/ 0 1/);
  });

  it("o botão do mentor e o da tabela gravam a escolha em filtro.mentorSel, sem mexer no resto", () => {
    const { vistos: v } = tela({ estado: filtro({ qDash: "x" }) });
    chamar(botao(v, "Diovani").onClick);
    expect(mudancas.at(-1)).toEqual(filtro({ qDash: "x", mentorSel: "Diovani" }));
    chamar(botao(v, "Evaldo").onClick);
    expect(mudancas.at(-1)).toEqual(filtro({ qDash: "x", mentorSel: "Evaldo" }));
    const aberto = tela({ estado: filtro({ mentorSel: "Diovani" }) });
    chamar(botao(aberto.vistos, "Visão geral").onClick);
    expect(mudancas.at(-1)).toEqual(filtro({ mentorSel: "" }));
  });

  it("o recorte aparece como botão apertado, e um mentor que não existe mais cai na visão geral", () => {
    const geral = tela();
    expect(botao(geral.vistos, "Visão geral")["aria-pressed"]).toBe(true);
    expect(botao(geral.vistos, "Diovani")["aria-pressed"]).toBe(false);
    const aberto = tela({ estado: filtro({ mentorSel: "Diovani" }) });
    expect(botao(aberto.vistos, "Diovani")["aria-pressed"]).toBe(true);
    expect(texto(tela({ estado: filtro({ mentorSel: "Fantasma" }) }).html)).toContain("Mentores · 8");
  });
});

describe("tela Mentores, um mentor (GER-07, GER-06)", () => {
  const diovani = () => tela({ estado: filtro({ mentorSel: "Diovani" }) });

  it("os cards: carteira, 1:1 e grupo, média e NPS com o de 30 dias, e as calls aceitas", () => {
    const t = texto(diovani().html);
    expect(t).toContain("Carteira ativa 3 mentorados");
    expect(t).toContain("1:1 · 30 dias 2 4 no total");
    expect(t).toContain("Grupo · 30 dias 1 1 no total");
    // 10, 8 e 9: média 9,0 e NPS +67; só a de 16/09 está em 30 dias: 8,0.
    expect(t).toContain("Média NPS 9,0 NPS +67 · 3 resposta(s) · 30d 8,0");
    expect(t).toContain("Calls transcritas 2 aceitas no dossiê");
  });

  it("a carteira vai do mais tempo sem sessão ao menos, com a etapa e a última nota que o mentorado deu a este mentor", () => {
    const { html } = diovani();
    const t = texto(html.slice(html.indexOf("Carteira ·")));
    expect(t).toContain("Carteira · 3");
    expect(t).toContain("Mais tempo sem sessão primeiro.");
    expect(t.indexOf("Diego")).toBeLessThan(t.indexOf("Ana Clara"));
    expect(t.indexOf("Ana Clara")).toBeLessThan(t.indexOf("Bruno Dias"));
    expect(t).toContain("Ana Clara 20/09/2026 Plano de Ação 10");
    expect(t).toContain("Bruno Dias 01/10/2026 Plano de Ação —");
    expect(html).toContain('href="/mentorado/m1"');
    // O Evaldo era o mentor da Ana, mas a última concluída dela é do Diovani: fora da carteira dele.
    expect(texto(tela({ estado: filtro({ mentorSel: "Evaldo" }) }).html)).toContain("Carteira · 0");
  });

  it("a atividade dos 6 últimos meses, do mês corrente para trás, com 1:1, grupo, respostas e média", () => {
    const { html } = diovani();
    const t = texto(html.slice(html.indexOf("Atividade por mês")));
    expect(t).toContain("outubro de 2026 1 1 0 —");
    expect(t).toContain("setembro de 2026 1 0 2 9,0");
    expect(t).toContain("agosto de 2026 0 0 1 9,0");
    expect(t).toContain("julho de 2026 1 0 0 —");
    expect(t).toContain("maio de 2026");
    expect(t).not.toContain("abril de 2026");
  });

  it("a agenda lista só as agendadas de hoje em diante, e as últimas respostas vêm da mais nova à mais antiga", () => {
    const { html } = diovani();
    const agenda = texto(html.slice(html.indexOf("Agenda ·")));
    expect(agenda).toContain("Agenda · 1");
    expect(agenda).toContain("20/10/2026 14:00:00 Ana Clara Checkup 1");
    const respostas = html.slice(html.indexOf("Últimas respostas de NPS"));
    expect(respostas.indexOf("16/09/2026")).toBeLessThan(respostas.indexOf("13/09/2026"));
    expect(respostas.indexOf("13/09/2026")).toBeLessThan(respostas.indexOf("20/08/2026"));
    expect(texto(respostas)).toContain("13/09/2026, 22:00 · 10 Ana Clara");
  });

  it("a leitura da IA vem no formato antigo, com o texto do modelo e o do banco escapados", () => {
    const { html } = diovani();
    const t = texto(html);
    expect(t).toContain("Leitura da Análise IA");
    expect(t).toContain("Prós 1 Prático");
    expect(t).toContain("Contras 1");
    expect(html).toContain(`Leitura ${ESCAPADO}`);
    expect(html).toContain(`Atrasa ${ESCAPADO}`);
    expect(html).toContain(`Diego ${ESCAPADO}`);
    expect(html).toContain(`Ótima ${ESCAPADO}`);
    expect(html).not.toContain("<img src=x");
  });

  it("um mentor sem nada mostra as quatro mensagens vazias", () => {
    const t = texto(tela({ estado: filtro({ mentorSel: "Gabriella" }) }).html);
    for (const msg of ["Sem leitura da Análise IA para este mentor na última rodada.", "Nenhum mentorado ativo com a última sessão 1:1 com este mentor.", "Nada agendado.", "Sem respostas."]) {
      expect(t, msg).toContain(msg);
    }
    expect(t).toContain("Carteira ativa 0 mentorados");
  });
});

describe("tela Mentores, falhas e papéis (GER-07, DATA-07)", () => {
  it("a falha de R17, R19 ou R22 vira um Alert com a relação e o resto renderiza", () => {
    for (const relacao of ["nps_respostas", "nps_analises", "transcricoes"] as const) {
      const { html } = tela({ erros: { [relacao]: "permission denied" } });
      const t = texto(html);
      expect(t, relacao).toContain(`Parte dos dados não carregou ${relacao}: permission denied`);
      expect(html, relacao).toContain('role="status"');
      expect(t, relacao).toContain("Mentores · 8");
      expect(t, relacao).toContain("Sessões 1:1 · 30 dias 2 6 no total");
      expect(t, relacao).not.toContain("Não foi possível carregar esta tela");
    }
  });

  it("as três falhas juntas viram três linhas no mesmo aviso, e no mentor aberto a tela também renderiza", () => {
    const erros = { nps_respostas: "a", nps_analises: "b", transcricoes: "c" } as const;
    const t = texto(tela({ erros }).html);
    for (const linha of ["nps_respostas: a", "nps_analises: b", "transcricoes: c"]) expect(t, linha).toContain(linha);
    expect(t.match(/Parte dos dados não carregou/g)).toHaveLength(1);
    const aberto = texto(tela({ erros, estado: filtro({ mentorSel: "Diovani" }) }).html);
    expect(aberto).toContain("Parte dos dados não carregou");
    expect(aberto).toContain("Carteira ativa 3 mentorados");
  });

  it("a falha de outra relação não vira aviso desta tela", () => {
    expect(tela({ erros: { stlseller_mentorados: "x", experiencia_respostas: "y" } }).html).not.toContain("não carregou");
  });

  it("a diretoria lê o mesmo que o admin, e a tela não escreve nada", () => {
    const admin = tela({ papel: "admin" }).html;
    expect(texto(tela({ papel: "diretoria" }).html)).toBe(texto(admin));
    expect(admin).not.toContain("data-escrita");
  });
});
