import type { ComponentProps, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, type Navegador, SessaoContexto, UI_INICIAL, type Ui, UiContexto, type ValorSessao } from "@/components/shell/contexto";
import type { Dataset, Relacao } from "@/lib/data/esquemas";
import type { EvolucaoRica, EvolucaoSimples, ResultadoEscrita } from "@/lib/data/escritas";
import type { Capacidade, Papel } from "@/lib/papeis";
import { datasetDeTeste, XSS } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Rotas from "./rotas";

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

const toastErro = vi.hoisted(() => vi.fn());
const toastSucesso = vi.hoisted(() => vi.fn());
vi.mock("react-hot-toast", () => ({ default: { error: toastErro, success: toastSucesso } }));
const sessaoDoCliente = vi.hoisted(() => ({ id: "usuario-admin" }));
vi.mock("@/lib/data/auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/data/auth")>()), usuarioDaSessao: () => Promise.resolve(sessaoDoCliente.id) }));
const ordem = vi.hoisted(() => [] as string[]);
const gravarCanal = vi.hoisted(() => vi.fn<(mentoradoId: string, rotaId: string, canalId: string) => Promise<ResultadoEscrita>>());
const gravarFaturamento = vi.hoisted(() => vi.fn<(mentoradoId: string, mes: string, canalId: string, valor: number | null) => Promise<ResultadoEscrita>>());
const apagarFaturamento = vi.hoisted(() => vi.fn<(id: string) => Promise<ResultadoEscrita>>());
const gravarMarco = vi.hoisted(() => vi.fn<(mentoradoId: string, marcoId: string, evolucao: EvolucaoSimples | EvolucaoRica) => Promise<ResultadoEscrita>>());
vi.mock("@/lib/data/escritas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/escritas")>()),
  salvarCanalMentorado: gravarCanal,
  salvarFaturamento: gravarFaturamento,
  excluirFaturamento: apagarFaturamento,
  salvarMarco: gravarMarco,
}));

// Os primitivos anotam as props e desenham o de verdade; o Dialog, que devolve null sem
// `document`, desenha o conteúdo e o rodapé num elemento falso quando aberto.
const vistos = vi.hoisted(() => [] as Array<{ tipo: string; props: Record<string, unknown> }>);
const gravar = vi.hoisted(() => (tipo: string, props: object) => vistos.push({ tipo, props: { ...props } as Record<string, unknown> }));
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("button", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/input", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/input")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("input", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/textarea", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/textarea")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("textarea", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/select", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/select")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("select", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/checkbox", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/checkbox")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("checkbox", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/collapsible-section", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/collapsible-section")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("secao", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/trend-chart", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/trend-chart")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("barras", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/line-chart", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/line-chart")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("linhas", props), createElement(original.default, props)) };
});
vi.mock("./escolher-mentorado", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("./escolher-mentorado")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("escolha", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/dialog", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: { open: boolean; onClose(): void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) => {
      gravar("dialog", props);
      return props.open ? createElement("dialog-falso", { "data-titulo": props.title }, props.children, props.footer) : null;
    },
  };
});

function sessaoCom(caps: Set<Capacidade>, papel: Papel): ValorSessao {
  const usuario = { id: `usuario-${papel}`, email: `${papel}@exemplo.com` };
  return { usuario, perfil: { id: usuario.id, role: papel, nome: papel, email: usuario.email }, papel, pode: (cap) => caps.has(cap), sair: () => Promise.resolve() };
}

// O estado de tela é um objeto que `mudar` altera, como o UiProvider: o render seguinte o lê.
let ui: Ui;
const mudancas: Array<Partial<Ui>> = [];

function render(el: ReactElement, { papel = "admin", caps, dados = datasetDeTeste(), erros = {} }: { papel?: Papel; caps?: Set<Capacidade>; dados?: Dataset; erros?: Partial<Record<Relacao, string>> } = {}) {
  estado.proximo = 0;
  vistos.length = 0;
  sessaoDoCliente.id = `usuario-${papel}`;
  const navegar: Navegador = { caminho: "/rotas", ir: (destino) => ordem.push(`ir ${destino}`), substituir: (destino) => ordem.push(`substituir ${destino}`) };
  const mudar = (parcial: Partial<Ui>) => {
    mudancas.push(parcial);
    ui = { ...ui, ...parcial };
  };
  const conteudo = (
    <DadosContexto.Provider value={{ dados, erros, recarregando: false, recarregar: async () => void ordem.push("recarregar") }}>
      <UiContexto.Provider value={{ ui, mudar }}>{el}</UiContexto.Provider>
    </DadosContexto.Provider>
  );
  const html = renderTela(caps ? <SessaoContexto.Provider value={sessaoCom(caps, papel)}>{conteudo}</SessaoContexto.Provider> : conteudo, { papel, dados, navegar });
  return { html, vistos: [...vistos] };
}
const tela = (opcoes: Parameters<typeof render>[1] = {}) => render(<Rotas />, opcoes);

type Lista = ReturnType<typeof tela>["vistos"];
function prop(lista: Lista, tipo: string, casa: (p: Record<string, unknown>) => boolean, nome: string): unknown {
  const achados = lista.filter((v) => v.tipo === tipo && casa(v.props));
  expect(achados, `${tipo} único`).toHaveLength(1);
  return achados[0].props[nome];
}
const chamar = (fn: unknown, ...args: unknown[]) => {
  if (typeof fn !== "function") throw new Error("handler ausente");
  return fn(...args);
};
const rotulo = (p: Record<string, unknown>) => (Array.isArray(p.children) ? p.children.filter((c) => typeof c === "string").join("") : p.children);
const botoes = (lista: Lista, escrita: string) => lista.filter((v) => v.tipo === "button" && v.props["data-escrita"] === escrita);
const botao = (lista: Lista, escrita: string) => prop(lista, "button", (p) => p["data-escrita"] === escrita, "onClick");
const escritas = (lista: Lista) => lista.filter((v) => v.tipo === "button" && v.props["data-escrita"]).map((v) => v.props["data-escrita"]);
const digitar = (lista: Lista, id: string, valor: string, tipo = "input") => chamar(prop(lista, tipo, (p) => p.id === id, "onChange"), { target: { value: valor } });
const escolher = (lista: Lista, id: string, valor: string) => chamar(prop(lista, "select", (p) => p.id === id, "onChange"), valor);
const marcar = (lista: Lista, criterio: string) => chamar(prop(lista, "checkbox", (p) => p.label === criterio, "onChange"));
const secao = (lista: Lista, id: string, nome: string) => prop(lista, "secao", (p) => p.id === id, nome);
const tique = () => new Promise((resolve) => setTimeout(resolve, 0));

// Quantos marcos estão abertos, pelo que o stepper pediu ao CollapsibleSection.
const marcosEmTela = (lista: Lista) => lista.filter((v) => v.tipo === "secao" && v.props.id !== "canais" && v.props.open === true).length;
// Depois de mudar o estado de tela a árvore muda, e o estado guardado por posição não vale mais.
const fresca = (opcoes: Parameters<typeof render>[1] = {}) => {
  estado.valores.length = 0;
  return tela(opcoes);
};

describe("tela Rotas (OPS-16, OPS-17, OPS-19, WRITE-03, UI-05, DATA-07)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T15:00:00Z"));
    estado.valores.length = 0;
    ordem.length = 0;
    mudancas.length = 0;
    ui = { ...UI_INICIAL };
    for (const fn of [gravarCanal, gravarFaturamento, apagarFaturamento, gravarMarco]) fn.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  it("a trilha fechada: um botão por marco, a placa na linha, o contador de critérios e nenhum painel", () => {
    const { html, vistos: lista } = tela();
    expect(lista.filter((v) => v.tipo === "secao").map((v) => v.props.title)).toEqual(["Marco 01 — R$ 500 acumulados", "Marco 04 — R$ 20.000 acumulados"]);
    expect(lista.filter((v) => v.tipo === "secao").map((v) => v.props.open)).toEqual([false, false]);
    expect(html).toContain("PLACA");
    // m1 tem 2 de 4 critérios do marco 1, em andamento, com a data e o objetivo na linha.
    expect(secao(lista, "mk1", "hint")).toBe("Em andamento · 01/05/2026 · A feira paga o dia · 2/4");
    expect(secao(lista, "mk2", "hint")).toBe("Não iniciado · 0/1");
    expect(html).not.toContain("Teste de passagem");
    // O marco de placa leva o selo; o outro, não.
    expect(secao(lista, "mk1", "icon")).toBeUndefined();
    expect(secao(lista, "mk2", "icon")).toBeDefined();
  });

  it("OPS-17: abrir um marco fecha o que estava aberto; abrir o mesmo de novo fecha; só um painel por vez", () => {
    chamar(secao(tela().vistos, "mk1", "onToggle"), "mk1");
    expect(mudancas).toEqual([{ marcoAberto: "mk1" }]);
    const aberto1 = fresca();
    expect(marcosEmTela(aberto1.vistos)).toBe(1);
    expect(aberto1.html).toContain("Cada feira começa do zero");
    expect(secao(aberto1.vistos, "mk1", "open")).toBe(true);
    expect(secao(aberto1.vistos, "mk2", "open")).toBe(false);

    chamar(secao(aberto1.vistos, "mk2", "onToggle"), "mk2");
    expect(mudancas.at(-1)).toEqual({ marcoAberto: "mk2" });
    const aberto2 = fresca();
    expect(marcosEmTela(aberto2.vistos)).toBe(1);
    expect(secao(aberto2.vistos, "mk1", "open")).toBe(false);
    expect(secao(aberto2.vistos, "mk2", "open")).toBe(true);
    expect(aberto2.html).not.toContain("Cada feira começa do zero");
    expect(aberto2.html).toContain("Tenho calendário fechado para os próximos 3 meses");

    chamar(secao(aberto2.vistos, "mk2", "onToggle"), "mk2");
    expect(mudancas.at(-1)).toEqual({ marcoAberto: null });
    expect(marcosEmTela(fresca().vistos)).toBe(0);
  });

  it("o marco aberto traz o conteúdo do Compilado, os dois portões e o critério batido marcado; o texto vem escapado", () => {
    ui = { ...ui, marcoAberto: "mk1" };
    const { html, vistos: lista } = tela();
    for (const texto of ["Escolher a feira certa e montar a operação mínima.", "Restrição", "Cada feira começa do zero", "Alavanca", "Repetição", "Pergunta-chave", "O que falta?", "Qualificar a feira com o organizador", "Ticket médio", "Conversão", "Portão A · Apto a vender", "Portão B · Primeira receita"]) {
      expect(html, texto).toContain(texto);
    }
    const marcados = lista.filter((v) => v.tipo === "checkbox").map((v) => [v.props.label, v.props.checked]);
    expect(marcados).toEqual([
      ["Tenho produto validado", true],
      ["Conheço meu CMV", true],
      ["Bati R$ 500 acumulados na rota", false],
      ["Registrei " + XSS, false],
    ]);
    expect(html).not.toContain("<img");
    expect(html).toContain("Registrei &quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain(">2 de 4<");
    expect(html).toContain("Fechar inscrição da próxima feira");
    expect(prop(lista, "input", (p) => p.id === "mk-mk1-data", "value")).toBe("2026-05-01");
    expect(prop(lista, "select", (p) => p.id === "mk-mk1-status", "value")).toBe("EM_ANDAMENTO");
    expect(prop(lista, "textarea", (p) => p.id === "mk-mk1-bloqueios", "value")).toBe("Sem ponto de energia");
  });

  it("OPS-19: a régua soma a rota inteira no acumulado (R$ 15.000) e diz que a meta foi batida; a do marco de R$ 20.000 diz quanto falta", () => {
    ui = { ...ui, marcoAberto: "mk1" };
    const batida = tela().html;
    expect(batida).toContain("Acumulado na rota");
    expect(batida).toMatch(/Acumulado na rota: <b[^>]*>R\$\s15\.000,00<\/b>/);
    expect(batida).toMatch(/Meta do marco: <b[^>]*>R\$\s500,00<\/b>/);
    expect(batida).toContain("Meta atingida");
    ui = { ...ui, marcoAberto: "mk2" };
    estado.valores.length = 0;
    const falta = tela().html;
    expect(falta).toMatch(/Falta <b[^>]*>R\$\s5\.000,00<\/b>/);
    expect(falta).not.toContain("Meta atingida");
  });

  it("OPS-19: na rota de unidade mes a régua é o faturamento do mês corrente (R$ 5.000), não o acumulado", () => {
    const dados = datasetDeTeste();
    dados.rotas[0] = { ...dados.rotas[0], unidade: "mes" };
    ui = { ...ui, marcoAberto: "mk2" };
    const html = tela({ dados }).html;
    expect(html).toContain("Faturamento do mês");
    expect(html).toMatch(/Faturamento do mês: <b[^>]*>R\$\s5\.000,00<\/b>/);
    expect(html).toMatch(/Falta <b[^>]*>R\$\s15\.000,00<\/b>/);
  });

  it("OPS-16: marcar um critério atualiza o contador e a barra sem fechar o painel e sem perder o campo ainda não salvo", () => {
    ui = { ...ui, marcoAberto: "mk1" };
    const inicio = tela();
    digitar(inicio.vistos, "mk-mk1-acao", "Nova ação ainda não salva");
    escolher(inicio.vistos, "mk-mk1-status", "BLOQUEADO");
    marcar(tela().vistos, "Bati R$ 500 acumulados na rota");
    const depois = tela();
    // Nenhum pedido de mudança de tela: o painel continua aberto e o `marcoAberto` é o mesmo.
    expect(mudancas).toEqual([]);
    expect(marcosEmTela(depois.vistos)).toBe(1);
    expect(depois.html).toContain(">3 de 4<");
    expect(depois.html).toMatch(/role="progressbar"[^>]*aria-valuenow="75"/);
    expect(depois.vistos.filter((v) => v.tipo === "checkbox").map((v) => v.props.checked)).toEqual([true, true, true, false]);
    expect(prop(depois.vistos, "input", (p) => p.id === "mk-mk1-acao", "value")).toBe("Nova ação ainda não salva");
    expect(prop(depois.vistos, "select", (p) => p.id === "mk-mk1-status", "value")).toBe("BLOQUEADO");
    // Desmarcar volta: o contador e a barra descem.
    marcar(depois.vistos, "Conheço meu CMV");
    marcar(tela().vistos, "Tenho produto validado");
    const fim = tela();
    expect(mudancas).toEqual([]);
    expect(fim.html).toContain(">1 de 4<");
    expect(fim.html).toMatch(/role="progressbar"[^>]*aria-valuenow="25"/);
    expect(prop(fim.vistos, "input", (p) => p.id === "mk-mk1-acao", "value")).toBe("Nova ação ainda não salva");
  });

  it("W09: salvar a evolução grava o texto dos marcados, os pendentes, o progresso derivado e os campos do registro, e recarrega", async () => {
    gravarMarco.mockResolvedValue({ ok: true, linhas: 1 });
    ui = { ...ui, marcoAberto: "mk1" };
    const lista = tela().vistos;
    marcar(lista, "Bati R$ 500 acumulados na rota");
    digitar(lista, "mk-mk1-acao", "  Fechar a inscrição  ");
    digitar(lista, "mk-mk1-bloqueios", "Sem ponto de energia\n\n  Falta banner  ", "textarea");
    digitar(lista, "mk-mk1-data", "2026-09-16");
    escolher(lista, "mk-mk1-status", "AGUARDANDO_VALIDACAO");
    chamar(botao(tela().vistos, "W09"));
    await vi.waitFor(() => expect(gravarMarco).toHaveBeenCalledTimes(1));
    expect(gravarMarco.mock.calls[0]).toEqual([
      "m1",
      "mk1",
      {
        status: "AGUARDANDO_VALIDACAO",
        data: "2026-09-16",
        criterios_ok: ["Tenho produto validado", "Conheço meu CMV", "Bati R$ 500 acumulados na rota"],
        criterios_pendentes: ["Registrei " + XSS],
        progresso: 75,
        bloqueios: ["Sem ponto de energia", "Falta banner"],
        proxima_acao: "Fechar a inscrição",
      },
    ]);
    await vi.waitFor(() => expect(toastSucesso.mock.calls).toEqual([["Evolução registrada"]]));
    expect(ordem).toEqual(["recarregar"]);
    // O painel segue aberto, com o que foi digitado.
    expect(mudancas).toEqual([]);
    expect(prop(tela().vistos, "input", (p) => p.id === "mk-mk1-acao", "value")).toBe("  Fechar a inscrição  ");
  });

  it("W09: o marco de outro mentorado grava com o id dele, e o painel dele abre do que está salvo (sem registro, não iniciado)", async () => {
    gravarMarco.mockResolvedValue({ ok: true, linhas: 1 });
    ui = { ...ui, marcoAberto: "mk2", rotaMentoradoId: "m2" };
    const lista = tela().vistos;
    expect(prop(lista, "select", (p) => p.id === "mk-mk2-status", "value")).toBe("NAO_INICIADO");
    marcar(lista, "Tenho calendário fechado para os próximos 3 meses");
    chamar(botao(tela().vistos, "W09"));
    await vi.waitFor(() => expect(gravarMarco).toHaveBeenCalledTimes(1));
    expect(gravarMarco.mock.calls[0]).toEqual([
      "m2",
      "mk2",
      { status: "NAO_INICIADO", data: null, criterios_ok: ["Tenho calendário fechado para os próximos 3 meses"], criterios_pendentes: [], progresso: 100, bloqueios: [], proxima_acao: null },
    ]);
  });

  it("W09 na rota simples: só status e data, sem os campos de próxima ação e bloqueios", async () => {
    gravarMarco.mockResolvedValue({ ok: true, linhas: 1 });
    const dados = datasetDeTeste();
    dados.rotas[0] = { ...dados.rotas[0], modelo: "simples" };
    dados.mentoradoMarcos[0] = { ...dados.mentoradoMarcos[0], status: "passou" };
    ui = { ...ui, marcoAberto: "mk1" };
    const lista = tela({ dados }).vistos;
    expect(lista.filter((v) => v.tipo === "input" && String(v.props.id).startsWith("mk-mk1-")).map((v) => v.props.id)).toEqual(["mk-mk1-data"]);
    expect(lista.some((v) => v.tipo === "textarea")).toBe(false);
    expect((prop(lista, "select", (p) => p.id === "mk-mk1-status", "options") as unknown[]).length).toBe(2);
    chamar(botao(lista, "W09"));
    await vi.waitFor(() => expect(gravarMarco).toHaveBeenCalledTimes(1));
    expect(gravarMarco.mock.calls[0]).toEqual(["m1", "mk1", { status: "passou", data: "2026-05-01" }]);
  });

  it("a escolha de mentorado troca a tela, limpa a busca e a linha 'Mostrando' diz quem é; sem escolha, o primeiro ativo; pausado volta ao primeiro", () => {
    expect(tela().html).toMatch(/Mostrando: <b[^>]*>Ana Clara<\/b>/);
    ui = { ...ui, rotaMentoradoId: "m2", filtro: { ...ui.filtro, qRotas: "bru" } };
    const bruno = tela().html;
    expect(bruno).toMatch(/Mostrando: <b[^>]*>Bruno Dias<\/b>/);
    expect(bruno).toContain("Não iniciado · A feira paga o dia · 0/4");
    ui = { ...ui, rotaMentoradoId: "m4" }; // pausado
    expect(tela().html).toMatch(/Mostrando: <b[^>]*>Ana Clara<\/b>/);
  });

  it("a escolha recebe só os ativos, o escolhido e o termo da busca; digitar guarda o termo e escolher troca o mentorado e limpa a busca", () => {
    ui = { ...ui, filtro: { ...ui.filtro, qRotas: "bru", q: "outra busca" } };
    const lista = tela().vistos;
    const ativos = prop(lista, "escolha", () => true, "ativos") as Array<{ id: string }>;
    expect(ativos.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(prop(lista, "escolha", () => true, "escolhidoId")).toBe("m1");
    expect(prop(lista, "escolha", () => true, "termo")).toBe("bru");
    chamar(prop(lista, "escolha", () => true, "onTermo"), "bruno d");
    expect(mudancas).toEqual([{ filtro: { ...ui.filtro, qRotas: "bruno d" } }]);
    chamar(prop(lista, "escolha", () => true, "onEscolher"), "m2");
    expect(mudancas[1]).toEqual({ rotaMentoradoId: "m2", filtro: { ...ui.filtro, qRotas: "" } });
    expect(mudancas[1].filtro?.q).toBe("outra busca");
  });

  it("os estados vazios: sem rota, sem mentorado ativo e rota sem marcos dizem o que falta", () => {
    const semRota = datasetDeTeste();
    semRota.rotas = [];
    expect(tela({ dados: semRota }).html).toContain("Nenhuma rota cadastrada.");
    const semAtivo = datasetDeTeste();
    semAtivo.mentorados = semAtivo.mentorados.map((m) => ({ ...m, situacao: "pausado" }));
    const html = tela({ dados: semAtivo }).html;
    expect(html).toContain("Nenhum mentorado ativo.");
    expect(html).not.toContain("Mostrando:");
    expect(html).not.toContain("Registrar faturamento");
    const semMarcos = datasetDeTeste();
    semMarcos.marcos = [];
    const vazio = tela({ dados: semMarcos }).html;
    expect(vazio.match(/Marcos desta rota ainda não foram definidos\./g)).toHaveLength(2);
  });

  it("DATA-07: a falha de qualquer das seis relações de Rotas troca a tela pelo erro, com o nome da relação e 'Tentar de novo'", () => {
    const relacoes: Relacao[] = ["rotas", "marcos_definicao", "mentorado_marcos", "faturamento_mensal", "canais", "mentorado_canais"];
    for (const relacao of relacoes) {
      const { html } = tela({ erros: { [relacao]: "permission denied" } });
      expect(html, relacao).toContain("Não foi possível carregar esta tela");
      expect(html, relacao).toContain(`${relacao}: permission denied`);
      expect(html, relacao).toContain("Tentar de novo");
      expect(html, relacao).not.toContain("Progresso por mentorado");
    }
    // Falha de uma relação que Rotas não usa não muda nada.
    expect(tela({ erros: { lia_cobrancas: "x" } }).html).toContain("Progresso por mentorado");
  });

  it("a rota escolhida vem do estado; trocar a rota pede a mudança e volta o canal ao primeiro; o botão de novo mentorado é do admin", () => {
    const dados = datasetDeTeste();
    dados.rotas.push({ id: "r2", slug: "marketplace", nome: "Marketplace", modelo: "rico", ordem: 2, unidade: "mes" });
    dados.canais.push({ id: "c9", rota_id: "r2", nome: "Mercado Livre", ordem: 1 });
    const inicial = tela({ dados });
    expect(prop(inicial.vistos, "select", (p) => p.id === "rota-atual", "options")).toEqual([
      { value: "feiras", label: "Rota das Feiras" },
      { value: "marketplace", label: "Marketplace" },
    ]);
    expect(prop(inicial.vistos, "select", (p) => p.id === "rota-atual", "value")).toBe("feiras");
    expect(inicial.html).toContain("Evolução mensal de marcos · Rota das Feiras");
    escolher(inicial.vistos, "rota-atual", "marketplace");
    expect(mudancas).toEqual([{ rotaAtual: "marketplace" }]);
    const marketplace = tela({ dados });
    expect(marketplace.html).toContain("Evolução mensal de marcos · Marketplace");
    expect(prop(marketplace.vistos, "select", (p) => p.id === "rota-atual", "value")).toBe("marketplace");
    // Slug que não existe mais cai na primeira.
    ui = { ...ui, rotaAtual: "apagada" };
    expect(tela({ dados }).html).toContain("Evolução mensal de marcos · Rota das Feiras");
    expect(escritas(inicial.vistos)).toContain("W14");
    expect(escritas(tela({ papel: "mentor" }).vistos)).not.toContain("W14");
  });
});

describe("faturamento do canal e canal de venda (W06, W07, W08)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T15:00:00Z"));
    estado.valores.length = 0;
    ordem.length = 0;
    mudancas.length = 0;
    ui = { ...UI_INICIAL };
    for (const fn of [gravarCanal, gravarFaturamento, apagarFaturamento, gravarMarco]) fn.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  it("os cards trazem o mês corrente e o anterior com a variação, e o gráfico põe o real cheio no tooltip (R$ 10.000,00, não R$ 10k)", () => {
    const { html, vistos: lista } = tela();
    expect(html).toContain("Faturamento · Presencial");
    expect(html).toMatch(/Faturamento do mês<\/span>[\s\S]*?R\$\s5\.000,00/);
    expect(html).toContain("-50% vs mês anterior");
    expect(html).toMatch(/Mês anterior[\s\S]*?R\$\s10\.000,00/);
    expect(html).toContain("referência de comparação");
    const pontos = prop(lista, "barras", () => true, "points") as Array<{ key: string; label: string; value: number; ratio: number | null; tooltip: string }>;
    expect(pontos).toHaveLength(12);
    expect(pontos[0]).toMatchObject({ key: "2025-09", label: "Set/25", value: 0 });
    expect(pontos[10]).toMatchObject({ key: "2026-07", label: "Jul/26", value: 10000, ratio: null });
    expect(pontos[11]).toMatchObject({ key: "2026-08", label: "Ago/26", value: 5000 });
    expect(pontos[10].tooltip.replace(/\s/g, " ")).toBe("Jul/26 — R$ 10.000,00");
    expect(pontos[11].tooltip.replace(/\s/g, " ")).toBe("Ago/26 — R$ 5.000,00");
    expect(pontos[0].tooltip.replace(/\s/g, " ")).toBe("Set/25 — R$ 0,00");
    expect(prop(lista, "barras", () => true, "view")).toBe("bar");
    // O caso do harness antigo (eixo do gráfico): R$ 1.000 sai por extenso.
    const mil = datasetDeTeste();
    mil.faturamento = [{ id: "f9", mentorado_id: "m1", mes: "2026-08-01", canal_id: "c1", valor: 1000 }];
    const [agosto] = (prop(tela({ dados: mil }).vistos, "barras", () => true, "points") as Array<{ tooltip: string }>).slice(-1);
    expect(agosto.tooltip.replace(/\s/g, " ")).toBe("Ago/26 — R$ 1.000,00");
  });

  it("sem mês anterior a variação diz que não há base; o mentorado sem registro mostra R$ 0,00 e a tabela vazia", () => {
    const dados = datasetDeTeste();
    dados.faturamento = [dados.faturamento[1]];
    expect(tela({ dados }).html).toContain("sem base de comparação");
    ui = { ...ui, rotaMentoradoId: "m2" };
    estado.valores.length = 0;
    const { html } = tela();
    expect(html).toContain("Nenhum registro ainda.");
    expect(html).toContain("Evolução mensal · Bruno Dias");
  });

  it("os registros vêm do mais recente ao mais antigo, com o mês abreviado e o valor em real cheio; numeric em texto vira número", () => {
    const dados = datasetDeTeste();
    dados.faturamento.push({ id: "f3", mentorado_id: "m1", mes: "2026-06-01", canal_id: "c1", valor: "1234.50" });
    const { html } = tela({ dados });
    const tabela = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
    const meses = [...tabela.matchAll(/>(Ago|Jul|Jun)\/26</g)].map((m) => m[1]);
    expect(meses).toEqual(["Ago", "Jul", "Jun"]);
    expect(tabela.replace(/\s/g, " ")).toContain("R$ 1.234,50");
    // Outro canal e outro mentorado ficam fora.
    dados.faturamento.push({ id: "f4", mentorado_id: "m1", mes: "2026-05-01", canal_id: "c9", valor: 99999 }, { id: "f5", mentorado_id: "m2", mes: "2026-04-01", canal_id: "c1", valor: 88888 });
    expect(tela({ dados }).html).not.toMatch(/99\.999|88\.888/);
  });

  it("W07: registrar faturamento grava o mês (padrão: o corrente), o canal aberto e o valor lido da moeda, e recarrega", async () => {
    gravarFaturamento.mockResolvedValue({ ok: true, linhas: 1 });
    const lista = tela().vistos;
    expect(prop(lista, "select", (p) => p.id === "ft-mes-mes", "value")).toBe("08");
    expect(prop(lista, "select", (p) => p.id === "ft-mes-ano", "value")).toBe("2026");
    escolher(lista, "ft-mes-mes", "03");
    escolher(tela().vistos, "ft-mes-ano", "2025");
    digitar(tela().vistos, "ft-valor", "2000.50");
    const preenchida = tela().vistos;
    expect(prop(preenchida, "input", (p) => p.id === "ft-valor", "value")).toBe("R$ 2.000,50");
    chamar(botao(preenchida, "W07"));
    await vi.waitFor(() => expect(gravarFaturamento).toHaveBeenCalledTimes(1));
    expect(gravarFaturamento.mock.calls[0]).toEqual(["m1", "2025-03", "c1", 2000.5]);
    await vi.waitFor(() => expect(toastSucesso.mock.calls).toEqual([["Faturamento registrado"]]));
    expect(ordem).toEqual(["recarregar"]);
    // O formulário não limpa: quem registra o mês seguinte só troca o mês.
    expect(prop(tela().vistos, "input", (p) => p.id === "ft-valor", "value")).toBe("R$ 2.000,50");
    // Sem valor digitado, o valor vai nulo (a porta grava 0, como hoje).
    estado.valores.length = 0;
    chamar(botao(tela().vistos, "W07"));
    await vi.waitFor(() => expect(gravarFaturamento).toHaveBeenCalledTimes(2));
    expect(gravarFaturamento.mock.calls[1]).toEqual(["m1", "2026-08", "c1", null]);
  });

  it("W07: com erro, o toast mostra a mensagem e o que foi digitado fica", async () => {
    gravarFaturamento.mockResolvedValue({ ok: false, erro: "duplicate key" });
    digitar(tela().vistos, "ft-valor", "750");
    chamar(botao(tela().vistos, "W07"));
    await vi.waitFor(() => expect(toastErro.mock.calls).toEqual([["duplicate key"]]));
    expect(prop(tela().vistos, "input", (p) => p.id === "ft-valor", "value")).toBe("R$ 750");
    expect(toastSucesso).not.toHaveBeenCalled();
  });

  it("UI-05 e W08: excluir pede confirmação num ConfirmDialog com o mês e o valor, e só então apaga o registro daquela linha", async () => {
    apagarFaturamento.mockResolvedValue({ ok: true, linhas: 1 });
    const inicio = tela();
    // Do mais recente ao mais antigo: a primeira linha é f2 (agosto), a segunda f1 (julho).
    expect(botoes(inicio.vistos, "W08")).toHaveLength(2);
    expect(inicio.html).not.toContain("dialog-falso");
    chamar(botoes(inicio.vistos, "W08")[1].props.onClick);
    await tique();
    expect(apagarFaturamento).not.toHaveBeenCalled();
    const confirmacao = tela();
    expect(confirmacao.html).toContain('<dialog-falso data-titulo="Excluir registro">');
    expect(confirmacao.html.replace(/\s/g, " ")).toContain("Excluir o faturamento de Jul/26 (R$ 10.000,00)? A ação não pode ser desfeita.");
    chamar(prop(confirmacao.vistos, "button", (p) => rotulo(p) === "Excluir registro", "onClick"));
    await vi.waitFor(() => expect(apagarFaturamento).toHaveBeenCalledTimes(1));
    expect(apagarFaturamento.mock.calls).toEqual([["f1"]]);
    await vi.waitFor(() => expect(toastSucesso.mock.calls).toEqual([["Registro excluído"]]));
    expect(ordem).toEqual(["recarregar"]);
    expect(tela().html).not.toContain("dialog-falso");
  });

  it("UI-05: cancelar a confirmação não apaga nada, e a falha da exclusão mantém o diálogo aberto com o erro no toast", async () => {
    apagarFaturamento.mockResolvedValue({ ok: false, erro: "fk violation" });
    chamar(botoes(tela().vistos, "W08")[0].props.onClick);
    const aberto = tela();
    chamar(prop(aberto.vistos, "button", (p) => rotulo(p) === "Excluir registro", "onClick"));
    await vi.waitFor(() => expect(toastErro.mock.calls).toEqual([["fk violation"]]));
    expect(apagarFaturamento.mock.calls).toEqual([["f2"]]);
    expect(tela().html).toContain("dialog-falso");
    chamar(prop(tela().vistos, "button", (p) => rotulo(p) === "Cancelar", "onClick"));
    expect(tela().html).not.toContain("dialog-falso");
    expect(apagarFaturamento).toHaveBeenCalledTimes(1);
  });

  it("o canal de venda só aparece com mais de um canal na rota; salvar grava mentorado, rota e canal escolhido e troca o canal aberto", async () => {
    gravarCanal.mockResolvedValue({ ok: true, linhas: 1 });
    expect(tela().vistos.some((v) => v.tipo === "select" && v.props.id === "rota-canal-mentorado")).toBe(false);
    const dados = datasetDeTeste();
    dados.canais.push({ id: "c2", rota_id: "r1", nome: "Online", ordem: 2 });
    dados.faturamento.push({ id: "f7", mentorado_id: "m1", mes: "2026-08-01", canal_id: "c2", valor: 321 });
    estado.valores.length = 0;
    const lista = tela({ dados }).vistos;
    expect(prop(lista, "select", (p) => p.id === "rota-canal-mentorado", "value")).toBe("c1"); // o salvo
    expect(prop(lista, "select", (p) => p.id === "rota-canal-mentorado", "options")).toEqual([
      { value: "c1", label: "Presencial" },
      { value: "c2", label: "Online" },
    ]);
    expect(tela({ dados }).html).toContain("Faturamento · Presencial");
    escolher(lista, "rota-canal-mentorado", "c2");
    chamar(botao(tela({ dados }).vistos, "W06"));
    await vi.waitFor(() => expect(gravarCanal).toHaveBeenCalledTimes(1));
    expect(gravarCanal.mock.calls[0]).toEqual(["m1", "r1", "c2"]);
    await vi.waitFor(() => expect(toastSucesso.mock.calls).toEqual([["Canal de venda salvo"]]));
    // O faturamento mostrado passa a ser o do canal salvo.
    await vi.waitFor(() => expect(tela({ dados }).html).toContain("Faturamento · Online"));
    expect(tela({ dados }).html).toMatch(/Faturamento do mês<\/span>[\s\S]*?R\$\s321,00/);
  });

  it("o canal aberto troca pela sanfona: a linha mostra o canal, e escolher um fecha a sanfona", () => {
    const dados = datasetDeTeste();
    dados.canais.push({ id: "c2", rota_id: "r1", nome: "Online", ordem: 2 });
    const lista = tela({ dados }).vistos;
    expect(secao(lista, "canais", "title")).toBe("Canal de Rota das Feiras · Presencial");
    chamar(secao(lista, "canais", "onToggle"), "canais");
    const aberta = tela({ dados });
    expect(secao(aberta.vistos, "canais", "open")).toBe(true);
    chamar(prop(aberta.vistos, "button", (p) => rotulo(p) === "Online", "onClick"));
    const fechada = tela({ dados });
    expect(secao(fechada.vistos, "canais", "title")).toBe("Canal de Rota das Feiras · Online");
    expect(secao(fechada.vistos, "canais", "open")).toBe(false);
  });
});

describe("papéis e capacidades (WRITE-08, WRITE-09, WRITE-03)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T15:00:00Z"));
    estado.valores.length = 0;
    ordem.length = 0;
    mudancas.length = 0;
    ui = { ...UI_INICIAL, marcoAberto: "mk1" };
    for (const fn of [gravarCanal, gravarFaturamento, apagarFaturamento, gravarMarco]) fn.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  const comCanais = () => {
    const dados = datasetDeTeste();
    dados.canais.push({ id: "c2", rota_id: "r1", nome: "Online", ordem: 2 });
    return dados;
  };

  it("diretoria lê a trilha inteira, mas sem controle de escrita: critérios e campos travados, sem salvar, sem registrar, sem excluir", () => {
    const { html, vistos: lista } = tela({ papel: "diretoria", dados: comCanais() });
    expect(escritas(lista)).toEqual([]);
    expect(html).toContain("Teste de passagem");
    expect(html).toContain("Qualificar a feira com o organizador");
    expect(lista.filter((v) => v.tipo === "checkbox").every((v) => v.props.disabled === true)).toBe(true);
    expect(lista.filter((v) => v.tipo === "checkbox")).toHaveLength(4);
    for (const id of ["mk-mk1-data", "mk-mk1-acao"]) expect(prop(lista, "input", (p) => p.id === id, "disabled")).toBe(true);
    expect(prop(lista, "textarea", (p) => p.id === "mk-mk1-bloqueios", "disabled")).toBe(true);
    expect(prop(lista, "select", (p) => p.id === "mk-mk1-status", "disabled")).toBe(true);
    expect(html).not.toContain("Salvar evolução");
    expect(html).not.toContain("Registrar faturamento");
    expect(html).toContain("Registros");
  });

  it("o mentor escreve em rotas (W06, W07, W09) mas não exclui faturamento nem cria mentorado; o admin tem os cinco", () => {
    expect(escritas(tela({ papel: "mentor", dados: comCanais() }).vistos).sort()).toEqual(["W06", "W07", "W09"]);
    expect(escritas(tela({ papel: "admin", dados: comCanais() }).vistos).sort()).toEqual(["W06", "W07", "W08", "W08", "W09", "W14"]);
  });

  it("sem a capacidade o handler não chama a porta: escreverRotas pede W06, W07 e W09; excluir pede W08", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const fn of [gravarCanal, gravarFaturamento, apagarFaturamento, gravarMarco]) fn.mockResolvedValue({ ok: true, linhas: 1 });
    const caps = new Set<Capacidade>(["escreverRotas", "excluir"]);
    const dados = comCanais();
    const lista = tela({ caps, dados }).vistos;
    chamar(botoes(lista, "W08")[0].props.onClick);
    const confirmar = prop(tela({ caps, dados }).vistos, "button", (p) => rotulo(p) === "Excluir registro", "onClick");
    const handlers = [botao(lista, "W06"), botao(lista, "W07"), botao(lista, "W09"), confirmar];
    for (const h of handlers) chamar(h);
    await vi.waitFor(() => expect([gravarCanal, gravarFaturamento, gravarMarco, apagarFaturamento].map((f) => f.mock.calls.length)).toEqual([1, 1, 1, 1]));
    caps.clear();
    for (const h of handlers) chamar(h);
    await tique();
    expect([gravarCanal, gravarFaturamento, gravarMarco, apagarFaturamento].map((f) => f.mock.calls.length)).toEqual([1, 1, 1, 1]);
    // Só excluir revogado: as três de escreverRotas seguem, a exclusão não.
    caps.add("escreverRotas");
    for (const h of handlers) chamar(h);
    await vi.waitFor(() => expect([gravarCanal, gravarFaturamento, gravarMarco].map((f) => f.mock.calls.length)).toEqual([2, 2, 2]));
    expect(apagarFaturamento).toHaveBeenCalledTimes(1);
  });

  it("WRITE-03: Salvar evolução, Registrar e Salvar canal travam durante o envio, e o excluir também", async () => {
    const pendentes: Array<(r: ResultadoEscrita) => void> = [];
    const esperar = () => new Promise<ResultadoEscrita>((resolve) => pendentes.push(resolve));
    for (const fn of [gravarCanal, gravarFaturamento, apagarFaturamento, gravarMarco]) fn.mockImplementation(esperar);
    const dados = comCanais();
    const lista = tela({ dados }).vistos;
    for (const escrita of ["W06", "W07", "W09"]) chamar(botao(lista, escrita));
    await vi.waitFor(() => expect(pendentes).toHaveLength(3));
    const ocupada = tela({ dados }).html;
    for (const escrita of ["W06", "W07", "W09"]) expect(ocupada, escrita).toMatch(new RegExp(`<button[^>]*data-escrita="${escrita}"[^>]*disabled=""[^>]*aria-busy="true"`));
    // O segundo clique no mesmo botão não envia outra.
    chamar(botao(lista, "W09"));
    await tique();
    expect(gravarMarco).toHaveBeenCalledTimes(1);
    chamar(botoes(tela({ dados }).vistos, "W08")[0].props.onClick);
    chamar(prop(tela({ dados }).vistos, "button", (p) => rotulo(p) === "Excluir registro", "onClick"));
    await vi.waitFor(() => expect(pendentes).toHaveLength(4));
    expect(tela({ dados }).html).toContain("Excluindo…");
    for (const terminar of pendentes) terminar({ ok: false, erro: "x" });
    await vi.waitFor(() => expect(tela({ dados }).html).not.toContain('aria-busy="true"'));
  });
});
