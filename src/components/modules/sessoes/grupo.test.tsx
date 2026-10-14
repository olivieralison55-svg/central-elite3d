import type { ComponentProps, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, type Navegador } from "@/components/shell/contexto";
import EmptyState from "@/components/ui/empty-state";
import type { Dataset } from "@/lib/data/esquemas";
import type { EncontroGrupo, ResultadoEscrita } from "@/lib/data/escritas";
import { hojeSP } from "@/lib/datas";
import type { Papel } from "@/lib/papeis";
import { agruparGrupo, ehGrupo } from "@/lib/sessoes";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import { BotaoSessaoGrupo, DetalheEncontro, RegistrarEncontroForm } from "./grupo";

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
// SEC-06: a sessão do supabase-js é a do usuário da tela (renderTela usa `usuario-<papel>`).
const sessaoDoCliente = vi.hoisted(() => ({ id: "usuario-admin" }));
vi.mock("@/lib/data/auth", () => ({ usuarioDaSessao: () => Promise.resolve(sessaoDoCliente.id) }));
const confirmar = vi.hoisted(() => vi.fn<(ids: string[], mentor: string) => Promise<ResultadoEscrita>>());
const registrar = vi.hoisted(() => vi.fn<(ids: string[], encontro: EncontroGrupo) => Promise<ResultadoEscrita>>());
vi.mock("@/lib/data/escritas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/escritas")>()),
  confirmarGrupo: confirmar,
  criarSessaoGrupo: registrar,
}));

// Os primitivos anotam as props e desenham o de verdade; o Dialog, que devolve null sem
// `document`, desenha o conteúdo num elemento falso quando aberto.
const vistos = vi.hoisted(() => [] as Array<{ tipo: string; props: Record<string, unknown> }>);
const gravar = vi.hoisted(() => (tipo: string, props: object) => vistos.push({ tipo, props: { ...props } as Record<string, unknown> }));
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("button", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/select", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/select")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("select", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/input", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/input")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("input", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/search-input", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/search-input")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("busca", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/checkbox", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/checkbox")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("checkbox", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/dialog", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: { open: boolean; onClose(): void; title?: ReactNode; children: ReactNode }) => {
      gravar("dialog", props);
      return props.open ? createElement("dialog-falso", { "data-titulo": props.title }, props.children) : null;
    },
  };
});

// Um render, ou um re-render que mantém o estado. Recarga e navegação vão para `ordem`.
function render(el: ReactElement, { papel = "admin", ordem = [], dados = datasetDeTeste() }: { papel?: Papel; ordem?: string[]; dados?: Dataset } = {}) {
  estado.proximo = 0;
  vistos.length = 0;
  sessaoDoCliente.id = `usuario-${papel}`;
  const navegar: Navegador = { caminho: "/sessoes", ir: (destino) => ordem.push(`ir ${destino}`), substituir: (destino) => ordem.push(`substituir ${destino}`) };
  const html = renderTela(
    <DadosContexto.Provider value={{ dados, erros: {}, recarregando: false, recarregar: async () => void ordem.push("recarregar") }}>{el}</DadosContexto.Provider>,
    { papel, dados, navegar },
  );
  return { html, vistos: [...vistos] };
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
const botao = (lista: typeof vistos, rotulo: string) => prop(lista, "button", (p) => p.children === rotulo, "onClick");
// O nome de cada participante e se está marcado.
const participantes = (lista: typeof vistos) => lista.filter((v) => v.tipo === "checkbox").map((v) => [v.props.label, v.props.checked]);

const [PLANTAO, IMPLEMENTACAO] = agruparGrupo(datasetDeTeste().sessoes.filter(ehGrupo));

describe("encontros em grupo (OPS-06, WRITE-03, WRITE-04)", () => {
  beforeEach(() => {
    estado.valores.length = 0;
    confirmar.mockReset();
    registrar.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  it("o detalhe: data, hora, mentor e participantes; os links; as presenças por nome, com o status e o resumo", () => {
    const { html } = render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={() => undefined} />);
    expect(html).toContain("06/08/2026 · 19:00 · Sergio · 3 participante(s)");
    expect(html).toContain('<a href="https://exemplo.com/g1" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain("Presenças · 2 concluídas · 1 bloqueada");
    const nomes = [...html.matchAll(/<li[^>]*><span class="text-ink">([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(nomes).toEqual(["Ana Clara", "Bruno Dias", expect.stringContaining("Carla")]);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x");
    expect(render(<DetalheEncontro encontro={IMPLEMENTACAO} aoConfirmar={() => undefined} />).html).toContain("Sem links registrados");
  });

  it("confirmar só aparece com escreverSessao e presença pendente, com o mentor do encontro; o botão leva data-escrita=\"W01\"", () => {
    expect(render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={() => undefined} />, { papel: "diretoria" }).html).not.toContain("Confirmar o encontro");
    for (const papel of ["admin", "mentor"] as const) {
      const { html, vistos: lista } = render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={() => undefined} />, { papel });
      expect(html, papel).toMatch(/<button[^>]*data-escrita="W01"[^>]*>Marcar 1 como concluída<\/button>/);
      expect(prop(lista, "select", (p) => p.id === "grupo-confirmar-mentor", "value"), papel).toBe("Sergio");
    }
    const concluido = agruparGrupo(datasetDeTeste().sessoes.filter((s) => s.id === "g1" || s.id === "g2"));
    expect(render(<DetalheEncontro encontro={concluido[0]} aoConfirmar={() => undefined} />).html).not.toContain("Confirmar o encontro");
    // Mentor fora de MENTORES entra nas opções, para o encontro dele continuar escolhível.
    const opcoes = prop(render(<DetalheEncontro encontro={{ ...PLANTAO, mentor: "Israel" }} aoConfirmar={() => undefined} />).vistos, "select", () => true, "options");
    expect(opcoes).toEqual(expect.arrayContaining([{ value: "", label: "Selecione o mentor…" }, { value: "Sergio", label: "Sergio" }, { value: "Israel", label: "Israel" }]));
  });

  it("confirmar exige o mentor: sem ele avisa e não grava", () => {
    const semMentor = { ...PLANTAO, mentor: null };
    chamar(botao(render(<DetalheEncontro encontro={semMentor} aoConfirmar={() => undefined} />).vistos, "Marcar 1 como concluída"));
    expect(toastErro.mock.calls).toEqual([["Selecione quem atendeu a sessão"]]);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("OPS-06: confirmar vale pelo mentor escolhido: de volta em 'Selecione o mentor…' avisa e não grava, mesmo o encontro tendo mentor; escolhido, o W01 leva esse", async () => {
    confirmar.mockResolvedValue({ ok: true, linhas: 1 });
    const seletor = (p: Record<string, unknown>) => p.id === "grupo-confirmar-mentor";
    chamar(prop(render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={() => undefined} />).vistos, "select", seletor, "onChange"), "");
    const semMentor = render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={() => undefined} />).vistos;
    expect(prop(semMentor, "select", seletor, "value")).toBe("");
    chamar(botao(semMentor, "Marcar 1 como concluída"));
    expect(toastErro.mock.calls).toEqual([["Selecione quem atendeu a sessão"]]);

    chamar(prop(render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={() => undefined} />).vistos, "select", seletor, "onChange"), "Luan");
    chamar(botao(render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={() => undefined} />).vistos, "Marcar 1 como concluída"));
    await vi.waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1));
    expect(confirmar.mock.calls).toEqual([[["g3"], "Luan"]]);
  });

  it("W01: confirmar grava só as presenças pendentes, com quem atendeu, avisa e fecha depois de recarregar", async () => {
    confirmar.mockResolvedValue({ ok: true, linhas: 1 });
    const ordem: string[] = [];
    const fechar = () => void ordem.push("fechar");
    chamar(prop(render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={fechar} />, { ordem }).vistos, "select", () => true, "onChange"), "Luan");
    chamar(botao(render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={fechar} />, { ordem }).vistos, "Marcar 1 como concluída"));
    await vi.waitFor(() => expect(ordem).toContain("fechar"));
    expect(confirmar.mock.calls).toEqual([[["g3"], "Luan"]]);
    expect(toastSucesso.mock.calls).toEqual([["1 presença(s) confirmada(s)"]]);
    expect(ordem).toEqual(["recarregar", "fechar"]);

    estado.valores.length = 0;
    chamar(botao(render(<DetalheEncontro encontro={IMPLEMENTACAO} aoConfirmar={() => undefined} />).vistos, "Marcar 2 como concluída"));
    await vi.waitFor(() => expect(confirmar).toHaveBeenCalledTimes(2));
    expect(confirmar.mock.calls[1]).toEqual([["g4", "g5"], "Michelle"]);
  });

  it("WRITE-03 e WRITE-04: durante o envio o botão W01 fica desabilitado com Spinner, e dois cliques no mesmo tick gravam uma vez", async () => {
    let terminar: (r: ResultadoEscrita) => void = () => undefined;
    confirmar.mockImplementation(() => new Promise<ResultadoEscrita>((resolve) => (terminar = resolve)));
    const clicar = botao(render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={() => undefined} />).vistos, "Marcar 1 como concluída");
    chamar(clicar);
    chamar(clicar);
    await vi.waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1));
    expect(render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={() => undefined} />).html).toMatch(/<button[^>]*data-escrita="W01"[^>]*disabled=""[^>]*aria-busy="true"/);
    terminar({ ok: true, linhas: 1 });
    await vi.waitFor(() => expect(toastSucesso).toHaveBeenCalledTimes(1));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(render(<DetalheEncontro encontro={PLANTAO} aoConfirmar={() => undefined} />).html).not.toContain('aria-busy="true"');
  });

  it("registrar exige ao menos um participante: sem nenhum avisa e não grava", () => {
    const { html, vistos: lista } = render(<RegistrarEncontroForm aoRegistrar={() => undefined} />);
    expect(html).toMatch(/<button[^>]*data-escrita="W02"[^>]*>Registrar encontro<\/button>/);
    chamar(botao(lista, "Registrar encontro"));
    expect(toastErro.mock.calls).toEqual([["Selecione ao menos um participante"]]);
    expect(registrar).not.toHaveBeenCalled();
  });

  it("OPS-06: registrar grava uma linha por participante, com a mesma etapa, status, mentor, data, hora e links, e fecha depois de recarregar", async () => {
    registrar.mockResolvedValue({ ok: true, linhas: 2 });
    const ordem: string[] = [];
    const fechar = () => void ordem.push("fechar");
    const inicio = render(<RegistrarEncontroForm aoRegistrar={fechar} />, { ordem }).vistos;
    expect(["grupo-etapa", "grupo-status", "grupo-mentor"].map((id) => prop(inicio, "select", (p) => p.id === id, "value"))).toEqual(["Plantão de Dúvida Semanal", "Agendada", ""]);
    expect(prop(inicio, "input", (p) => p.id === "grupo-data", "value")).toBe(hojeSP());
    chamar(prop(inicio, "select", (p) => p.id === "grupo-etapa", "onChange"), "Sessão de Implementação Mensal");
    chamar(prop(inicio, "select", (p) => p.id === "grupo-status", "onChange"), "Concluída");
    chamar(prop(inicio, "select", (p) => p.id === "grupo-mentor", "onChange"), "Sergio");
    for (const [id, valor] of [["grupo-data", "2026-09-03"], ["grupo-hora", "19:00"], ["grupo-link_meet", "https://meet.google.com/x"]]) {
      chamar(prop(inicio, "input", (p) => p.id === id, "onChange"), { target: { value: valor } });
    }
    const lista = render(<RegistrarEncontroForm aoRegistrar={fechar} />, { ordem }).vistos;
    chamar(prop(lista, "checkbox", (p) => p.label === "Bruno Dias", "onChange"));
    chamar(prop(lista, "checkbox", (p) => p.label === "Ana Clara", "onChange"));
    chamar(botao(render(<RegistrarEncontroForm aoRegistrar={fechar} />, { ordem }).vistos, "Registrar encontro"));
    await vi.waitFor(() => expect(ordem).toContain("fechar"));
    expect(registrar.mock.calls).toEqual([
      [
        ["m1", "m2"],
        {
          etapa: "Sessão de Implementação Mensal",
          status: "Concluída",
          mentor: "Sergio",
          data: "2026-09-03",
          hora: "19:00",
          link_meet: "https://meet.google.com/x",
          link_gravacao: "",
        },
      ],
    ]);
    expect(toastSucesso.mock.calls).toEqual([["Encontro registrado para 2 participante(s)"]]);
    expect(ordem).toEqual(["recarregar", "fechar"]);
  });

  it("OPS-06: quem foi marcado e a busca escondeu continua no encontro: o W02 grava uma linha para cada marcado", async () => {
    registrar.mockResolvedValue({ ok: true, linhas: 2 });
    const fechar = vi.fn();
    const inicio = render(<RegistrarEncontroForm aoRegistrar={fechar} />).vistos;
    chamar(prop(inicio, "checkbox", (p) => p.label === "Ana Clara", "onChange"));
    chamar(prop(inicio, "checkbox", (p) => p.label === "Bruno Dias", "onChange"));
    chamar(prop(render(<RegistrarEncontroForm aoRegistrar={fechar} />).vistos, "busca", () => true, "onChange"), { target: { value: "bruno" } });
    const buscando = render(<RegistrarEncontroForm aoRegistrar={fechar} />).vistos;
    expect(participantes(buscando)).toEqual([["Bruno Dias", true]]);
    chamar(botao(buscando, "Registrar encontro"));
    await vi.waitFor(() => expect(fechar).toHaveBeenCalledTimes(1));
    expect(registrar.mock.calls.map(([ids]) => ids)).toEqual([["m1", "m2"]]);
    expect(toastSucesso.mock.calls).toEqual([["Encontro registrado para 2 participante(s)"]]);
  });

  it("os participantes: ativos por nome; a busca esconde, 'selecionar visíveis' marca só quem aparece e 'limpar' desmarca até quem está escondido", () => {
    const inicio = render(<RegistrarEncontroForm aoRegistrar={() => undefined} />);
    expect(participantes(inicio.vistos)).toEqual([
      ["Ana Clara", false],
      ["Bruno Dias", false],
      [expect.stringContaining("Diego"), false],
    ]);
    expect(inicio.html).toContain(">Selecionar todos (3)</button>");
    chamar(prop(inicio.vistos, "busca", () => true, "onChange"), { target: { value: "bruno" } });
    const buscando = render(<RegistrarEncontroForm aoRegistrar={() => undefined} />);
    expect(participantes(buscando.vistos)).toEqual([["Bruno Dias", false]]);
    chamar(botao(buscando.vistos, "Selecionar visíveis (1)"));
    chamar(prop(buscando.vistos, "busca", () => true, "onChange"), { target: { value: "" } });
    const todos = render(<RegistrarEncontroForm aoRegistrar={() => undefined} />);
    expect(participantes(todos.vistos).map(([, marcado]) => marcado)).toEqual([false, true, false]);
    chamar(prop(todos.vistos, "checkbox", (p) => p.label === "Ana Clara", "onChange"));
    chamar(prop(todos.vistos, "busca", () => true, "onChange"), { target: { value: "bruno" } });
    chamar(botao(render(<RegistrarEncontroForm aoRegistrar={() => undefined} />).vistos, "Limpar seleção"));
    chamar(prop(render(<RegistrarEncontroForm aoRegistrar={() => undefined} />).vistos, "busca", () => true, "onChange"), { target: { value: "" } });
    expect(participantes(render(<RegistrarEncontroForm aoRegistrar={() => undefined} />).vistos).map(([, marcado]) => marcado)).toEqual([false, false, false]);

    chamar(prop(render(<RegistrarEncontroForm aoRegistrar={() => undefined} />).vistos, "busca", () => true, "onChange"), { target: { value: "zzz" } });
    expect(render(<RegistrarEncontroForm aoRegistrar={() => undefined} />).html).toContain(renderToStaticMarkup(<EmptyState title="Nenhum mentorado ativo com esse nome." />));
    estado.valores.length = 0;
    const semAtivos = { ...datasetDeTeste(), mentorados: datasetDeTeste().mentorados.filter((m) => m.situacao === "pausado") };
    expect(render(<RegistrarEncontroForm aoRegistrar={() => undefined} />, { dados: semAtivos }).html).toContain(renderToStaticMarkup(<EmptyState title="Nenhum mentorado ativo." />));
  });

  it("WRITE-03 e WRITE-04: o botão W02 trava com Spinner durante o envio, e dois cliques no mesmo tick gravam uma vez", async () => {
    let terminar: (r: ResultadoEscrita) => void = () => undefined;
    registrar.mockImplementation(() => new Promise<ResultadoEscrita>((resolve) => (terminar = resolve)));
    chamar(prop(render(<RegistrarEncontroForm aoRegistrar={() => undefined} />).vistos, "checkbox", (p) => p.label === "Ana Clara", "onChange"));
    const clicar = botao(render(<RegistrarEncontroForm aoRegistrar={() => undefined} />).vistos, "Registrar encontro");
    chamar(clicar);
    chamar(clicar);
    await vi.waitFor(() => expect(registrar).toHaveBeenCalledTimes(1));
    expect(render(<RegistrarEncontroForm aoRegistrar={() => undefined} />).html).toMatch(/<button[^>]*data-escrita="W02"[^>]*disabled=""[^>]*aria-busy="true"/);
    terminar({ ok: true, linhas: 1 });
    await vi.waitFor(() => expect(toastSucesso).toHaveBeenCalledTimes(1));
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it("WRITE-09: '+ Sessão em grupo' só com criarSessao, com data-escrita=\"W02\", e abre e fecha o modal de registro", () => {
    for (const papel of ["diretoria", "mentor"] as const) expect(render(<BotaoSessaoGrupo />, { papel }).html, papel).toBe("");
    const fechado = render(<BotaoSessaoGrupo />);
    expect(fechado.html).toMatch(/<button[^>]*data-escrita="W02"[^>]*>\+ Sessão em grupo<\/button>/);
    expect(fechado.html).not.toContain("dialog-falso");
    chamar(botao(fechado.vistos, "+ Sessão em grupo"));
    const aberto = render(<BotaoSessaoGrupo />);
    expect(aberto.html).toContain('<dialog-falso data-titulo="Nova sessão em grupo">');
    expect(aberto.html).toContain(">Registrar encontro</button>");
    chamar(prop(aberto.vistos, "dialog", () => true, "onClose"));
    expect(render(<BotaoSessaoGrupo />).html).not.toContain("dialog-falso");
  });
});
