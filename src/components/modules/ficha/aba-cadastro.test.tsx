import type { ComponentProps, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, type Navegador, SessaoContexto, type ValorSessao } from "@/components/shell/contexto";
import type { Dataset, Mentorado, Resultado } from "@/lib/data/esquemas";
import type { CadastroMentorado, FinanceiroMentorado, ResultadoEscrita, SituacaoMentorado } from "@/lib/data/escritas";
import { hojeSP } from "@/lib/datas";
import type { Capacidade, Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import AbaCadastro from "./aba-cadastro";

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
// SEC-06: a sessão do supabase-js é a do usuário da tela.
const sessaoDoCliente = vi.hoisted(() => ({ id: "usuario-admin" }));
vi.mock("@/lib/data/auth", () => ({ usuarioDaSessao: () => Promise.resolve(sessaoDoCliente.id) }));
// Cada escrita anota o nome dela em `ordem`, para o teste conferir a sequência.
const ordem = vi.hoisted(() => [] as string[]);
const salvar = vi.hoisted(() => vi.fn<(id: string, campos: CadastroMentorado | FinanceiroMentorado) => Promise<ResultadoEscrita>>());
const adotar = vi.hoisted(() => vi.fn<(id: string) => Promise<Resultado<number>>>());
const situacao = vi.hoisted(() => vi.fn<(id: string, campos: SituacaoMentorado, hoje: string) => Promise<ResultadoEscrita>>());
const excluir = vi.hoisted(() => vi.fn<(id: string) => Promise<ResultadoEscrita>>());
vi.mock("@/lib/data/escritas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/escritas")>()),
  salvarMentorado: (...args: Parameters<typeof salvar>) => (ordem.push("W11"), salvar(...args)),
  adotarOrfas: (...args: Parameters<typeof adotar>) => (ordem.push("W11b"), adotar(...args)),
  salvarSituacao: situacao,
  excluirMentorado: excluir,
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

// Uma sessão com exatamente as capacidades do conjunto, lido na hora: o teste tira uma depois do render.
function sessaoCom(caps: Set<Capacidade>, papel: Papel): ValorSessao {
  const usuario = { id: `usuario-${papel}`, email: `${papel}@exemplo.com` };
  return { usuario, perfil: { id: usuario.id, role: papel, nome: papel, email: usuario.email }, papel, pode: (cap) => caps.has(cap), sair: () => Promise.resolve() };
}

// Um render, ou um re-render que mantém o estado. Recarga e navegação vão para `ordem`.
function render(el: ReactElement, { papel = "admin", caps, dados = datasetDeTeste() }: { papel?: Papel; caps?: Set<Capacidade>; dados?: Dataset } = {}) {
  estado.proximo = 0;
  vistos.length = 0;
  sessaoDoCliente.id = `usuario-${papel}`;
  const navegar: Navegador = { caminho: "/mentorado/m1", ir: (destino) => ordem.push(`ir ${destino}`), substituir: (destino) => ordem.push(`substituir ${destino}`) };
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
// O rótulo de um botão, também quando ele traz o Spinner antes do texto.
const rotulo = (p: Record<string, unknown>) => (Array.isArray(p.children) ? p.children.filter((c) => typeof c === "string").join("") : p.children);
const botao = (lista: typeof vistos, texto: string) => prop(lista, "button", (p) => rotulo(p) === texto, "onClick");
const digitar = (lista: typeof vistos, id: string, valor: string) => chamar(prop(lista, "input", (p) => p.id === id, "onChange"), { target: { value: valor } });
const escritas = (lista: typeof vistos) => lista.filter((v) => v.tipo === "button" && v.props["data-escrita"]).map((v) => [v.props["data-escrita"], rotulo(v.props)]);
const tique = () => new Promise((resolve) => setTimeout(resolve, 0));

const mentorado = (id: string, extra: Partial<Mentorado> = {}): Mentorado => ({ ...(datasetDeTeste().mentorados.find((m) => m.id === id) as Mentorado), ...extra });

describe("aba Cadastro (OPS-11, OPS-12, OPS-13, WRITE-06, SEC-05)", () => {
  beforeEach(() => {
    estado.valores.length = 0;
    ordem.length = 0;
    for (const fn of [salvar, adotar, situacao, excluir]) fn.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  it("OPS-12: sem editarMentorado (mentor e diretoria) o cadastro é só leitura, sem Salvar, sem Situação e sem Excluir", () => {
    const m1 = mentorado("m1", { link_drive: "https://drive.exemplo.com/a" });
    for (const papel of ["mentor", "diretoria"] as const) {
      const { html, vistos: lista } = render(<AbaCadastro mentorado={m1} />, { papel });
      expect(html, papel).toContain("<dl");
      for (const [termo, valor] of [
        ["Nome", "Ana Clara"],
        ["Data de fechamento", "10/01/2026"],
        ["E-mail no Google Agenda", "ana.clara@exemplo.com"],
      ]) {
        expect(html, `${papel} ${termo}`).toMatch(new RegExp(`<dt[^>]*>${termo}</dt><dd[^>]*>${valor}</dd>`));
      }
      expect(lista.filter((v) => v.tipo === "input" || v.tipo === "select"), papel).toEqual([]);
      expect(escritas(lista), papel).toEqual([]);
      expect(html, papel).not.toContain("Salvar alterações");
      expect(html, papel).not.toContain("Situação");
      expect(html, papel).not.toContain("Excluir mentorado");
    }
  });

  it("SEC-05: os três links do cadastro só viram href com http(s), com rel=\"noopener noreferrer\"; outro valor fica como texto", () => {
    const ruins = mentorado("m1", { link_drive: "javascript:alert(1)", link_mapa_mental: "data:text/html,<b>x</b>", link_whatsapp: "JavaScript:alert(2)" });
    const { html } = render(<AbaCadastro mentorado={ruins} />, { papel: "mentor" });
    expect(html).not.toMatch(/href="(?!\/)/);
    expect(html).toContain("javascript:alert(1)*");
    expect(html).toContain("data:text/html,&lt;b&gt;x&lt;/b&gt;*");
    expect(html).toContain("JavaScript:alert(2)*");
    const bons = mentorado("m1", { link_drive: "https://drive.exemplo.com/a", link_mapa_mental: "http://mapa.exemplo.com/b", link_whatsapp: "https://chat.whatsapp.com/c" });
    const links = [...render(<AbaCadastro mentorado={bons} />, { papel: "mentor" }).html.matchAll(/<a href="([^"]*)" target="_blank" rel="noopener noreferrer"/g)].map((m) => m[1]);
    expect(links).toEqual(["https://drive.exemplo.com/a", "http://mapa.exemplo.com/b", "https://chat.whatsapp.com/c"]);
  });

  it("com editarMentorado os campos vêm preenchidos, a dica do e-mail depende de haver e-mail salvo, e cada escrita tem o seu data-escrita", () => {
    const m1 = mentorado("m1", { link_whatsapp: "https://chat.whatsapp.com/c" });
    const { html, vistos: lista } = render(<AbaCadastro mentorado={m1} />);
    const valores = Object.fromEntries(lista.filter((v) => v.tipo === "input").map((v) => [v.props.id, v.props.value]));
    expect(valores).toEqual({
      "ficha-nome": "Ana Clara",
      "ficha-fechamento": "2026-01-10",
      "ficha-email": "ana.clara@exemplo.com",
      "ficha-link_drive": "",
      "ficha-link_mapa_mental": "",
      "ficha-link_whatsapp": "https://chat.whatsapp.com/c",
    });
    expect(html).toContain("O sync casa o evento por este e-mail — o nome no título do convite não importa mais.");
    expect(render(<AbaCadastro mentorado={mentorado("m4")} />).html).toContain("Sem isto, o sync ainda depende do nome escrito no título do evento.");
    expect(escritas(lista)).toEqual([
      ["W11", "Salvar alterações"],
      ["W12", "Salvar situação"],
      ["W13", "Excluir mentorado…"],
    ]);
  });

  it("OPS-13: salvar grava o W11 com o nome sem espaço, o e-mail normalizado e o vazio como null, e depois o W11b; o toast conta as cobranças adotadas", async () => {
    salvar.mockResolvedValue({ ok: true, linhas: 1 });
    adotar.mockResolvedValue({ ok: true, dados: 2 });
    const m2 = mentorado("m2");
    const inicio = render(<AbaCadastro mentorado={m2} />).vistos;
    digitar(inicio, "ficha-nome", "  Bruno Dias Souza  ");
    digitar(inicio, "ficha-email", "  Bruno.Dias@Exemplo.COM  ");
    digitar(inicio, "ficha-fechamento", "2026-04-15");
    digitar(inicio, "ficha-link_drive", "https://drive.exemplo.com/b");
    digitar(inicio, "ficha-link_whatsapp", "https://chat.whatsapp.com/b");
    chamar(botao(render(<AbaCadastro mentorado={m2} />).vistos, "Salvar alterações"));
    await vi.waitFor(() => expect(ordem).toContain("recarregar"));
    expect(salvar.mock.calls).toEqual([
      [
        "m2",
        {
          aba: "cadastro",
          nome: "Bruno Dias Souza",
          email: "bruno.dias@exemplo.com",
          data_fechamento: "2026-04-15",
          link_drive: "https://drive.exemplo.com/b",
          link_mapa_mental: null,
          link_whatsapp: "https://chat.whatsapp.com/b",
        },
      ],
    ]);
    expect(adotar.mock.calls).toEqual([["m2"]]);
    expect(ordem).toEqual(["W11", "W11b", "recarregar"]);
    expect(toastSucesso.mock.calls).toEqual([["Mentorado atualizado · 2 cobrança(s) da Lia vinculada(s)"]]);
    expect(toastErro).not.toHaveBeenCalled();

    // Sem cobrança adotada, só "Mentorado atualizado"; o e-mail esvaziado vai null, não "".
    adotar.mockResolvedValue({ ok: true, dados: 0 });
    estado.valores.length = 0;
    digitar(render(<AbaCadastro mentorado={m2} />).vistos, "ficha-email", "   ");
    chamar(botao(render(<AbaCadastro mentorado={m2} />).vistos, "Salvar alterações"));
    await vi.waitFor(() => expect(toastSucesso).toHaveBeenCalledTimes(2));
    expect(toastSucesso.mock.calls[1]).toEqual(["Mentorado atualizado"]);
    expect(salvar.mock.calls[1][1]).toMatchObject({ nome: "Bruno Dias", email: null, data_fechamento: "2026-03-02", link_drive: null });
  });

  it("WRITE-06: W11 que grava e W11b que falha avisam 'Cadastro salvo, mas as cobranças da Lia não foram puxadas:' com o erro, sem o sucesso", async () => {
    salvar.mockResolvedValue({ ok: true, linhas: 1 });
    adotar.mockResolvedValue({ ok: false, erro: "permission denied for function lia_adotar_orfas" });
    chamar(botao(render(<AbaCadastro mentorado={mentorado("m1")} />).vistos, "Salvar alterações"));
    await vi.waitFor(() => expect(ordem).toContain("recarregar"));
    expect(toastErro.mock.calls).toEqual([["Cadastro salvo, mas as cobranças da Lia não foram puxadas: permission denied for function lia_adotar_orfas"]]);
    expect(toastSucesso).not.toHaveBeenCalled();
  });

  it("WRITE-05: W11 que falha mostra o erro (o do e-mail repetido explicado), não chama o W11b e mantém o digitado; nome vazio nem grava", async () => {
    salvar.mockResolvedValue({ ok: false, erro: 'duplicate key value violates unique constraint "mentorados_email_unico"' });
    const m1 = mentorado("m1");
    digitar(render(<AbaCadastro mentorado={m1} />).vistos, "ficha-email", "bruno@exemplo.com");
    chamar(botao(render(<AbaCadastro mentorado={m1} />).vistos, "Salvar alterações"));
    await vi.waitFor(() => expect(toastErro).toHaveBeenCalledTimes(1));
    expect(toastErro.mock.calls[0][0]).toContain("Esse e-mail já está em outro mentorado.");
    expect(adotar).not.toHaveBeenCalled();
    expect(prop(render(<AbaCadastro mentorado={m1} />).vistos, "input", (p) => p.id === "ficha-email", "value")).toBe("bruno@exemplo.com");

    digitar(render(<AbaCadastro mentorado={m1} />).vistos, "ficha-nome", "   ");
    chamar(botao(render(<AbaCadastro mentorado={m1} />).vistos, "Salvar alterações"));
    expect(toastErro.mock.calls[1]).toEqual(["Informe o nome"]);
    await tique();
    expect(salvar).toHaveBeenCalledTimes(1);
  });

  it("W12: as datas da pausa só aparecem em 'pausado', e salvar grava situação, datas e o hoje da hora", async () => {
    situacao.mockResolvedValue({ ok: true, linhas: 1 });
    const m1 = mentorado("m1");
    const ativo = render(<AbaCadastro mentorado={m1} />).vistos;
    expect(prop(ativo, "select", (p) => p.id === "ficha-situacao", "value")).toBe("ativo");
    expect(ativo.some((v) => v.props.id === "ficha-pausado_em")).toBe(false);
    chamar(prop(ativo, "select", (p) => p.id === "ficha-situacao", "onChange"), "pausado");
    const pausado = render(<AbaCadastro mentorado={m1} />).vistos;
    digitar(pausado, "ficha-pausado_em", "2026-09-01");
    digitar(pausado, "ficha-retorno_previsto", "2026-12-01");
    chamar(botao(render(<AbaCadastro mentorado={m1} />).vistos, "Salvar situação"));
    await vi.waitFor(() => expect(situacao).toHaveBeenCalledTimes(1));
    expect(situacao.mock.calls[0]).toEqual(["m1", { situacao: "pausado", pausado_em: "2026-09-01", retorno_previsto: "2026-12-01" }, hojeSP()]);
    await vi.waitFor(() => expect(toastSucesso.mock.calls).toEqual([["Situação atualizada"]]));

    // O pausado do banco abre já com as datas dele; cancelado esconde as datas.
    estado.valores.length = 0;
    const m4 = mentorado("m4", { pausado_em: "2026-05-01", retorno_previsto: "2026-07-01" });
    const lista = render(<AbaCadastro mentorado={m4} />).vistos;
    expect(prop(lista, "input", (p) => p.id === "ficha-pausado_em", "value")).toBe("2026-05-01");
    chamar(prop(lista, "select", (p) => p.id === "ficha-situacao", "onChange"), "cancelado");
    expect(render(<AbaCadastro mentorado={m4} />).vistos.some((v) => v.props.id === "ficha-pausado_em")).toBe(false);
  });

  it("OPS-11: Excluir mostra o resumoExclusao e libera o botão só com o nome que casa por chaveNome; o clique confere de novo", async () => {
    const m1 = mentorado("m1");
    const fechado = render(<AbaCadastro mentorado={m1} />);
    expect(fechado.html).toContain("Apaga a ficha e tudo que está pendurado nela: 4 sessões, 1 parcela, 1 marco de rota, 2 registros de faturamento. Não dá para desfazer.");
    expect(fechado.html).toContain("<strong>Cancelado</strong> na situação acima — assim o histórico fica de pé.");
    expect(fechado.html).not.toContain("dialog-falso");
    chamar(botao(fechado.vistos, "Excluir mentorado…"));

    const aberto = render(<AbaCadastro mentorado={m1} />);
    expect(aberto.html).toContain('<dialog-falso data-titulo="Excluir mentorado">');
    expect(aberto.html).toContain("Ana Clara</strong> e o que está pendurado na ficha — 4 sessões, 1 parcela, 1 marco de rota, 2 registros de faturamento — somem do sistema.");
    expect(aberto.html).toContain("2 sessões concluídas saem da contagem dos mentores, então o fechamento do mês muda.");
    const confirmar = (lista: typeof vistos) => lista.find((v) => v.tipo === "button" && rotulo(v.props) === "Excluir definitivamente")?.props;
    expect(confirmar(aberto.vistos)?.disabled).toBe(true);

    digitar(aberto.vistos, "excluir-nome", "outra pessoa");
    const errado = render(<AbaCadastro mentorado={m1} />).vistos;
    expect(confirmar(errado)?.disabled).toBe(true);
    // O botão travado não é a única guarda: o clique com o nome errado avisa e não grava.
    chamar(confirmar(errado)?.onClick);
    expect(toastErro.mock.calls).toEqual([["Digite o nome do mentorado para confirmar"]]);
    await tique();
    expect(excluir).not.toHaveBeenCalled();

    digitar(errado, "excluir-nome", "  ana   CLARA ");
    expect(confirmar(render(<AbaCadastro mentorado={m1} />).vistos)?.disabled).toBe(false);

    // Sem nada pendurado, a ficha some sozinha, e sem concluída não há aviso de fechamento.
    estado.valores.length = 0;
    const m3 = mentorado("m3");
    chamar(botao(render(<AbaCadastro mentorado={m3} />).vistos, "Excluir mentorado…"));
    const vazio = render(<AbaCadastro mentorado={m3} />).html;
    expect(vazio).toContain("&gt;</strong> e a ficha some do sistema.");
    expect(vazio).not.toContain("da contagem dos mentores");
  });

  it("W13: excluir com o nome certo grava, avisa, recarrega e vai para a lista; com erro o diálogo fica aberto", async () => {
    excluir.mockResolvedValue({ ok: true, linhas: 1 });
    const m1 = mentorado("m1");
    chamar(botao(render(<AbaCadastro mentorado={m1} />).vistos, "Excluir mentorado…"));
    digitar(render(<AbaCadastro mentorado={m1} />).vistos, "excluir-nome", "Ana Clara");
    const lista = render(<AbaCadastro mentorado={m1} />).vistos;
    chamar(lista.find((v) => v.tipo === "button" && rotulo(v.props) === "Excluir definitivamente")?.props.onClick);
    await vi.waitFor(() => expect(ordem).toContain("ir /mentorados"));
    expect(excluir.mock.calls).toEqual([["m1"]]);
    expect(toastSucesso.mock.calls).toEqual([["Mentorado excluído"]]);
    expect(ordem).toEqual(["recarregar", "ir /mentorados"]);
    await vi.waitFor(() => expect(render(<AbaCadastro mentorado={m1} />).html).not.toContain("dialog-falso"));

    estado.valores.length = 0;
    ordem.length = 0;
    excluir.mockResolvedValue({ ok: false, erro: "permission denied for table mentorados" });
    chamar(botao(render(<AbaCadastro mentorado={m1} />).vistos, "Excluir mentorado…"));
    digitar(render(<AbaCadastro mentorado={m1} />).vistos, "excluir-nome", "Ana Clara");
    chamar(render(<AbaCadastro mentorado={m1} />).vistos.find((v) => v.tipo === "button" && rotulo(v.props) === "Excluir definitivamente")?.props.onClick);
    await vi.waitFor(() => expect(toastErro.mock.calls).toEqual([["permission denied for table mentorados"]]));
    expect(ordem).not.toContain("ir /mentorados");
    expect(render(<AbaCadastro mentorado={m1} />).html).toContain("dialog-falso");
  });

  it("WRITE-08: W11 e W12 pedem editarMentorado e W13 pede excluir; sem a capacidade, o mesmo handler não chama a porta", async () => {
    salvar.mockResolvedValue({ ok: true, linhas: 1 });
    adotar.mockResolvedValue({ ok: true, dados: 0 });
    situacao.mockResolvedValue({ ok: true, linhas: 1 });
    excluir.mockResolvedValue({ ok: true, linhas: 1 });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const m1 = mentorado("m1");

    const edita = new Set<Capacidade>(["editarMentorado"]);
    const lista = render(<AbaCadastro mentorado={m1} />, { caps: edita }).vistos;
    expect(escritas(lista)).toEqual([
      ["W11", "Salvar alterações"],
      ["W12", "Salvar situação"],
    ]);
    chamar(botao(lista, "Salvar alterações"));
    chamar(botao(lista, "Salvar situação"));
    await vi.waitFor(() => expect([salvar.mock.calls.length, situacao.mock.calls.length]).toEqual([1, 1]));
    edita.delete("editarMentorado");
    chamar(botao(lista, "Salvar alterações"));
    chamar(botao(lista, "Salvar situação"));
    await tique();
    expect([salvar.mock.calls.length, situacao.mock.calls.length]).toEqual([1, 1]);

    estado.valores.length = 0;
    const soExcluir = new Set<Capacidade>(["excluir"]);
    const leitura = render(<AbaCadastro mentorado={m1} />, { caps: soExcluir });
    expect(leitura.html).toContain("<dl");
    expect(escritas(leitura.vistos)).toEqual([["W13", "Excluir mentorado…"]]);
    chamar(botao(leitura.vistos, "Excluir mentorado…"));
    digitar(render(<AbaCadastro mentorado={m1} />, { caps: soExcluir }).vistos, "excluir-nome", "Ana Clara");
    const confirmar = render(<AbaCadastro mentorado={m1} />, { caps: soExcluir }).vistos.find((v) => v.tipo === "button" && rotulo(v.props) === "Excluir definitivamente")?.props.onClick;
    chamar(confirmar);
    await vi.waitFor(() => expect(excluir).toHaveBeenCalledTimes(1));
    soExcluir.delete("excluir");
    chamar(confirmar);
    await tique();
    expect(excluir).toHaveBeenCalledTimes(1);
  });

  it("WRITE-03: Salvar, Salvar situação e o confirmar da exclusão ficam travados, com Spinner, durante o envio", async () => {
    const pendentes: Array<(r: ResultadoEscrita) => void> = [];
    const esperar = () => new Promise<ResultadoEscrita>((resolve) => pendentes.push(resolve));
    salvar.mockImplementation(esperar);
    situacao.mockImplementation(esperar);
    excluir.mockImplementation(esperar);
    const m1 = mentorado("m1");
    chamar(botao(render(<AbaCadastro mentorado={m1} />).vistos, "Salvar alterações"));
    chamar(botao(render(<AbaCadastro mentorado={m1} />).vistos, "Salvar situação"));
    chamar(botao(render(<AbaCadastro mentorado={m1} />).vistos, "Excluir mentorado…"));
    digitar(render(<AbaCadastro mentorado={m1} />).vistos, "excluir-nome", "Ana Clara");
    chamar(render(<AbaCadastro mentorado={m1} />).vistos.find((v) => v.tipo === "button" && rotulo(v.props) === "Excluir definitivamente")?.props.onClick);
    await vi.waitFor(() => expect(pendentes).toHaveLength(3));
    const { html } = render(<AbaCadastro mentorado={m1} />);
    expect(html).toMatch(/<button[^>]*data-escrita="W11"[^>]*disabled=""[^>]*aria-busy="true"/);
    expect(html).toMatch(/<button[^>]*data-escrita="W12"[^>]*disabled=""[^>]*aria-busy="true"/);
    expect(html).toContain("Excluindo…");
    for (const terminar of pendentes) terminar({ ok: false, erro: "x" });
    await vi.waitFor(() => expect(render(<AbaCadastro mentorado={m1} />).html).not.toContain('aria-busy="true"'));
  });
});
