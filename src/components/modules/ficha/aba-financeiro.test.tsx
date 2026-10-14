import type { ComponentProps, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, type Navegador, SessaoContexto, type ValorSessao } from "@/components/shell/contexto";
import type { Dataset, Mentorado, Parcela } from "@/lib/data/esquemas";
import type { CadastroMentorado, CamposParcela, FinanceiroMentorado, ResultadoEscrita } from "@/lib/data/escritas";
import { fmtBRL } from "@/lib/moeda";
import type { Capacidade, Papel } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import AbaFinanceiro, { ParcelaForm } from "./aba-financeiro";

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
const salvar = vi.hoisted(() => vi.fn<(id: string, campos: CadastroMentorado | FinanceiroMentorado) => Promise<ResultadoEscrita>>());
const adotar = vi.hoisted(() => vi.fn());
const alternar = vi.hoisted(() => vi.fn<(id: string, status: string | null) => Promise<ResultadoEscrita>>());
const adicionar = vi.hoisted(() => vi.fn<(mentoradoId: string, parcelas: readonly Parcela[], vencimento: string | null, valor: number | null) => Promise<ResultadoEscrita>>());
const editar = vi.hoisted(() => vi.fn<(id: string, campos: CamposParcela) => Promise<ResultadoEscrita>>());
const apagar = vi.hoisted(() => vi.fn<(id: string) => Promise<ResultadoEscrita>>());
vi.mock("@/lib/data/escritas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/escritas")>()),
  salvarMentorado: salvar,
  adotarOrfas: adotar,
  toggleParcela: alternar,
  addParcela: adicionar,
  salvarParcela: editar,
  delParcela: apagar,
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
  const navegar: Navegador = { caminho: "/mentorado/m1/financeiro", ir: (destino) => ordem.push(`ir ${destino}`), substituir: (destino) => ordem.push(`substituir ${destino}`) };
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
const botao = (lista: typeof vistos, escrita: string) => prop(lista, "button", (p) => p["data-escrita"] === escrita, "onClick");
const digitar = (lista: typeof vistos, id: string, valor: string) => chamar(prop(lista, "input", (p) => p.id === id, "onChange"), { target: { value: valor } });
const escolher = (lista: typeof vistos, id: string, valor: string) => chamar(prop(lista, "select", (p) => p.id === id, "onChange"), valor);
const escritas = (lista: typeof vistos) => lista.filter((v) => v.tipo === "button" && v.props["data-escrita"]).map((v) => v.props["data-escrita"]);
const tique = () => new Promise((resolve) => setTimeout(resolve, 0));

const mentorado = (id: string, extra: Partial<Mentorado> = {}): Mentorado => ({ ...(datasetDeTeste().mentorados.find((m) => m.id === id) as Mentorado), ...extra });
const P1 = datasetDeTeste().parcelas[0];

describe("aba Financeiro (OPS-12, OPS-14, OPS-15, FIN-05, UI-05)", () => {
  beforeEach(() => {
    estado.valores.length = 0;
    ordem.length = 0;
    for (const fn of [salvar, adotar, alternar, adicionar, editar, apagar]) fn.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  it("OPS-14: contrato, entrada e restante nulos mostram '— não informado —' selecionado; com valor, a opção não existe", () => {
    const nulos = mentorado("m1", { contrato_status: null, entrada_status: null, restante_status: null });
    const lista = render(<AbaFinanceiro mentorado={nulos} />).vistos;
    for (const id of ["ficha-contrato", "ficha-entrada", "ficha-restante"]) {
      expect(prop(lista, "select", (p) => p.id === id, "value"), id).toBe("");
      expect((prop(lista, "select", (p) => p.id === id, "options") as unknown[])[0], id).toEqual({ value: "", label: "— não informado —" });
    }
    estado.valores.length = 0;
    const preenchido = render(<AbaFinanceiro mentorado={mentorado("m2")} />).vistos;
    expect(["ficha-contrato", "ficha-entrada", "ficha-restante"].map((id) => prop(preenchido, "select", (p) => p.id === id, "value"))).toEqual(["Ainda não", "Pago", "Ainda não"]);
    expect(prop(preenchido, "select", (p) => p.id === "ficha-contrato", "options")).toEqual(
      ["Assinado", "Aguardando assinatura", "Ainda não", "Cancelou"].map((valor) => ({ value: valor, label: valor })),
    );
    // Valor fora da lista continua escolhido, como opção dele mesmo.
    estado.valores.length = 0;
    const fora = render(<AbaFinanceiro mentorado={mentorado("m2", { contrato_status: "Pendente" })} />).vistos;
    expect(prop(fora, "select", (p) => p.id === "ficha-contrato", "value")).toBe("Pendente");
    expect(prop(fora, "select", (p) => p.id === "ficha-contrato", "options")).toContainEqual({ value: "Pendente", label: "Pendente" });
  });

  it("OPS-15: salvar sem mexer num status nulo grava nulo; o que foi escolhido vai com o valor", async () => {
    salvar.mockResolvedValue({ ok: true, linhas: 1 });
    const m = mentorado("m2", { contrato_status: null, entrada_status: "Pago parcial", entrada_forma_pgto: "pix", restante_status: null, restante_forma_pgto: null });
    chamar(botao(render(<AbaFinanceiro mentorado={m} />).vistos, "W11"));
    await vi.waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
    expect(salvar.mock.calls[0]).toEqual([
      "m2",
      { aba: "financeiro", contrato_status: null, entrada_status: "Pago parcial", entrada_forma_pgto: "pix", restante_status: null, restante_forma_pgto: null },
    ]);
    await vi.waitFor(() => expect(toastSucesso.mock.calls).toEqual([["Mentorado atualizado"]]));
    expect(adotar).not.toHaveBeenCalled();

    const lista = render(<AbaFinanceiro mentorado={m} />).vistos;
    escolher(lista, "ficha-restante", "Pago");
    digitar(lista, "ficha-restante-forma", "boleto");
    escolher(lista, "ficha-entrada", "Ainda não");
    chamar(botao(render(<AbaFinanceiro mentorado={m} />).vistos, "W11"));
    await vi.waitFor(() => expect(salvar).toHaveBeenCalledTimes(2));
    expect(salvar.mock.calls[1][1]).toEqual({
      aba: "financeiro",
      contrato_status: null,
      entrada_status: "Ainda não",
      entrada_forma_pgto: "pix",
      restante_status: "Pago",
      restante_forma_pgto: "boleto",
    });
  });

  it("OPS-12: a diretoria vê os status e as parcelas só para leitura, sem controle de escrita nenhum", () => {
    const m = mentorado("m1", { contrato_status: null, entrada_forma_pgto: "pix" });
    const { html, vistos: lista } = render(<AbaFinanceiro mentorado={m} />, { papel: "diretoria" });
    for (const [termo, valor] of [
      ["Contrato", "— não informado —"],
      ["Entrada", "Pago"],
      ["Forma entrada", "pix"],
      ["Restante", "Pago"],
      ["Forma restante", "—"],
    ]) {
      expect(html, termo).toMatch(new RegExp(`<dt[^>]*>${termo}</dt><dd[^>]*>${valor}</dd>`));
    }
    expect(lista.filter((v) => v.tipo === "input" || v.tipo === "select")).toEqual([]);
    expect(escritas(lista)).toEqual([]);
    expect(html).toContain(`#1 ${fmtBRL(500)}`);
    expect(html).not.toContain("+ Adicionar parcela");
  });

  it("FIN-05: parcela da Lia não tem controle, e com alguma da Lia não há 'Adicionar parcela'; a manual alterna, edita e aceita parcela nova", () => {
    const daLia = render(<AbaFinanceiro mentorado={mentorado("m2")} />);
    expect(daLia.html).toContain("Estas parcelas vêm da Lia e se atualizam sozinhas quando o pagamento muda lá. Por isso não são editáveis aqui.");
    expect(escritas(daLia.vistos)).toEqual(["W11"]);
    expect(daLia.html).not.toContain("+ Adicionar parcela");
    expect(daLia.html).toContain('title="Vem da Lia — muda lá, reflete aqui"');

    estado.valores.length = 0;
    const manual = render(<AbaFinanceiro mentorado={mentorado("m1")} />);
    expect(manual.html).not.toContain("vêm da Lia");
    expect(escritas(manual.vistos)).toEqual(["W11", "W18", "W20", "W19"]);
    expect(manual.html).toContain('aria-label="Editar parcela #1"');
    // Uma manual no meio das da Lia continua editável, mas não destrava a parcela nova.
    estado.valores.length = 0;
    const dados = datasetDeTeste();
    dados.parcelas.push({ id: "p9", mentorado_id: "m2", numero: 3, status: "aberta", vencimento: null, valor: null, lia_bill_id: null });
    const misto = render(<AbaFinanceiro mentorado={mentorado("m2")} />, { dados });
    expect(escritas(misto.vistos)).toEqual(["W11", "W18", "W20"]);
  });

  it("o título conta as pagas e anuncia o prazo da próxima; cada azulejo mostra número, valor e situação", () => {
    const { html } = render(<AbaFinanceiro mentorado={mentorado("m2")} />);
    expect(html).toContain(">Parcelas · 1/2 pagas · #2 vence em 3 dias<");
    expect(html).toContain(`#1 ${fmtBRL(800)}`);
    expect(html).toContain(">paga ✓<");
    const p3 = datasetDeTeste().parcelas[2].vencimento ?? "";
    expect(html).toContain(`>${p3.slice(8, 10)}/${p3.slice(5, 7)}<`);
    const vazio = render(<AbaFinanceiro mentorado={mentorado("m3")} />).html;
    expect(vazio).toContain(">Parcelas<");
    expect(vazio).toContain("Sem parcelas (pagamento à vista ou não cadastrado).");
  });

  it("W18: o clique no azulejo alterna a parcela pelo status que a tela mostra, sem toast de sucesso, e recarrega", async () => {
    alternar.mockResolvedValue({ ok: true, linhas: 1 });
    chamar(botao(render(<AbaFinanceiro mentorado={mentorado("m1")} />).vistos, "W18"));
    await vi.waitFor(() => expect(ordem).toEqual(["recarregar"]));
    expect(alternar.mock.calls).toEqual([["p1", "aberta"]]);
    expect(toastSucesso).not.toHaveBeenCalled();
  });

  it("W19: a parcela nova leva o vencimento e o valor lido do campo de moeda, e os campos limpam depois de gravar", async () => {
    adicionar.mockResolvedValue({ ok: true, linhas: 1 });
    const dados = datasetDeTeste();
    const m1 = mentorado("m1");
    const lista = render(<AbaFinanceiro mentorado={m1} />, { dados }).vistos;
    digitar(lista, "nova-parcela-vencimento", "2026-12-10");
    digitar(lista, "nova-parcela-valor", "2000.50");
    const preenchida = render(<AbaFinanceiro mentorado={m1} />, { dados }).vistos;
    expect(prop(preenchida, "input", (p) => p.id === "nova-parcela-valor", "value")).toBe("R$ 2.000,50");
    chamar(botao(preenchida, "W19"));
    await vi.waitFor(() => expect(adicionar).toHaveBeenCalledTimes(1));
    expect(adicionar.mock.calls[0]).toEqual(["m1", dados.parcelas, "2026-12-10", 2000.5]);
    await vi.waitFor(() => expect(prop(render(<AbaFinanceiro mentorado={m1} />, { dados }).vistos, "input", (p) => p.id === "nova-parcela-valor", "value")).toBe(""));
    expect(prop(render(<AbaFinanceiro mentorado={m1} />, { dados }).vistos, "input", (p) => p.id === "nova-parcela-vencimento", "value")).toBe("");

    // Sem nada digitado, vencimento e valor vão nulos; com erro, o que foi digitado fica.
    adicionar.mockResolvedValue({ ok: false, erro: "Limite de 12 parcelas atingido" });
    chamar(botao(render(<AbaFinanceiro mentorado={m1} />, { dados }).vistos, "W19"));
    await vi.waitFor(() => expect(toastErro.mock.calls).toEqual([["Limite de 12 parcelas atingido"]]));
    expect(adicionar.mock.calls[1].slice(2)).toEqual([null, null]);
  });

  it("W20: editar abre o formulário da parcela, que grava número, vencimento, valor da moeda e status", async () => {
    editar.mockResolvedValue({ ok: true, linhas: 1 });
    const m1 = mentorado("m1");
    chamar(prop(render(<AbaFinanceiro mentorado={m1} />).vistos, "button", (p) => p["aria-label"] === "Editar parcela #1", "onClick"));
    const aberto = render(<AbaFinanceiro mentorado={m1} />);
    expect(aberto.html).toContain('<dialog-falso data-titulo="Parcela #1 · Ana Clara">');
    const valores = Object.fromEntries(aberto.vistos.filter((v) => v.tipo === "input" && String(v.props.id).startsWith("parcela-")).map((v) => [v.props.id, v.props.value]));
    expect(valores).toEqual({ "parcela-numero": "1", "parcela-vencimento": "2026-01-01", "parcela-valor": "R$ 500,00" });
    expect(prop(aberto.vistos, "select", (p) => p.id === "parcela-status", "value")).toBe("aberta");
    digitar(aberto.vistos, "parcela-numero", "2");
    digitar(aberto.vistos, "parcela-vencimento", "2026-02-10");
    digitar(aberto.vistos, "parcela-valor", "750");
    escolher(aberto.vistos, "parcela-status", "paga");
    const lista = render(<AbaFinanceiro mentorado={m1} />).vistos;
    chamar(prop(lista, "button", (p) => p["data-escrita"] === "W20" && rotulo(p) === "Salvar parcela", "onClick"));
    await vi.waitFor(() => expect(editar).toHaveBeenCalledTimes(1));
    expect(editar.mock.calls[0]).toEqual(["p1", { numero: 2, vencimento: "2026-02-10", valor: 750, status: "paga" }]);
    await vi.waitFor(() => expect(render(<AbaFinanceiro mentorado={m1} />).html).not.toContain("dialog-falso"));
    expect(toastSucesso.mock.calls).toEqual([["Parcela atualizada"]]);
    expect(ordem).toEqual(["recarregar"]);
  });

  it("o número da parcela é ≥ 1 e único no mentorado: fora disso avisa e não grava", async () => {
    editar.mockResolvedValue({ ok: true, linhas: 1 });
    const dados = datasetDeTeste();
    dados.parcelas.push({ id: "p8", mentorado_id: "m1", numero: 2, status: "aberta", vencimento: null, valor: null, lia_bill_id: null });
    const casos: [string, string][] = [
      ["0", "Número de parcela inválido"],
      ["", "Número de parcela inválido"],
      ["-1", "Número de parcela inválido"],
      ["2", "Já existe a parcela #2 deste mentorado"],
    ];
    for (const [numero, aviso] of casos) {
      estado.valores.length = 0;
      toastErro.mockClear();
      digitar(render(<ParcelaForm parcela={P1} aoTerminar={() => undefined} />, { dados }).vistos, "parcela-numero", numero);
      chamar(prop(render(<ParcelaForm parcela={P1} aoTerminar={() => undefined} />, { dados }).vistos, "button", (p) => rotulo(p) === "Salvar parcela", "onClick"));
      expect(toastErro.mock.calls, numero).toEqual([[aviso]]);
    }
    await tique();
    expect(editar).not.toHaveBeenCalled();
    // O próprio número (e o de outro mentorado) não conta como repetido.
    estado.valores.length = 0;
    const fechar = vi.fn();
    chamar(prop(render(<ParcelaForm parcela={P1} aoTerminar={fechar} />, { dados }).vistos, "button", (p) => rotulo(p) === "Salvar parcela", "onClick"));
    await vi.waitFor(() => expect(fechar).toHaveBeenCalledTimes(1));
    expect(editar.mock.calls[0][1].numero).toBe(1);
  });

  it("UI-05 e W21: excluir pede confirmação num ConfirmDialog e só então apaga a parcela", async () => {
    apagar.mockResolvedValue({ ok: true, linhas: 1 });
    const fechar = vi.fn();
    const inicio = render(<ParcelaForm parcela={P1} aoTerminar={fechar} />);
    expect(inicio.html).not.toContain("dialog-falso");
    chamar(prop(inicio.vistos, "button", (p) => p["data-escrita"] === "W21", "onClick"));
    await tique();
    expect(apagar).not.toHaveBeenCalled();
    const confirmacao = render(<ParcelaForm parcela={P1} aoTerminar={fechar} />);
    expect(confirmacao.html).toContain('<dialog-falso data-titulo="Excluir parcela">');
    expect(confirmacao.html).toContain("Excluir a parcela #1? A ação não pode ser desfeita.");
    chamar(prop(confirmacao.vistos, "button", (p) => rotulo(p) === "Excluir parcela", "onClick"));
    await vi.waitFor(() => expect(fechar).toHaveBeenCalledTimes(1));
    expect(apagar.mock.calls).toEqual([["p1"]]);
    expect(toastSucesso.mock.calls).toEqual([["Parcela excluída"]]);
    expect(render(<ParcelaForm parcela={P1} aoTerminar={fechar} />).html).not.toContain("dialog-falso");
  });

  it("WRITE-08: os status pedem editarMentorado e as parcelas pedem editarFinanceiro; sem a capacidade o handler não chama a porta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    alternar.mockResolvedValue({ ok: true, linhas: 1 });
    adicionar.mockResolvedValue({ ok: true, linhas: 1 });
    salvar.mockResolvedValue({ ok: true, linhas: 1 });
    const m1 = mentorado("m1");

    const parcelas = new Set<Capacidade>(["verFinanceiro", "editarFinanceiro"]);
    const soParcelas = render(<AbaFinanceiro mentorado={m1} />, { caps: parcelas });
    expect(soParcelas.html).toContain("<dl");
    expect(escritas(soParcelas.vistos)).toEqual(["W18", "W20", "W19"]);
    chamar(botao(soParcelas.vistos, "W18"));
    chamar(botao(soParcelas.vistos, "W19"));
    await vi.waitFor(() => expect([alternar.mock.calls.length, adicionar.mock.calls.length]).toEqual([1, 1]));
    parcelas.delete("editarFinanceiro");
    chamar(botao(soParcelas.vistos, "W18"));
    chamar(botao(soParcelas.vistos, "W19"));
    await tique();
    expect([alternar.mock.calls.length, adicionar.mock.calls.length]).toEqual([1, 1]);

    estado.valores.length = 0;
    const status = new Set<Capacidade>(["verFinanceiro", "editarMentorado"]);
    const soStatus = render(<AbaFinanceiro mentorado={m1} />, { caps: status });
    expect(escritas(soStatus.vistos)).toEqual(["W11"]);
    chamar(botao(soStatus.vistos, "W11"));
    await vi.waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
    status.delete("editarMentorado");
    chamar(botao(soStatus.vistos, "W11"));
    await tique();
    expect(salvar).toHaveBeenCalledTimes(1);

    // W20 e W21 também: o formulário da parcela não grava sem editarFinanceiro.
    estado.valores.length = 0;
    const form = render(<ParcelaForm parcela={P1} aoTerminar={() => undefined} />, { caps: new Set<Capacidade>(["verFinanceiro"]) }).vistos;
    chamar(prop(form, "button", (p) => rotulo(p) === "Salvar parcela", "onClick"));
    chamar(prop(form, "button", (p) => p["data-escrita"] === "W21", "onClick"));
    chamar(prop(render(<ParcelaForm parcela={P1} aoTerminar={() => undefined} />, { caps: new Set<Capacidade>(["verFinanceiro"]) }).vistos, "button", (p) => rotulo(p) === "Excluir parcela", "onClick"));
    await tique();
    expect([editar.mock.calls.length, apagar.mock.calls.length]).toEqual([0, 0]);
  });

  it("WRITE-03: Salvar alterações, o azulejo, + Adicionar parcela, Salvar parcela e o confirmar da exclusão travam durante o envio", async () => {
    const pendentes: Array<(r: ResultadoEscrita) => void> = [];
    const esperar = () => new Promise<ResultadoEscrita>((resolve) => pendentes.push(resolve));
    for (const fn of [salvar, alternar, adicionar, editar, apagar]) fn.mockImplementation(esperar);
    const m1 = mentorado("m1");
    const lista = render(<AbaFinanceiro mentorado={m1} />).vistos;
    for (const escrita of ["W11", "W18", "W19"]) chamar(botao(lista, escrita));
    await vi.waitFor(() => expect(pendentes).toHaveLength(3));
    const tela = render(<AbaFinanceiro mentorado={m1} />).html;
    for (const escrita of ["W11", "W18", "W19"]) expect(tela, escrita).toMatch(new RegExp(`<button[^>]*data-escrita="${escrita}"[^>]*disabled=""[^>]*aria-busy="true"`));

    estado.valores.length = 0;
    chamar(prop(render(<ParcelaForm parcela={P1} aoTerminar={() => undefined} />).vistos, "button", (p) => rotulo(p) === "Salvar parcela", "onClick"));
    chamar(prop(render(<ParcelaForm parcela={P1} aoTerminar={() => undefined} />).vistos, "button", (p) => p["data-escrita"] === "W21", "onClick"));
    chamar(prop(render(<ParcelaForm parcela={P1} aoTerminar={() => undefined} />).vistos, "button", (p) => rotulo(p) === "Excluir parcela", "onClick"));
    await vi.waitFor(() => expect(pendentes).toHaveLength(5));
    const form = render(<ParcelaForm parcela={P1} aoTerminar={() => undefined} />).html;
    expect(form).toMatch(/<button[^>]*data-escrita="W20"[^>]*disabled=""[^>]*aria-busy="true"/);
    expect(form).toContain("Excluindo…");
    for (const terminar of pendentes) terminar({ ok: false, erro: "x" });
    await vi.waitFor(() => expect(render(<ParcelaForm parcela={P1} aoTerminar={() => undefined} />).html).not.toContain('aria-busy="true"'));
  });
});
