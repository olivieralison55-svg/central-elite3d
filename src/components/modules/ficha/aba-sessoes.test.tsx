import type { ComponentProps, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, type Navegador, SessaoContexto, type ValorSessao } from "@/components/shell/contexto";
import { ETAPAS } from "@/lib/constantes";
import type { Dataset, Mentorado, Sessao } from "@/lib/data/esquemas";
import type { CamposSessao, ResultadoEscrita } from "@/lib/data/escritas";
import type { Capacidade, Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import AbaSessoes, { ConfirmarSessaoForm, SessaoForm } from "./aba-sessoes";

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
vi.mock("@/lib/data/auth", () => ({ usuarioDaSessao: () => Promise.resolve(sessaoDoCliente.id) }));
const ordem = vi.hoisted(() => [] as string[]);
const salvar = vi.hoisted(() => vi.fn<(id: string | null, campos: CamposSessao) => Promise<ResultadoEscrita>>());
const confirmar = vi.hoisted(() => vi.fn<(id: string, mentor: string) => Promise<ResultadoEscrita>>());
const apagar = vi.hoisted(() => vi.fn<(id: string) => Promise<ResultadoEscrita>>());
vi.mock("@/lib/data/escritas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/escritas")>()),
  salvarSessao: salvar,
  confirmarSessao: confirmar,
  delSessao: apagar,
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
vi.mock("@/components/ui/select", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/select")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("select", props), createElement(original.default, props)) };
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

function render(el: ReactElement, { papel = "admin", caps, dados = datasetDeTeste() }: { papel?: Papel; caps?: Set<Capacidade>; dados?: Dataset } = {}) {
  estado.proximo = 0;
  vistos.length = 0;
  sessaoDoCliente.id = `usuario-${papel}`;
  const navegar: Navegador = { caminho: "/mentorado/m1/sessoes", ir: (destino) => ordem.push(`ir ${destino}`), substituir: (destino) => ordem.push(`substituir ${destino}`) };
  const conteudo = <DadosContexto.Provider value={{ dados, erros: {}, recarregando: false, recarregar: async () => void ordem.push("recarregar") }}>{el}</DadosContexto.Provider>;
  const html = renderTela(caps ? <SessaoContexto.Provider value={sessaoCom(caps, papel)}>{conteudo}</SessaoContexto.Provider> : conteudo, { papel, dados, navegar });
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
const rotulo = (p: Record<string, unknown>) => (Array.isArray(p.children) ? p.children.filter((c) => typeof c === "string").join("") : p.children);
const botao = (lista: typeof vistos, texto: string) => prop(lista, "button", (p) => rotulo(p) === texto, "onClick");
const digitar = (lista: typeof vistos, id: string, valor: string) => chamar(prop(lista, "input", (p) => p.id === id, "onChange"), { target: { value: valor } });
const escolher = (lista: typeof vistos, id: string, valor: string) => chamar(prop(lista, "select", (p) => p.id === id, "onChange"), valor);
const valor = (lista: typeof vistos, tipo: string, id: string) => prop(lista, tipo, (p) => p.id === id, "value");
const escritas = (lista: typeof vistos) => lista.filter((v) => v.tipo === "button" && v.props["data-escrita"]).map((v) => [v.props["data-escrita"], rotulo(v.props)]);
const tique = () => new Promise((resolve) => setTimeout(resolve, 0));

const mentorado = (id: string): Mentorado => datasetDeTeste().mentorados.find((m) => m.id === id) as Mentorado;
const sessao = (id: string, extra: Partial<Sessao> = {}): Sessao => ({ ...(datasetDeTeste().sessoes.find((s) => s.id === id) as Sessao), ...extra });

describe("aba Sessões e modais de sessão (OPS-05, OPS-08, WRITE-03, UI-05)", () => {
  beforeEach(() => {
    estado.valores.length = 0;
    ordem.length = 0;
    for (const fn of [salvar, confirmar, apagar]) fn.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  it("OPS-05: a trilha e a legenda contam só as 1:1; os encontros em grupo do mentorado ficam à parte, do mais recente ao mais antigo", () => {
    const { html } = render(<AbaSessoes mentorado={mentorado("m1")} />);
    expect(html).toContain('role="img" aria-label="1 de 2 sessões 1:1 concluídas"');
    expect(html).toContain(">1 de 2 sessões 1:1 concluídas<");
    expect([...html.matchAll(/<span title="([^"]*)" class="h-1\.5 w-3/g)].map((m) => m[1])).toEqual(["Diagnóstico de Negócio: Concluída", "Plano de Ação: Agendada"]);
    const umAUm = html.slice(html.indexOf("Sessões 1:1 com mentores"), html.indexOf("Sessões em grupo"));
    expect([...umAUm.matchAll(/<span class="text-sm font-semibold text-ink">([^<]*)<\/span>/g)].map((m) => m[1])).toEqual(["Diagnóstico de Negócio", "Plano de Ação"]);
    const emGrupo = html.slice(html.indexOf("Sessões em grupo"));
    expect(html).toContain(">Sessões em grupo · 2<");
    expect([...emGrupo.matchAll(/<span class="text-sm font-semibold text-ink">([^<]*)<\/span>/g)].map((m) => m[1])).toEqual([
      "Sessão de Implementação Mensal",
      "Plantão de Dúvida Semanal",
    ]);
    // Sem mentor, a linha diz; sem sessão nenhuma, EmptyState e nenhum bloco de grupo.
    expect(render(<AbaSessoes mentorado={mentorado("m2")} />).html).toContain(">— sem mentor<");
    const vazio = render(<AbaSessoes mentorado={mentorado("m3")} />).html;
    expect(vazio).toContain("Nenhuma sessão registrada ainda.");
    expect(vazio).toContain(">0 de 0 sessões 1:1 concluídas<");
    expect(vazio).not.toContain("Sessões em grupo");
  });

  it("o mentor edita e confirma, mas não cria; '+ Nova sessão' só com criarSessao; a diretoria não escreve", () => {
    const m2 = mentorado("m2");
    // m2: s3 aguarda confirmação, s4 está bloqueada, g2 e g5 são de grupo.
    expect(escritas(render(<AbaSessoes mentorado={m2} />).vistos)).toEqual([
      ["W03", "+ Nova sessão"],
      ["W04", "Confirmar"],
      ["W03", "Editar"],
      ["W03", "Editar"],
      ["W03", "Editar"],
      ["W03", "Editar"],
    ]);
    expect(escritas(render(<AbaSessoes mentorado={m2} />, { papel: "mentor" }).vistos)).toEqual([
      ["W04", "Confirmar"],
      ["W03", "Editar"],
      ["W03", "Editar"],
      ["W03", "Editar"],
      ["W03", "Editar"],
    ]);
    expect(escritas(render(<AbaSessoes mentorado={m2} />, { papel: "diretoria" }).vistos)).toEqual([]);
  });

  it("'+ Nova sessão', Editar e Confirmar abrem o modal certo, que fecha no onClose", () => {
    const m1 = mentorado("m1");
    chamar(botao(render(<AbaSessoes mentorado={m1} />).vistos, "+ Nova sessão"));
    const nova = render(<AbaSessoes mentorado={m1} />);
    expect(nova.html).toContain('<dialog-falso data-titulo="Nova sessão · Ana Clara">');
    expect(valor(nova.vistos, "select", "sessao-etapa")).toBe("Checkup 1");
    chamar(prop(nova.vistos, "dialog", (p) => p.open === true, "onClose"));
    expect(render(<AbaSessoes mentorado={m1} />).html).not.toContain("dialog-falso");
    // O formulário fechado desmonta: o próximo nasce do zero, como no React.
    estado.valores.length = 0;

    const editaveis = render(<AbaSessoes mentorado={m1} />).vistos.filter((v) => v.tipo === "button" && rotulo(v.props) === "Editar");
    chamar(editaveis[1].props.onClick);
    const edicao = render(<AbaSessoes mentorado={m1} />);
    expect(edicao.html).toContain('<dialog-falso data-titulo="Editar sessão · Ana Clara">');
    expect(valor(edicao.vistos, "select", "sessao-etapa")).toBe("Plano de Ação");

    estado.valores.length = 0;
    const m2 = mentorado("m2");
    chamar(botao(render(<AbaSessoes mentorado={m2} />).vistos, "Confirmar"));
    const confirmacao = render(<AbaSessoes mentorado={m2} />);
    expect(confirmacao.html).toContain('<dialog-falso data-titulo="Confirmar sessão">');
    expect(confirmacao.html).toContain("Diagnóstico de Negócio · Bruno Dias · 01/04/2026");
  });

  it("W03 nova: sugere a próxima etapa 1:1 livre (a primeira, com as 12 usadas), status Agendada, e grava com o mentorado da ficha", async () => {
    salvar.mockResolvedValue({ ok: true, linhas: 1 });
    const fechar = vi.fn();
    const inicio = render(<SessaoForm sessao={null} mentoradoId="m1" aoTerminar={fechar} />).vistos;
    expect([valor(inicio, "select", "sessao-etapa"), valor(inicio, "select", "sessao-status"), valor(inicio, "select", "sessao-mentor")]).toEqual(["Checkup 1", "Agendada", ""]);
    escolher(inicio, "sessao-mentor", "Luan");
    digitar(inicio, "sessao-data", "2099-12-31");
    digitar(inicio, "sessao-hora", "23:59");
    digitar(inicio, "sessao-link_meet", "https://meet.google.com/x");
    chamar(botao(render(<SessaoForm sessao={null} mentoradoId="m1" aoTerminar={fechar} />).vistos, "Salvar sessão"));
    await vi.waitFor(() => expect(fechar).toHaveBeenCalledTimes(1));
    expect(salvar.mock.calls).toEqual([
      [
        null,
        {
          mentorado_id: "m1",
          etapa: "Checkup 1",
          status: "Agendada",
          mentor: "Luan",
          data: "2099-12-31",
          hora: "23:59",
          link_meet: "https://meet.google.com/x",
          link_gravacao: "",
          link_anotacoes: "",
        },
      ],
    ]);
    expect(toastSucesso.mock.calls).toEqual([["Sessão salva"]]);
    expect(ordem).toEqual(["recarregar"]);

    // Com as 12 etapas 1:1 usadas, a sugestão é a primeira, como o navegador fazia.
    estado.valores.length = 0;
    const dados = datasetDeTeste();
    dados.sessoes = ETAPAS.map((etapa, i) => ({ ...dados.sessoes[0], id: `t${i}`, etapa, ordem: i + 1 }));
    expect(valor(render(<SessaoForm sessao={null} mentoradoId="m1" aoTerminar={fechar} />, { dados }).vistos, "select", "sessao-etapa")).toBe("Diagnóstico de Negócio");
  });

  it("OPS-08 e W03 edição: o formulário abre com a sessão (a etapa fora do catálogo e o mentor de fora continuam escolhíveis) e grava pelo id", async () => {
    salvar.mockResolvedValue({ ok: true, linhas: 1 });
    const s2 = sessao("s2");
    const inicio = render(<SessaoForm sessao={s2} mentoradoId="m1" aoTerminar={() => undefined} />).vistos;
    expect([valor(inicio, "select", "sessao-etapa"), valor(inicio, "select", "sessao-status"), valor(inicio, "select", "sessao-mentor"), valor(inicio, "input", "sessao-data"), valor(inicio, "input", "sessao-hora")]).toEqual([
      "Plano de Ação",
      "Agendada",
      "Evaldo",
      "2099-09-01",
      "14:00",
    ]);
    expect(prop(inicio, "select", (p) => p.id === "sessao-mentor", "options")).toContainEqual({ value: "Evaldo", label: "Evaldo" });
    escolher(inicio, "sessao-etapa", "Checkup 5");
    escolher(inicio, "sessao-status", "Concluída");
    escolher(inicio, "sessao-mentor", "Luan");
    digitar(inicio, "sessao-data", "2026-09-17");
    chamar(botao(render(<SessaoForm sessao={s2} mentoradoId="m1" aoTerminar={() => undefined} />).vistos, "Salvar sessão"));
    await vi.waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
    expect(salvar.mock.calls[0]).toEqual([
      "s2",
      { mentorado_id: "m1", etapa: "Checkup 5", status: "Concluída", mentor: "Luan", data: "2026-09-17", hora: "14:00", link_meet: "", link_gravacao: "", link_anotacoes: "" },
    ]);

    estado.valores.length = 0;
    const antiga = render(<SessaoForm sessao={sessao("s1", { etapa: "Mentoria Antiga" })} mentoradoId="m1" aoTerminar={() => undefined} />).vistos;
    expect(valor(antiga, "select", "sessao-etapa")).toBe("Mentoria Antiga");
    expect(prop(antiga, "select", (p) => p.id === "sessao-etapa", "options")).toContainEqual({ value: "Mentoria Antiga", label: "Mentoria Antiga" });
  });

  it("UI-05 e W05: excluir só na sessão existente e com excluir, por ConfirmDialog, e só então apaga", async () => {
    apagar.mockResolvedValue({ ok: true, linhas: 1 });
    const s2 = sessao("s2");
    expect(escritas(render(<SessaoForm sessao={null} mentoradoId="m1" aoTerminar={() => undefined} />).vistos)).toEqual([["W03", "Salvar sessão"]]);
    expect(escritas(render(<SessaoForm sessao={s2} mentoradoId="m1" aoTerminar={() => undefined} />, { papel: "mentor" }).vistos)).toEqual([["W03", "Salvar sessão"]]);
    const fechar = vi.fn();
    const inicio = render(<SessaoForm sessao={s2} mentoradoId="m1" aoTerminar={fechar} />);
    expect(escritas(inicio.vistos)).toEqual([
      ["W03", "Salvar sessão"],
      ["W05", "Excluir"],
    ]);
    chamar(botao(inicio.vistos, "Excluir"));
    await tique();
    expect(apagar).not.toHaveBeenCalled();
    const confirmacao = render(<SessaoForm sessao={s2} mentoradoId="m1" aoTerminar={fechar} />);
    expect(confirmacao.html).toContain('<dialog-falso data-titulo="Excluir sessão">');
    expect(confirmacao.html).toContain("Excluir esta sessão? A ação não pode ser desfeita.");
    chamar(botao(confirmacao.vistos, "Excluir sessão"));
    await vi.waitFor(() => expect(fechar).toHaveBeenCalledTimes(1));
    expect(apagar.mock.calls).toEqual([["s2"]]);
    expect(toastSucesso.mock.calls).toEqual([["Sessão excluída"]]);
  });

  it("W04: confirmar exige quem atendeu; com o mentor escolhido, grava, avisa e fecha", async () => {
    confirmar.mockResolvedValue({ ok: true, linhas: 1 });
    const s3 = sessao("s3");
    const fechar = vi.fn();
    const inicio = render(<ConfirmarSessaoForm sessao={s3} aoTerminar={fechar} />).vistos;
    expect(valor(inicio, "select", "confirmar-mentor")).toBe("");
    chamar(botao(inicio, "Confirmar como concluída"));
    expect(toastErro.mock.calls).toEqual([["Selecione quem atendeu a sessão"]]);
    await tique();
    expect(confirmar).not.toHaveBeenCalled();
    escolher(inicio, "confirmar-mentor", "Michelle");
    chamar(botao(render(<ConfirmarSessaoForm sessao={s3} aoTerminar={fechar} />).vistos, "Confirmar como concluída"));
    await vi.waitFor(() => expect(fechar).toHaveBeenCalledTimes(1));
    expect(confirmar.mock.calls).toEqual([["s3", "Michelle"]]);
    expect(toastSucesso.mock.calls).toEqual([["Sessão confirmada como concluída"]]);
    // O mentor gravado de quem saiu do projeto vem escolhido e entra nas opções.
    estado.valores.length = 0;
    const antigo = render(<ConfirmarSessaoForm sessao={sessao("s5")} aoTerminar={fechar} />).vistos;
    expect(valor(antigo, "select", "confirmar-mentor")).toBe("Israel");
    expect(prop(antigo, "select", (p) => p.id === "confirmar-mentor", "options")).toContainEqual({ value: "Israel", label: "Israel" });
  });

  it("WRITE-08: criar pede criarSessao, editar e confirmar pedem escreverSessao, excluir pede excluir; sem a capacidade o handler não chama a porta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    salvar.mockResolvedValue({ ok: true, linhas: 1 });
    confirmar.mockResolvedValue({ ok: true, linhas: 1 });
    apagar.mockResolvedValue({ ok: true, linhas: 1 });
    const s3 = sessao("s3");

    // Com só escreverSessao, a nova sessão não grava; com só criarSessao, a edição não grava.
    const nova = render(<SessaoForm sessao={null} mentoradoId="m2" aoTerminar={() => undefined} />, { caps: new Set<Capacidade>(["escreverSessao"]) }).vistos;
    chamar(botao(nova, "Salvar sessão"));
    estado.valores.length = 0;
    const edicao = render(<SessaoForm sessao={s3} mentoradoId="m2" aoTerminar={() => undefined} />, { caps: new Set<Capacidade>(["criarSessao"]) }).vistos;
    chamar(botao(edicao, "Salvar sessão"));
    await tique();
    expect(salvar).not.toHaveBeenCalled();

    estado.valores.length = 0;
    const cria = new Set<Capacidade>(["criarSessao"]);
    chamar(botao(render(<SessaoForm sessao={null} mentoradoId="m2" aoTerminar={() => undefined} />, { caps: cria }).vistos, "Salvar sessão"));
    estado.valores.length = 0;
    const escreve = new Set<Capacidade>(["escreverSessao"]);
    chamar(botao(render(<SessaoForm sessao={s3} mentoradoId="m2" aoTerminar={() => undefined} />, { caps: escreve }).vistos, "Salvar sessão"));
    await vi.waitFor(() => expect(salvar.mock.calls.map(([id]) => id)).toEqual([null, "s3"]));

    estado.valores.length = 0;
    const confirma = new Set<Capacidade>(["escreverSessao"]);
    const formConfirmar = render(<ConfirmarSessaoForm sessao={{ ...s3, mentor: "Luan" }} aoTerminar={() => undefined} />, { caps: confirma }).vistos;
    chamar(botao(formConfirmar, "Confirmar como concluída"));
    await vi.waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1));
    confirma.delete("escreverSessao");
    chamar(botao(formConfirmar, "Confirmar como concluída"));
    await tique();
    expect(confirmar).toHaveBeenCalledTimes(1);

    estado.valores.length = 0;
    const exclui = new Set<Capacidade>(["escreverSessao", "excluir"]);
    chamar(botao(render(<SessaoForm sessao={s3} mentoradoId="m2" aoTerminar={() => undefined} />, { caps: exclui }).vistos, "Excluir"));
    const confirmarExclusao = botao(render(<SessaoForm sessao={s3} mentoradoId="m2" aoTerminar={() => undefined} />, { caps: exclui }).vistos, "Excluir sessão");
    exclui.delete("excluir");
    chamar(confirmarExclusao);
    await tique();
    expect(apagar).not.toHaveBeenCalled();
    exclui.add("excluir");
    chamar(confirmarExclusao);
    await vi.waitFor(() => expect(apagar.mock.calls).toEqual([["s3"]]));
  });

  it("WRITE-03: Salvar sessão, Confirmar como concluída e o confirmar da exclusão travam com Spinner durante o envio", async () => {
    const pendentes: Array<(r: ResultadoEscrita) => void> = [];
    const esperar = () => new Promise<ResultadoEscrita>((resolve) => pendentes.push(resolve));
    for (const fn of [salvar, confirmar, apagar]) fn.mockImplementation(esperar);
    const s2 = sessao("s2");
    chamar(botao(render(<SessaoForm sessao={s2} mentoradoId="m1" aoTerminar={() => undefined} />).vistos, "Salvar sessão"));
    chamar(botao(render(<SessaoForm sessao={s2} mentoradoId="m1" aoTerminar={() => undefined} />).vistos, "Excluir"));
    chamar(botao(render(<SessaoForm sessao={s2} mentoradoId="m1" aoTerminar={() => undefined} />).vistos, "Excluir sessão"));
    await vi.waitFor(() => expect(pendentes).toHaveLength(2));
    const form = render(<SessaoForm sessao={s2} mentoradoId="m1" aoTerminar={() => undefined} />).html;
    expect(form).toMatch(/<button[^>]*data-escrita="W03"[^>]*disabled=""[^>]*aria-busy="true"/);
    expect(form).toContain("Excluindo…");

    estado.valores.length = 0;
    chamar(botao(render(<ConfirmarSessaoForm sessao={sessao("s2")} aoTerminar={() => undefined} />).vistos, "Confirmar como concluída"));
    await vi.waitFor(() => expect(pendentes).toHaveLength(3));
    expect(render(<ConfirmarSessaoForm sessao={sessao("s2")} aoTerminar={() => undefined} />).html).toMatch(/<button[^>]*data-escrita="W04"[^>]*disabled=""[^>]*aria-busy="true"/);
    for (const terminar of pendentes) terminar({ ok: false, erro: "x" });
    await vi.waitFor(() => expect(render(<ConfirmarSessaoForm sessao={sessao("s2")} aoTerminar={() => undefined} />).html).not.toContain('aria-busy="true"'));
  });
});
