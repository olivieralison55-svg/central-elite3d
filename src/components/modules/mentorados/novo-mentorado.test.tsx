import type { ComponentProps, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, type Navegador } from "@/components/shell/contexto";
import type { NovoMentorado, ResultadoEscrita } from "@/lib/data/escritas";
import { hojeSP } from "@/lib/datas";
import type { Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import { BotaoNovoMentorado, NovoMentoradoForm } from "./novo-mentorado";

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
const criar = vi.hoisted(() => vi.fn<(novo: NovoMentorado) => Promise<ResultadoEscrita>>());
vi.mock("@/lib/data/escritas", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/data/escritas")>()), criarMentorado: criar }));

// Input, Select e Button anotam as props e desenham o de verdade; o Dialog, que devolve null sem
// `document`, desenha o conteúdo num elemento falso quando aberto.
const vistos = vi.hoisted(() => [] as Array<{ tipo: string; props: Record<string, unknown> }>);
vi.mock("@/components/ui/input", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/input")>();
  return {
    ...original,
    default: (props: ComponentProps<typeof original.default>) => {
      vistos.push({ tipo: "input", props: { ...props } });
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
vi.mock("@/components/ui/dialog", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: { open: boolean; onClose(): void; title?: ReactNode; children: ReactNode }) => {
      vistos.push({ tipo: "dialog", props: { ...props } });
      return props.open ? createElement("dialog-falso", { "data-titulo": props.title }, props.children) : null;
    },
  };
});

// Um render, ou um re-render: o estado do formulário continua o do render anterior. Recarga e
// navegação vão para `ordem`.
function render(el: ReactElement, ordem: string[] = [], papel: Papel = "admin") {
  estado.proximo = 0;
  vistos.length = 0;
  sessaoDoCliente.id = `usuario-${papel}`;
  const navegar: Navegador = { caminho: "/mentorados", ir: (destino) => ordem.push(`ir ${destino}`), substituir: (destino) => ordem.push(`substituir ${destino}`) };
  const dados = datasetDeTeste();
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
const digitar = (lista: typeof vistos, id: string, valor: string) => chamar(prop(lista, "input", (p) => p.id === id, "onChange"), { target: { value: valor } });
const escolher = (lista: typeof vistos, id: string, valor: string) => chamar(prop(lista, "select", (p) => p.id === id, "onChange"), valor);
const ehCriar = (p: Record<string, unknown>) => p["data-escrita"] === "W14" && p.children === "Criar mentorado";
const valor = (lista: typeof vistos, id: string) => prop(lista, "input", (p) => p.id === id, "value");

describe("modal Novo mentorado (WRITE-01, WRITE-03, WRITE-05, OPS-13)", () => {
  beforeEach(() => {
    estado.valores.length = 0;
    criar.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  it("os padrões de hoje: fechamento hoje, entrada Pago, contrato e restante 'Ainda não', nome e e-mail vazios", () => {
    const { html, vistos: lista } = render(<NovoMentoradoForm aoCriar={() => undefined} />);
    expect([valor(lista, "novo-nome"), valor(lista, "novo-email"), valor(lista, "novo-fechamento"), valor(lista, "novo-forma")]).toEqual(["", "", hojeSP(), ""]);
    expect(prop(lista, "input", (p) => p.id === "novo-fechamento", "type")).toBe("date");
    expect(html).toContain('<input type="hidden" name="entrada_status" value="Pago"/>');
    expect(html).toContain('<input type="hidden" name="contrato_status" value="Ainda não"/>');
    expect(html).toContain('<input type="hidden" name="restante_status" value="Ainda não"/>');
    expect(html).toContain("Preenchendo aqui, o sync casa a sessão por este e-mail e o título do convite não precisa trazer o nome dele.");
  });

  it("OPS-13: o nome é obrigatório: vazio ou só espaço avisa 'Informe o nome' e não chama a porta", () => {
    const aoCriar = vi.fn();
    for (const nome of ["", "   "]) {
      digitar(render(<NovoMentoradoForm aoCriar={aoCriar} />).vistos, "novo-nome", nome);
      chamar(prop(render(<NovoMentoradoForm aoCriar={aoCriar} />).vistos, "button", ehCriar, "onClick"));
    }
    expect(toastErro.mock.calls).toEqual([["Informe o nome"], ["Informe o nome"]]);
    expect(criar).not.toHaveBeenCalled();
    expect(aoCriar).not.toHaveBeenCalled();
  });

  it("WRITE-01 e OPS-13: a porta recebe o nome sem espaço, o e-mail normalizado e cada campo do formulário; vazio vai como null", async () => {
    criar.mockResolvedValue({ ok: true, linhas: 1, id: "m9" });
    const primeiro = render(<NovoMentoradoForm aoCriar={() => undefined} />).vistos;
    digitar(primeiro, "novo-nome", "  Bruno Novo  ");
    digitar(primeiro, "novo-email", " BRUNO@Exemplo.com ");
    digitar(primeiro, "novo-fechamento", "2026-10-01");
    digitar(primeiro, "novo-forma", "pix");
    escolher(primeiro, "novo-entrada", "Pago parcial");
    escolher(primeiro, "novo-contrato", "Assinado");
    escolher(primeiro, "novo-restante", "Pago");
    chamar(prop(render(<NovoMentoradoForm aoCriar={() => undefined} />).vistos, "button", ehCriar, "onClick"));
    await vi.waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    expect(criar.mock.calls[0][0]).toEqual({
      nome: "Bruno Novo",
      email: "bruno@exemplo.com",
      data_fechamento: "2026-10-01",
      entrada_status: "Pago parcial",
      entrada_forma_pgto: "pix",
      contrato_status: "Assinado",
      restante_status: "Pago",
    });

    estado.valores.length = 0;
    digitar(render(<NovoMentoradoForm aoCriar={() => undefined} />).vistos, "novo-nome", "Carla Nova");
    chamar(prop(render(<NovoMentoradoForm aoCriar={() => undefined} />).vistos, "button", ehCriar, "onClick"));
    await vi.waitFor(() => expect(criar).toHaveBeenCalledTimes(2));
    expect(criar.mock.calls[1][0]).toEqual({
      nome: "Carla Nova",
      email: null,
      data_fechamento: hojeSP(),
      entrada_status: "Pago",
      entrada_forma_pgto: null,
      contrato_status: "Ainda não",
      restante_status: "Ainda não",
    });
  });

  it("WRITE-05: e-mail repetido mostra a mensagem própria, e o modal fica aberto com o que foi digitado, sem recarregar nem navegar", async () => {
    criar.mockResolvedValue({ ok: false, erro: 'duplicate key value violates unique constraint "mentorados_email_unico"' });
    const ordem: string[] = [];
    const aoCriar = vi.fn();
    const primeiro = render(<NovoMentoradoForm aoCriar={aoCriar} />, ordem).vistos;
    digitar(primeiro, "novo-nome", "  Bruno Novo  ");
    digitar(primeiro, "novo-email", "Bruno@Exemplo.com");
    chamar(prop(render(<NovoMentoradoForm aoCriar={aoCriar} />, ordem).vistos, "button", ehCriar, "onClick"));
    await vi.waitFor(() => expect(toastErro).toHaveBeenCalledTimes(1));
    expect(toastErro.mock.calls).toEqual([
      ["Esse e-mail já está em outro mentorado. Dois cadastros com o mesmo e-mail fariam o sync descartar o evento em vez de escolher um."],
    ]);
    expect(aoCriar).not.toHaveBeenCalled();
    expect(ordem).toEqual([]);
    const depois = render(<NovoMentoradoForm aoCriar={aoCriar} />, ordem).vistos;
    expect([valor(depois, "novo-nome"), valor(depois, "novo-email")]).toEqual(["  Bruno Novo  ", "Bruno@Exemplo.com"]);
  });

  it("criado, avisa, recarrega e só então abre a ficha nova na aba Cadastro, e fecha o modal", async () => {
    criar.mockResolvedValue({ ok: true, linhas: 1, id: "m9" });
    const ordem: string[] = [];
    const aoCriar = () => void ordem.push("fechar");
    digitar(render(<NovoMentoradoForm aoCriar={aoCriar} />, ordem).vistos, "novo-nome", "Bruno Novo");
    chamar(prop(render(<NovoMentoradoForm aoCriar={aoCriar} />, ordem).vistos, "button", ehCriar, "onClick"));
    await vi.waitFor(() => expect(ordem).toContain("fechar"));
    expect(ordem).toEqual(["recarregar", "ir /mentorado/m9", "fechar"]);
    expect(toastSucesso.mock.calls).toEqual([["Mentorado criado"]]);
  });

  it("WRITE-03: durante o envio o botão Criar mentorado fica desabilitado e com Spinner", async () => {
    let terminar: (r: ResultadoEscrita) => void = () => undefined;
    criar.mockImplementation(() => new Promise<ResultadoEscrita>((resolve) => (terminar = resolve)));
    digitar(render(<NovoMentoradoForm aoCriar={() => undefined} />).vistos, "novo-nome", "Bruno Novo");
    const livre = render(<NovoMentoradoForm aoCriar={() => undefined} />);
    expect(livre.html).not.toContain('aria-busy="true"');
    chamar(prop(livre.vistos, "button", ehCriar, "onClick"));
    await vi.waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    expect(render(<NovoMentoradoForm aoCriar={() => undefined} />).html).toMatch(/<button[^>]*data-escrita="W14"[^>]*disabled=""[^>]*aria-busy="true"[^>]*><svg[^>]*animate-spin/);
    terminar({ ok: false, erro: "falhou" });
    await vi.waitFor(() => expect(toastErro).toHaveBeenCalledTimes(1));
    expect(render(<NovoMentoradoForm aoCriar={() => undefined} />).html).not.toContain('aria-busy="true"');
  });

  it("WRITE-08: sem criarMentorado o handler do W14 não chama a porta, nem com o nome preenchido; o admin chama", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    criar.mockResolvedValue({ ok: true, linhas: 1, id: "m9" });
    const aoCriar = vi.fn();
    // O mentor tem escreverSessao, a diretoria nenhuma escrita: nenhum dos dois cria mentorado.
    for (const papel of ["mentor", "diretoria"] as const) {
      estado.valores.length = 0;
      erro.mockClear();
      digitar(render(<NovoMentoradoForm aoCriar={aoCriar} />, [], papel).vistos, "novo-nome", "Bruno Novo");
      chamar(prop(render(<NovoMentoradoForm aoCriar={aoCriar} />, [], papel).vistos, "button", ehCriar, "onClick"));
      await vi.waitFor(() => expect(erro, papel).toHaveBeenCalledWith("[central-elite3d] escrita sem capacidade"));
      expect(criar, papel).not.toHaveBeenCalled();
    }
    expect(aoCriar).not.toHaveBeenCalled();

    estado.valores.length = 0;
    digitar(render(<NovoMentoradoForm aoCriar={aoCriar} />).vistos, "novo-nome", "Bruno Novo");
    chamar(prop(render(<NovoMentoradoForm aoCriar={aoCriar} />).vistos, "button", ehCriar, "onClick"));
    await vi.waitFor(() => expect(aoCriar).toHaveBeenCalledTimes(1));
    expect(criar.mock.calls.map(([novo]) => novo.nome)).toEqual(["Bruno Novo"]);
  });

  it("WRITE-09: o botão '+ Novo mentorado' só aparece com criarMentorado, com data-escrita=\"W14\", e abre e fecha o modal", () => {
    for (const papel of ["diretoria", "mentor"] as const) expect(render(<BotaoNovoMentorado />, [], papel).html, papel).toBe("");
    const fechado = render(<BotaoNovoMentorado />);
    expect(fechado.html).toMatch(/<button[^>]*data-escrita="W14"[^>]*>\+ Novo mentorado<\/button>/);
    expect(fechado.html).not.toContain("dialog-falso");
    chamar(prop(fechado.vistos, "button", (p) => p.children === "+ Novo mentorado", "onClick"));
    const aberto = render(<BotaoNovoMentorado />);
    expect(aberto.html).toContain('<dialog-falso data-titulo="Novo mentorado">');
    expect(aberto.html).toContain('id="novo-nome"');
    chamar(prop(aberto.vistos, "dialog", () => true, "onClose"));
    expect(render(<BotaoNovoMentorado />).html).not.toContain("dialog-falso");
  });
});
