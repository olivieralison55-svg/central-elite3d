import type { ComponentProps, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DadosContexto, type Navegador, SessaoContexto, UI_INICIAL, type Ui, UiContexto, type ValorSessao } from "@/components/shell/contexto";
import type { Cobranca, Dataset, Parcela, Relacao } from "@/lib/data/esquemas";
import type { ResultadoEscrita } from "@/lib/data/escritas";
import type { Capacidade, Papel } from "@/lib/papeis";
import { datasetDeTeste, XSS } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Financeiro from "./financeiro";

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
const vincular = vi.hoisted(() => vi.fn<(billId: string, mentoradoId: string) => Promise<ResultadoEscrita>>());
const descartar = vi.hoisted(() => vi.fn<(billId: string, dono: string | null) => Promise<ResultadoEscrita>>());
const restaurar = vi.hoisted(() => vi.fn<(billId: string, dono: string | null) => Promise<ResultadoEscrita>>());
vi.mock("@/lib/data/escritas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/escritas")>()),
  vincularCobranca: vincular,
  descartarCobranca: descartar,
  restaurarCobranca: restaurar,
}));

// O Button e o SearchInput anotam as props e desenham o de verdade; o Dialog, que devolve null sem
// `document`, some (o corpo do novo mentorado tem teste próprio).
const vistos = vi.hoisted(() => [] as Array<{ tipo: string; props: Record<string, unknown> }>);
const gravar = vi.hoisted(() => (tipo: string, props: object) => vistos.push({ tipo, props: { ...props } as Record<string, unknown> }));
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("button", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/search-input", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/search-input")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (gravar("busca", props), createElement(original.default, props)) };
});
vi.mock("@/components/ui/dialog", () => ({ default: (props: { open: boolean; children: ReactNode }) => (props.open ? props.children : null) }));

function sessaoCom(caps: Set<Capacidade>, papel: Papel): ValorSessao {
  const usuario = { id: `usuario-${papel}`, email: `${papel}@exemplo.com` };
  return { usuario, perfil: { id: usuario.id, role: papel, nome: papel, email: usuario.email }, papel, pode: (cap) => caps.has(cap), sair: () => Promise.resolve() };
}

let ui: Ui;
const mudancas: Array<Partial<Ui>> = [];

function render(el: ReactElement, { papel = "admin", caps, dados = datasetDeTeste(), erros = {} }: { papel?: Papel; caps?: Set<Capacidade>; dados?: Dataset; erros?: Partial<Record<Relacao, string>> } = {}) {
  estado.proximo = 0;
  vistos.length = 0;
  sessaoDoCliente.id = `usuario-${papel}`;
  const navegar: Navegador = { caminho: "/financeiro", ir: (destino) => ordem.push(`ir ${destino}`), substituir: (destino) => ordem.push(`substituir ${destino}`) };
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
const tela = (opcoes: Parameters<typeof render>[1] = {}) => render(<Financeiro />, opcoes);

type Lista = ReturnType<typeof tela>["vistos"];
const chamar = (fn: unknown, ...args: unknown[]) => {
  if (typeof fn !== "function") throw new Error("handler ausente");
  return fn(...args);
};
const botoes = (lista: Lista, escrita: string) => lista.filter((v) => v.tipo === "button" && v.props["data-escrita"] === escrita);
const escritas = (lista: Lista) => lista.filter((v) => v.tipo === "button" && v.props["data-escrita"]).map((v) => v.props["data-escrita"]);
const tique = () => new Promise((resolve) => setTimeout(resolve, 0));
// O texto de um trecho do HTML, sem tags e com o espaço fixo da moeda virando espaço comum.
// O regex pula o `>` que mora dentro de um atributo entre aspas (classes do Tailwind como `[&>td]`).
const texto = (html: string) => html.replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, " ").replace(/\s+/g, " ");
// O HTML de um painel: do título até o fim da primeira tabela depois dele (ou até o fim da tela).
const painel = (html: string, titulo: string) => {
  const inicio = html.indexOf(titulo);
  expect(inicio, titulo).toBeGreaterThan(-1);
  const fim = html.indexOf("</table>", inicio);
  return fim < 0 ? html.slice(inicio) : html.slice(inicio, fim + "</table>".length);
};
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

const cobranca = (billId: string, extra: Partial<Cobranca>): Cobranca => ({ lia_bill_id: billId, mentorado_id: null, status: "paid", amount_cents: 10000, due_date: "2026-09-01", contact_email: null, ignorada: false, ...extra });
const parcela = (id: string, extra: Partial<Parcela>): Parcela => ({ id, mentorado_id: "m1", numero: 1, status: "aberta", vencimento: null, valor: 100, lia_bill_id: null, ...extra });

describe("tela Financeiro (FIN-01 a FIN-04, WRITE-03, WRITE-07, DATA-07)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T15:00:00Z"));
    estado.valores.length = 0;
    ordem.length = 0;
    mudancas.length = 0;
    ui = { ...UI_INICIAL };
    for (const fn of [vincular, descartar, restaurar]) fn.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  it("os cards somam a operação: parcelas vencidas, restante em aberto e parcial, contratos assinados do total e os pendentes", () => {
    const dados = datasetDeTeste();
    dados.mentorados[0] = { ...dados.mentorados[0], restante_status: "Pago parcial" };
    const t = texto(tela({ dados }).html);
    expect(t).toContain("Parcelas vencidas 1 requerem cobrança");
    expect(t).toContain("Restante em aberto 1 + 1 pagos parcialmente");
    expect(t).toContain("Contratos assinados 2/3 1 pendentes");
    // O pausado (m4) não entra em nada.
    expect(t).not.toContain("Carla");
  });

  it("FIN-01: uma busca que não casa ninguém esconde só as tabelas de mentorado: os cards, as órfãs e as descartadas ficam inteiros", () => {
    ui = { ...ui, filtro: { ...ui.filtro, qFin: "zzz" } };
    const { html } = tela();
    const t = texto(html);
    expect(t).toContain("Parcelas vencidas 1 requerem cobrança");
    expect(t).toContain("Contratos assinados 2/3 1 pendentes");
    for (const frase of ["Nenhuma das 1 parcelas vencidas casa com a busca.", "Nenhum vencimento futuro para essa busca.", "Nenhum mentorado ativo encontrado para essa busca.", "Situação por mentorado · 0 de 3", "Busca: “zzz” · 0 de 3 mentorado(s) · cards e cobranças da Lia continuam inteiros"]) {
      expect(t, frase).toContain(frase);
    }
    expect(html).not.toContain("Bruno Dias</a>");
    // As duas órfãs, com o motivo, e a descartada, com o valor.
    const orfas = painel(html, "Cobranças da Lia sem mentorado identificado");
    expect(texto(orfas)).toContain("bruno@exemplo.com");
    expect(texto(orfas)).toContain("a cobrança veio sem e-mail");
    expect(texto(orfas)).toContain("R$ 1.500,00");
    expect(texto(orfas)).toContain("R$ 900,00");
    expect(texto(painel(html, "Cobranças descartadas"))).toContain("teste@exemplo.com");
    expect(escritas(tela().vistos)).toEqual(["W14", "W15", "W16", "W16", "W17"]);
  });

  it("FIN-01: a busca pelo nome recorta a situação, os vencidos e os próximos, e não toca as órfãs (nem a que tem o e-mail dele)", () => {
    ui = { ...ui, filtro: { ...ui.filtro, qFin: "bruno" } };
    const { html } = tela();
    const t = texto(html);
    expect(t).toContain("Situação por mentorado · 1 de 3");
    expect(t).toContain("Busca: “bruno” · 1 de 3 mentorado(s)");
    // Ana é a única com parcela vencida, e a busca "bruno" a tira da lista, mas o card segue em 1.
    expect(t).toContain("Nenhuma das 1 parcelas vencidas casa com a busca.");
    expect(t).toContain("Parcelas vencidas 1 requerem cobrança");
    expect(painel(html, "Próximos vencimentos")).toContain("Bruno Dias");
    expect(texto(painel(html, "Cobranças da Lia sem mentorado identificado"))).toContain("a cobrança veio sem e-mail");
    // Digitar guarda o termo sem mexer nos outros filtros; limpar volta a vazio.
    chamar(tela().vistos.find((v) => v.tipo === "busca")?.props.onChange, { target: { value: "ana" } });
    expect(mudancas).toEqual([{ filtro: { ...ui.filtro, qFin: "ana" } }]);
  });

  it("as parcelas vencidas listam mentorado, número e a data com o selo; os próximos vencimentos, os 10 mais perto a partir de hoje, só de ativos", () => {
    const dados = datasetDeTeste();
    // 12 a vencer em datas diferentes, do mais perto ao mais longe, mais uma de pausado e uma paga.
    for (let i = 0; i < 12; i++) dados.parcelas.push(parcela(`f${i}`, { mentorado_id: "m1", numero: 10 + i, vencimento: emDias(10 + i) }));
    dados.parcelas.push(parcela("pausado", { mentorado_id: "m4", numero: 1, vencimento: emDias(1) }), parcela("paga", { status: "paga", numero: 2, vencimento: emDias(2) }));
    const { html } = tela({ dados });
    const vencidas = texto(painel(html, "Cobranças com parcela vencida"));
    expect(vencidas).toContain("Ana Clara #1 01/01/2026 Vencida");
    const proximos = painel(html, "Próximos vencimentos");
    const parcelas = [...proximos.matchAll(/>#(\d+)</g)].map((m) => Number(m[1]));
    // p3 (#2, em 3 dias) primeiro, depois #10 a #18: 10 linhas, sem a do pausado nem a paga.
    expect(parcelas).toEqual([2, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(proximos).not.toContain("Carla");
  });

  it("sem parcela vencida ou sem vencimento futuro, a tabela diz isso, e sem busca a mensagem não fala de busca", () => {
    const dados = datasetDeTeste();
    dados.parcelas = [];
    const t = texto(tela({ dados }).html);
    expect(t).toContain("Nenhuma parcela vencida.");
    expect(t).toContain("Sem vencimentos futuros cadastrados.");
    expect(t).not.toContain("casa com a busca");
  });

  it("a situação por mentorado traz contrato, entrada, restante, as formas e as parcelas pagas; o nome com HTML sai escapado", () => {
    const dados = datasetDeTeste();
    dados.mentorados[1] = { ...dados.mentorados[1], entrada_status: "Pago parcial", restante_status: "Patrocinado", entrada_forma_pgto: "pix", restante_forma_pgto: null, contrato_status: "Aguardando assinatura" };
    dados.mentorados[2] = { ...dados.mentorados[2], contrato_status: null, entrada_status: "Cancelou", restante_status: "Qualquer coisa" };
    const { html } = tela({ dados });
    const situacao = painel(html, "Situação por mentorado");
    const linhas = situacao.split("<tr").slice(2).map(texto);
    expect(linhas[0]).toContain("Ana Clara Assinado Pago —");
    expect(linhas[0]).toContain("0/1");
    expect(linhas[1]).toContain("Bruno Dias Aguardando Parcial pix Patrocinado — 1/2");
    // Sem contrato "Pendente", entrada que cancelou, status que o banco inventou aparece cru, sem parcela "—".
    expect(linhas[2]).toContain("Pendente Cancelou — Qualquer coisa — —");
    expect(html).not.toContain("<img");
    expect(html).toContain("Diego &quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    // Sem status nenhum: "Em aberto".
    dados.mentorados[0] = { ...dados.mentorados[0], entrada_status: null };
    expect(texto(painel(tela({ dados }).html, "Situação por mentorado"))).toContain("Assinado Em aberto");
  });

  it("a ordem escolhida em cada tabela vale: parcelas pagas (maior primeiro) na situação e mentorado (Z a A) nos próximos", () => {
    ui = { ...ui, sortState: { fin_situacao: { coluna: "parcelas", direcao: "desc" }, fin_proxvenc: { coluna: "mentorado", direcao: "desc" } } };
    const dados = datasetDeTeste();
    dados.parcelas.push(parcela("q", { mentorado_id: "m1", numero: 5, vencimento: emDias(20) }));
    const { html } = tela({ dados });
    const nomes = [...painel(html, "Situação por mentorado").matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);
    expect(nomes.slice(0, 2)).toEqual(["Bruno Dias", "Ana Clara"]);
    expect([...painel(html, "Próximos vencimentos").matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1]).slice(0, 2)).toEqual(["Bruno Dias", "Ana Clara"]);
    ui = { ...ui, sortState: {} };
    expect([...painel(tela({ dados }).html, "Situação por mentorado").matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1]).slice(0, 2)).toEqual(["Ana Clara", "Bruno Dias"]);
  });

  it("FIN-02: 'vincular' só quando há exatamente 1 cadastro com o e-mail, comparado em minúsculas; com 0, com 2 ou sem e-mail, só descartar", () => {
    const dados = datasetDeTeste();
    dados.cobrancas = [
      cobranca("um", { contact_email: "BRUNO@Exemplo.COM" }),
      cobranca("zero", { contact_email: "ninguem@exemplo.com" }),
      cobranca("dois", { contact_email: "dupla@exemplo.com" }),
      cobranca("sem", { contact_email: null }),
    ];
    dados.mentorados.push({ ...dados.mentorados[0], id: "m7", nome: "Dupla Um", email: "dupla@exemplo.com" }, { ...dados.mentorados[0], id: "m8", nome: "Dupla Dois", email: "Dupla@exemplo.com" });
    const { html, vistos: lista } = tela({ dados });
    expect(botoes(lista, "W15")).toHaveLength(1);
    expect(botoes(lista, "W15")[0].props.children).toBe("vincular a Bruno Dias");
    expect(botoes(lista, "W16")).toHaveLength(4);
    expect(html.match(/vincular a /g)).toHaveLength(1);
  });

  it("FIN-03: o motivo de cada órfã é calculado na hora — sem e-mail, e-mail em dois cadastros, cadastro existe e nenhum cadastro", () => {
    const dados = datasetDeTeste();
    dados.cobrancas = [
      cobranca("a", { contact_email: null }),
      cobranca("b", { contact_email: "dupla@exemplo.com" }),
      cobranca("c", { contact_email: "bruno@exemplo.com" }),
      cobranca("d", { contact_email: "ninguem@exemplo.com" }),
    ];
    dados.mentorados.push({ ...dados.mentorados[0], id: "m7", email: "dupla@exemplo.com" }, { ...dados.mentorados[0], id: "m8", email: "dupla@exemplo.com" });
    const linhas = painel(tela({ dados }).html, "Cobranças da Lia sem mentorado identificado").split("<tr").slice(2).map(texto);
    expect(linhas[0]).toContain("a cobrança veio sem e-mail");
    expect(linhas[1]).toContain("esse e-mail está em mais de um cadastro");
    expect(linhas[2]).toContain("o cadastro existe — clique em vincular");
    expect(linhas[3]).toContain("nenhum cadastro com esse e-mail");
  });

  it("a órfã mostra vencimento, e-mail, valor em reais (centavos / 100) e o status da Lia; vazio vira travessão e status desconhecido sai cru", () => {
    const dados = datasetDeTeste();
    dados.cobrancas = [
      cobranca("x1", { due_date: "2026-09-20", contact_email: "um@exemplo.com", amount_cents: 123456, status: "pending" }),
      cobranca("x2", { due_date: null, contact_email: null, amount_cents: 0, status: "refunded" }),
      cobranca("x3", { status: "canceled" }), // cancelada não é órfã
      cobranca("x4", { contact_email: XSS, status: "overdue", amount_cents: 99 }),
    ];
    const { html } = tela({ dados });
    const linhas = painel(html, "Cobranças da Lia sem mentorado identificado").split("<tr").slice(2).map(texto);
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toContain("20/09/2026 um@exemplo.com R$ 1.234,56 Em aberto");
    expect(linhas[1]).toContain("— — R$ 0,00 refunded");
    expect(linhas[2]).toContain("R$ 0,99 Atrasada");
    expect(html).not.toContain("<img");
    expect(html).toContain("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
  });

  it("sem órfã e sem descartada os dois painéis não aparecem", () => {
    const dados = datasetDeTeste();
    dados.cobrancas = [cobranca("ok", { mentorado_id: "m1" })];
    const { html } = tela({ dados });
    expect(html).not.toContain("Cobranças da Lia sem mentorado identificado");
    expect(html).not.toContain("Cobranças descartadas");
    expect(html).not.toContain('id="cobrancas-orfas"');
    expect(html).toContain("Situação por mentorado");
  });

  it("W15: vincular grava a cobrança àquele mentorado pelo id da Lia, avisa 'Cobrança vinculada a <nome>' e recarrega", async () => {
    vincular.mockResolvedValue({ ok: true, linhas: 1 });
    chamar(botoes(tela().vistos, "W15")[0].props.onClick);
    await vi.waitFor(() => expect(vincular).toHaveBeenCalledTimes(1));
    expect(vincular.mock.calls).toEqual([["orf1", "m2"]]);
    await vi.waitFor(() => expect(toastSucesso.mock.calls).toEqual([["Cobrança vinculada a Bruno Dias"]]));
    expect(ordem).toEqual(["recarregar"]);
    expect(descartar).not.toHaveBeenCalled();
  });

  it("W16: descartar grava a cobrança daquela linha (a segunda órfã, não a primeira), com o dono nulo da órfã, e avisa", async () => {
    descartar.mockResolvedValue({ ok: true, linhas: 1 });
    chamar(botoes(tela().vistos, "W16")[1].props.onClick);
    await vi.waitFor(() => expect(descartar).toHaveBeenCalledTimes(1));
    expect(descartar.mock.calls).toEqual([["orf2", null]]);
    await vi.waitFor(() => expect(toastSucesso.mock.calls).toEqual([["Cobrança descartada"]]));
    expect(ordem).toEqual(["recarregar"]);
  });

  it("W17: restaurar grava a descartada com o dono dela (nulo ou o mentorado), avisa e recarrega", async () => {
    restaurar.mockResolvedValue({ ok: true, linhas: 1 });
    chamar(botoes(tela().vistos, "W17")[0].props.onClick);
    await vi.waitFor(() => expect(restaurar).toHaveBeenCalledTimes(1));
    expect(restaurar.mock.calls[0]).toEqual(["desc1", null]);
    await vi.waitFor(() => expect(toastSucesso.mock.calls).toEqual([["Cobrança restaurada"]]));
    const comDono = datasetDeTeste();
    comDono.cobrancas = [cobranca("desc9", { ignorada: true, mentorado_id: "m1" })];
    chamar(botoes(tela({ dados: comDono }).vistos, "W17")[0].props.onClick);
    await vi.waitFor(() => expect(restaurar).toHaveBeenCalledTimes(2));
    expect(restaurar.mock.calls[1]).toEqual(["desc9", "m1"]);
  });

  it("WRITE-07: a falha do reflexo vira toast de erro, sem toast de sucesso, e a tela recarrega e segue; o erro da escrita também fica no toast", async () => {
    const aviso = "rpc lia_refletir_financeiro: timeout";
    for (const fn of [vincular, descartar, restaurar]) fn.mockResolvedValue({ ok: true, linhas: 1, aviso });
    const lista = tela().vistos;
    for (const escrita of ["W15", "W16", "W17"]) chamar(botoes(lista, escrita)[0].props.onClick);
    await vi.waitFor(() => expect(toastErro.mock.calls).toEqual([[aviso], [aviso], [aviso]]));
    expect(toastSucesso).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(ordem).toEqual(["recarregar", "recarregar", "recarregar"]));
    expect(tela().html).toContain("Situação por mentorado");
    for (const fn of [vincular, descartar, restaurar]) fn.mockResolvedValue({ ok: false, erro: "permission denied" });
    toastErro.mockClear();
    for (const escrita of ["W15", "W16", "W17"]) chamar(botoes(lista, escrita)[0].props.onClick);
    await vi.waitFor(() => expect(toastErro).toHaveBeenCalledTimes(3));
    expect(new Set(toastErro.mock.calls.map((c) => c[0]))).toEqual(new Set(["permission denied"]));
  });

  it("WRITE-03: vincular, descartar e restaurar travam durante o envio, e o segundo clique no mesmo botão não envia outra", async () => {
    const pendentes: Array<(r: ResultadoEscrita) => void> = [];
    const esperar = () => new Promise<ResultadoEscrita>((resolve) => pendentes.push(resolve));
    for (const fn of [vincular, descartar, restaurar]) fn.mockImplementation(esperar);
    const lista = tela().vistos;
    const w15 = botoes(lista, "W15")[0].props.onClick;
    chamar(w15);
    chamar(w15);
    for (const escrita of ["W16", "W17"]) chamar(botoes(lista, escrita)[0].props.onClick);
    await vi.waitFor(() => expect(pendentes).toHaveLength(3));
    expect([vincular, descartar, restaurar].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    const html = tela().html;
    for (const escrita of ["W15", "W16", "W17"]) expect(html, escrita).toMatch(new RegExp(`<button[^>]*data-escrita="${escrita}"[^>]*disabled=""[^>]*aria-busy="true"`));
    // A outra órfã continua livre.
    expect(html.match(/aria-busy="true"/g)).toHaveLength(3);
    for (const terminar of pendentes) terminar({ ok: false, erro: "x" });
    await vi.waitFor(() => expect(tela().html).not.toContain('aria-busy="true"'));
  });

  it("DATA-07: a falha da leitura das cobranças da Lia põe o erro só nos painéis de órfãs e descartadas; cards e tabelas seguem", () => {
    const { html, vistos: lista } = tela({ erros: { lia_cobrancas: "permission denied" } });
    const orfas = painel(html, "Cobranças da Lia sem mentorado identificado");
    const descartadas = painel(html, "Cobranças descartadas");
    for (const p of [orfas, descartadas]) {
      expect(texto(p)).toContain("Não foi possível carregar as cobranças da Lia");
      expect(texto(p)).toContain("lia_cobrancas: permission denied");
    }
    // Sem a leitura, nenhuma linha e nenhuma ação sobre cobrança.
    expect(escritas(lista)).toEqual(["W14"]);
    expect(html).not.toContain("bruno@exemplo.com</span>");
    expect(html).not.toContain("R$ 1.500,00");
    // O resto da tela: nada de erro nem de aviso no topo, e os cards e as tabelas inteiros.
    expect(html).not.toContain("Parte dos dados não carregou");
    expect(html).not.toContain("Não foi possível carregar esta tela");
    const t = texto(html);
    expect(t).toContain("Parcelas vencidas 1 requerem cobrança");
    expect(t).toContain("Contratos assinados 2/3 1 pendentes");
    expect(t).toContain("Ana Clara");
    expect(t).toContain("Bruno Dias");
    expect(t.match(/Não foi possível carregar as cobranças da Lia/g)).toHaveLength(2);
  });

  it("DATA-07: com a leitura da Lia em falha e nenhuma cobrança carregada, os dois painéis ainda mostram o erro, e não 'sem órfãs'", () => {
    // O caso real: a leitura que falhou não trouxe linha nenhuma.
    const dados = datasetDeTeste();
    dados.cobrancas = [];
    const html = tela({ dados, erros: { lia_cobrancas: "permission denied" } }).html;
    expect(texto(html).match(/Não foi possível carregar as cobranças da Lia/g)).toHaveLength(2);
    for (const titulo of ["Cobranças da Lia sem mentorado identificado", "Cobranças descartadas"]) {
      expect(texto(painel(html, titulo)), titulo).toContain("lia_cobrancas: permission denied");
    }
  });

  it("DATA-07: sem erro nenhum não há aviso, e o erro de outra relação não vira aviso aqui", () => {
    expect(tela().html).not.toContain("Não foi possível carregar as cobranças");
    expect(tela({ erros: { nps_respostas: "x" } }).html).not.toContain("Não foi possível carregar as cobranças");
  });

  it("a diretoria vê tudo, inclusive o motivo de cada órfã, mas sem controle de escrita; o admin tem criar, vincular, descartar e restaurar", () => {
    const { html, vistos: lista } = tela({ papel: "diretoria" });
    expect(escritas(lista)).toEqual([]);
    expect(html).not.toMatch(/vincular a|descartar<|restaurar<|Novo mentorado/);
    expect(texto(html)).toContain("o cadastro existe — clique em vincular");
    expect(texto(painel(html, "Cobranças descartadas"))).toContain("teste@exemplo.com");
    // O cabeçalho da coluna de ações some junto com ela.
    expect(painel(html, "Cobranças da Lia sem mentorado identificado").split("</thead>")[0].match(/<th[ >]/g)).toHaveLength(5);
    estado.valores.length = 0;
    expect(escritas(tela({ papel: "admin" }).vistos)).toEqual(["W14", "W15", "W16", "W16", "W17"]);
  });

  it("WRITE-08: sem editarFinanceiro o handler não chama a porta, e o botão de novo mentorado pede criarMentorado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const fn of [vincular, descartar, restaurar]) fn.mockResolvedValue({ ok: true, linhas: 1 });
    const caps = new Set<Capacidade>(["verFinanceiro", "editarFinanceiro"]);
    const lista = tela({ caps }).vistos;
    expect(escritas(lista)).toEqual(["W15", "W16", "W16", "W17"]);
    const todos = ["W15", "W16", "W17"].map((e) => botoes(lista, e)[0].props.onClick);
    for (const h of todos) chamar(h);
    await vi.waitFor(() => expect([vincular, descartar, restaurar].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]));
    caps.delete("editarFinanceiro");
    for (const h of todos) chamar(h);
    await tique();
    expect([vincular, descartar, restaurar].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    // Com criarMentorado, o botão aparece no cabeçalho.
    estado.valores.length = 0;
    expect(escritas(tela({ caps: new Set<Capacidade>(["verFinanceiro", "criarMentorado"]) }).vistos)).toEqual(["W14"]);
  });
});
