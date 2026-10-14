import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Button from "@/components/ui/button";
import type { ResultadoEscrita } from "@/lib/data/escritas";
import { type Capacidade, type Papel, pode } from "@/lib/papeis";
import { datasetDeTeste } from "@/test/fixtures";

import { DadosContexto, SessaoContexto, type ValorSessao } from "./contexto";
import { useEscrita } from "./use-escrita";

// Sem DOM, o setState que chega depois do render no servidor não muda nada: o falso guarda o
// estado entre renders, na ordem dos useState, como o React faz no re-render.
const estado = vi.hoisted(() => ({ valores: [] as unknown[], proximo: 0 }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (inicial: unknown) => {
      const i = estado.proximo++;
      if (!(i in estado.valores)) estado.valores[i] = inicial;
      const definir = (valor: unknown) => {
        estado.valores[i] = valor;
      };
      return [estado.valores[i], definir];
    },
  };
});

const toastErro = vi.hoisted(() => vi.fn());
const toastSucesso = vi.hoisted(() => vi.fn());
vi.mock("react-hot-toast", () => ({ default: { error: toastErro, success: toastSucesso } }));

// SEC-06: o usuário da sessão do supabase-js, que o teste troca. A tela é sempre a de "u1".
const sessaoDoCliente = vi.hoisted(() => ({ id: "u1" as string | null }));
vi.mock("@/lib/data/auth", () => ({ usuarioDaSessao: () => Promise.resolve(sessaoDoCliente.id) }));

const visto: { executar?: (id: string) => Promise<boolean> } = {};

// O botão de uma escrita como as telas o ligam: `loading` vem do `ocupado` do hook.
function BotaoConfirmar({ cap, escrever }: { cap: Capacidade; escrever: (id: string) => Promise<ResultadoEscrita> }) {
  const { executar, ocupado } = useEscrita(cap, escrever, "Sessão confirmada");
  visto.executar = executar;
  return (
    <Button loading={ocupado} data-escrita="W04" onClick={() => void executar("s3")}>
      Confirmar
    </Button>
  );
}

function Contextos({ papel, recarregar, children }: { papel: Papel; recarregar(): Promise<void>; children: ReactNode }) {
  const sessao: ValorSessao = {
    usuario: { id: "u1", email: "u1@exemplo.com" },
    perfil: { id: "u1", role: papel, nome: "U1", email: "u1@exemplo.com" },
    papel,
    pode: (cap) => pode(papel, cap),
    sair: () => Promise.resolve(),
  };
  return (
    <SessaoContexto.Provider value={sessao}>
      <DadosContexto.Provider value={{ dados: datasetDeTeste(), erros: {}, recarregando: false, recarregar }}>{children}</DadosContexto.Provider>
    </SessaoContexto.Provider>
  );
}

// Um render, ou um re-render: o estado do hook continua o do render anterior.
function render(papel: Papel, escrever: (id: string) => Promise<ResultadoEscrita>, recarregar: () => Promise<void> = () => Promise.resolve(), cap: Capacidade = "escreverSessao") {
  estado.proximo = 0;
  return renderToStaticMarkup(
    <Contextos papel={papel} recarregar={recarregar}>
      <BotaoConfirmar cap={cap} escrever={escrever} />
    </Contextos>,
  );
}

// O `executar` do último render, como o onClick do botão o recebe.
function executarDoRender(): (id: string) => Promise<boolean> {
  if (!visto.executar) throw new Error("o botão não montou");
  return visto.executar;
}
const clicar = (id: string) => executarDoRender()(id);

const CARREGANDO = /<button[^>]*disabled=""[^>]*aria-busy="true"[^>]*><svg[^>]*animate-spin/;

describe("hook de escrita (WRITE-03, WRITE-04, WRITE-08, SEC-06)", () => {
  beforeEach(() => {
    estado.valores.length = 0;
    sessaoDoCliente.id = "u1";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    toastErro.mockClear();
    toastSucesso.mockClear();
  });

  it("WRITE-03: `ocupado` é true do clique até o fim da escrita e vai para o `loading` do Button, que fica desabilitado e com Spinner", async () => {
    let terminar: (r: ResultadoEscrita) => void = () => undefined;
    const escrever = vi.fn((_id: string) => new Promise<ResultadoEscrita>((resolve) => (terminar = resolve)));
    const recarregar = vi.fn(() => Promise.resolve());
    const livre = render("admin", escrever, recarregar);
    expect(livre).not.toContain('disabled=""');
    expect(livre).not.toContain("aria-busy");

    // WRITE-04: dois cliques no mesmo tick, antes de o React desenhar de novo, chegam ao mesmo onClick.
    const executar = executarDoRender();
    const clique = executar("s3");
    const segundo = executar("s3");
    expect(render("admin", escrever, recarregar)).toMatch(CARREGANDO);
    // O segundo não grava nem solta o botão da escrita em curso.
    expect(await segundo).toBe(false);
    expect(render("admin", escrever, recarregar)).toMatch(CARREGANDO);

    await vi.waitFor(() => expect(escrever).toHaveBeenCalledWith("s3"));
    terminar({ ok: true, linhas: 1 });
    expect(await clique).toBe(true);
    expect(escrever).toHaveBeenCalledTimes(1);
    const depois = render("admin", escrever, recarregar);
    expect(depois).not.toContain('disabled=""');
    expect(depois).not.toContain("aria-busy");
    // O executor está ligado ao toast e à recarga da tela.
    expect(toastSucesso.mock.calls).toEqual([["Sessão confirmada"]]);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("WRITE-08 e SEC-06: a capacidade vem do papel da sessão, e a escrita só sai com a sessão do usuário da tela", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const escrever = vi.fn((_id: string) => Promise.resolve<ResultadoEscrita>({ ok: false, erro: "permission denied for table sessoes" }));

    // A diretoria não tem `escreverSessao`: nada sai.
    render("diretoria", escrever);
    expect(await clicar("s3")).toBe(false);
    expect(escrever).not.toHaveBeenCalled();

    // O mentor tem: a escrita sai, e o erro dela vai para o toast de erro.
    render("mentor", escrever);
    expect(await clicar("s3")).toBe(false);
    expect(escrever.mock.calls).toEqual([["s3"]]);
    expect(toastErro.mock.calls).toEqual([["permission denied for table sessoes"]]);

    // Com o login de outra pessoa em outra aba, o mentor da tela não grava mais.
    sessaoDoCliente.id = "u2";
    render("mentor", escrever);
    expect(await clicar("s3")).toBe(false);
    expect(escrever).toHaveBeenCalledTimes(1);
  });

  it("W14: o `depois` passado ao hook recebe o resultado do sucesso, com o id, depois da recarga da tela", async () => {
    const ordem: unknown[][] = [];
    function BotaoCriar() {
      const { executar } = useEscrita(
        "criarMentorado",
        (_id: string) => Promise.resolve<ResultadoEscrita>({ ok: true, linhas: 1, id: "m9" }),
        "Mentorado criado",
        (gravado) => ordem.push(["depois", gravado]),
      );
      visto.executar = executar;
      return null;
    }
    estado.proximo = 0;
    renderToStaticMarkup(
      <Contextos papel="admin" recarregar={async () => void ordem.push(["recarregar"])}>
        <BotaoCriar />
      </Contextos>,
    );
    expect(await clicar("x")).toBe(true);
    expect(ordem).toEqual([["recarregar"], ["depois", { ok: true, linhas: 1, id: "m9" }]]);
    expect(toastSucesso.mock.calls).toEqual([["Mentorado criado"]]);
  });

  it("WRITE-08: a capacidade que a escrita pede é a que chega ao executor: sem ela o mentor não chama a porta, e o admin chama", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // As capacidades de escrita do admin que o mentor não tem (src/lib/papeis.ts).
    for (const cap of ["criarMentorado", "editarMentorado", "editarFinanceiro", "criarSessao", "excluir"] as const) {
      const escrever = vi.fn((_id: string) => Promise.resolve<ResultadoEscrita>({ ok: true, linhas: 1 }));
      render("mentor", escrever, undefined, cap);
      expect(await clicar("m1"), cap).toBe(false);
      expect(escrever, cap).not.toHaveBeenCalled();

      render("admin", escrever, undefined, cap);
      expect(await clicar("m1"), cap).toBe(true);
      expect(escrever.mock.calls, cap).toEqual([["m1"]]);
    }
  });
});
