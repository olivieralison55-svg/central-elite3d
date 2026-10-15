import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Button from "@/components/ui/button";
import type { ErrosDeCarga } from "@/lib/data/esquemas";
import type { Carga } from "@/lib/data/leituras";
import type { Papel } from "@/lib/papeis";
import { criarRecarga } from "@/lib/recarga";
import { datasetDeTeste } from "@/test/fixtures";

import Casca, { Moldura } from "./casca";
import { DadosContexto, SessaoContexto, useDados, type ValorDados, type ValorSessao } from "./contexto";
import {
  AvisoRelacoes,
  type CargaPronta,
  DadosDoUsuario,
  DadosProvider,
  type EstadoDados,
  PORTA_DADOS,
  type PortaDados,
  PortaoDados,
  recarregarDados,
} from "./dados";
import { Carregando } from "./sessao";

// Sem DOM, o React não roda efeito: o falso só guarda cada useEffect (função e deps) do render. E o
// setState que chega depois do render no servidor não muda nada: o falso anota cada atualização,
// para o teste aplicá-las em ordem.
const efeitos = vi.hoisted(() => [] as Array<{ fn: () => unknown; deps?: readonly unknown[] }>);
const atualizacoes = vi.hoisted(() => [] as unknown[]);
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useEffect: (fn: () => unknown, deps?: readonly unknown[]) => {
      efeitos.push({ fn, deps });
    },
    useState: (inicial: unknown) => {
      const [valor, definir] = react.useState(inicial);
      const anotar = (atualizacao: unknown) => {
        atualizacoes.push(atualizacao);
        definir(atualizacao);
      };
      return [valor, anotar];
    },
  };
});

const toastErro = vi.hoisted(() => vi.fn());
vi.mock("react-hot-toast", () => ({ default: { error: toastErro } }));

// A carga de verdade sai pelo supabase-js: aqui só se anota com que papel e usuário ela foi pedida.
const carregarTudo = vi.hoisted(() => vi.fn<(papel: Papel, usuarioId: string) => Promise<Carga>>());
vi.mock("@/lib/data/leituras", () => ({ carregarTudo }));
// SEC-06: outra pessoa entrou em outra aba, e a sessão do supabase-js é a dela.
vi.mock("@/lib/data/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/auth")>()),
  usuarioDaSessao: () => Promise.resolve("u2"),
}));

type Elemento = ReactElement<Record<string, unknown>>;
function elementos(no: unknown): Elemento[] {
  if (Array.isArray(no)) return no.flatMap(elementos);
  if (!isValidElement<Record<string, unknown>>(no)) return [];
  return [no, ...Object.values(no.props).flatMap(elementos)];
}

// Clica no único Button com esse rótulo na árvore de elementos.
function clicar(arvore: unknown, rotulo: string) {
  const botoes = elementos(arvore).filter((el) => el.type === Button && el.props.children === rotulo);
  expect(botoes, rotulo).toHaveLength(1);
  const onClick = botoes[0].props.onClick;
  if (typeof onClick !== "function") throw new Error(`${rotulo} sem onClick`);
  onClick();
}

// Chama um componente com hooks dentro do render de outro e devolve o elemento que ele monta.
function montado(chamar: () => ReactElement, envolver: (filho: ReactElement) => ReactElement = (filho) => filho): Elemento {
  const visto: { el?: ReactElement } = {};
  function Sonda() {
    visto.el = chamar();
    return null;
  }
  renderToStaticMarkup(envolver(<Sonda />));
  if (!isValidElement<Record<string, unknown>>(visto.el)) throw new Error("o componente não montou elemento");
  return visto.el;
}

// Uma porta falsa: anota cada carga pedida e responde da fila. Nenhuma rede.
function portaFalsa(respostas: Carga[] = []) {
  const chamadas: unknown[][] = [];
  const porta: PortaDados = {
    async carregar(papel, usuarioId) {
      chamadas.push(["carregar", papel, usuarioId]);
      return respostas.shift() ?? { ok: false, erro: "sem resposta" };
    },
    avisar(mensagem) {
      chamadas.push(["avisar", mensagem]);
    },
  };
  return { porta, chamadas };
}

// Monta o provider dentro de um render e devolve o recarregar que ele entrega à tela. As
// atualizações anotadas recomeçam nessa montagem.
function montarProvider(papel: Papel, usuarioId: string, porta: PortaDados): () => Promise<unknown> {
  atualizacoes.length = 0;
  const portao = montado(() => DadosProvider({ papel, usuarioId, porta, children: <p>tela</p> }));
  const recarregar = portao.props.recarregar;
  if (typeof recarregar !== "function") throw new Error("o provider não entregou recarregar");
  return () => recarregar();
}

// O estado do provider: as atualizações anotadas desde a montagem, em ordem, sobre o inicial.
function estadoDoProvider(): EstadoDados {
  let estado = VAZIO;
  for (const atualizacao of atualizacoes) {
    if (typeof atualizacao !== "function") throw new Error("o provider só muda o estado por função");
    estado = atualizacao(estado);
  }
  return estado;
}

const SKELETON = renderToStaticMarkup(<Carregando />);
const VAZIO: EstadoDados = { atual: null, erro: null, recarregando: false };
const prontaDe = (erros: ErrosDeCarga = {}): CargaPronta => ({ ok: true, dados: datasetDeTeste(), erros });

const sessaoDe = (id: string, papel: Papel): ValorSessao => ({
  usuario: { id, email: `${id}@exemplo.com` },
  perfil: { id, role: papel, nome: id, email: `${id}@exemplo.com` },
  papel,
  pode: () => false,
  sair: () => Promise.resolve(),
});

function comErros(erros: ErrosDeCarga, el: ReactElement, recarregar: () => Promise<void> = () => Promise.resolve()) {
  return (
    <DadosContexto.Provider value={{ dados: datasetDeTeste(), erros, recarregando: false, recarregar }}>{el}</DadosContexto.Provider>
  );
}

describe("provider de dados (NAV-08, DATA-06, DATA-07, DATA-09, AUTH-08, SEC-06, UI-07)", () => {
  it("NAV-08 e UI-07: antes da 1ª carga, Skeleton no lugar da tela e nunca 'Ficha não encontrada'; a montagem pede a carga do usuário", async () => {
    const f = portaFalsa();
    const html = renderToStaticMarkup(
      <DadosProvider papel="mentor" usuarioId="u1" porta={f.porta}>
        <p>Ficha não encontrada</p>
      </DadosProvider>,
    );
    expect(html).toBe(SKELETON);
    expect(html).not.toContain("Ficha não encontrada");

    efeitos.length = 0;
    const portao = montado(() => DadosProvider({ papel: "mentor", usuarioId: "u1", porta: f.porta, children: <p>tela</p> }));
    expect([portao.type, portao.props.estado]).toEqual([PortaoDados, VAZIO]);
    // O efeito da montagem é a primeira carga, pela mesma recarga que a tela recebe.
    expect(efeitos.map((e) => e.deps)).toEqual([[portao.props.recarregar]]);
    efeitos[0].fn();
    await vi.waitFor(() => expect(f.chamadas).toEqual([["carregar", "mentor", "u1"]]));
  });

  it("DATA-06: a 1ª carga que falha em R02/R03, R04 ou R06 mostra a mensagem e 'Tentar de novo', que pede a carga outra vez", async () => {
    const mudancas: Array<Partial<EstadoDados>> = [];
    const avisos: string[] = [];
    await recarregarDados(
      criarRecarga<CargaPronta>(),
      () => Promise.resolve({ ok: false, erro: "falhou sessoes" }),
      (parcial) => mudancas.push(parcial),
      (mensagem) => avisos.push(mensagem),
    );
    expect(mudancas).toEqual([{ recarregando: true }, { atual: null, erro: "falhou sessoes", recarregando: false }]);
    expect(avisos).toEqual([]);

    const estado: EstadoDados = { atual: null, erro: "falhou sessoes", recarregando: false };
    let pedidos = 0;
    const recarregar = async () => {
      pedidos += 1;
    };
    const html = renderToStaticMarkup(<PortaoDados estado={estado} recarregar={recarregar}><p>tela</p></PortaoDados>);
    expect(html).toContain("falhou sessoes");
    expect(html).toContain(">Tentar de novo</button>");
    expect(html).not.toContain("<p>tela</p>");
    clicar(PortaoDados({ estado, recarregar, children: <p>tela</p> }), "Tentar de novo");
    expect(pedidos).toBe(1);
    // Enquanto a nova tentativa não volta, Skeleton de novo.
    expect(renderToStaticMarkup(<PortaoDados estado={{ ...estado, recarregando: true }} recarregar={recarregar}><p>tela</p></PortaoDados>)).toBe(SKELETON);
  });

  it("falha numa recarga: o dataset anterior fica na tela e o erro vai para um toast", async () => {
    const recarga = criarRecarga<CargaPronta>();
    const carga = prontaDe({ rotas: "timeout" });
    let estado = VAZIO;
    const mudar = (parcial: Partial<EstadoDados>) => {
      estado = { ...estado, ...parcial };
    };
    const avisos: string[] = [];
    await recarregarDados(recarga, () => Promise.resolve(carga), mudar, (m) => avisos.push(m));
    await recarregarDados(recarga, () => Promise.resolve({ ok: false, erro: "Failed to fetch" }), mudar, (m) => avisos.push(m));
    expect(estado).toEqual({ atual: carga, erro: "Failed to fetch", recarregando: false });
    expect(avisos).toEqual(["Failed to fetch"]);

    const visto: { valor?: ValorDados } = {};
    function Tela() {
      visto.valor = useDados();
      return <p>tela</p>;
    }
    const recarregar = () => Promise.resolve();
    expect(renderToStaticMarkup(<PortaoDados estado={estado} recarregar={recarregar}><Tela /></PortaoDados>)).toBe("<p>tela</p>");
    expect(visto.valor).toEqual({ dados: carga.dados, erros: { rotas: "timeout" }, recarregando: false, recarregar });
    expect(visto.valor?.recarregar).toBe(recarregar);

    PORTA_DADOS.avisar("Failed to fetch");
    expect(toastErro).toHaveBeenCalledWith("Failed to fetch");
  });

  it("AUTH-08: a carga tem a key do usuário, então trocar de usuário desmonta o provider e descarta os dados", () => {
    for (const [id, papel] of [
      ["u1", "admin"],
      ["u2", "mentor"],
    ] as const) {
      const provider = montado(
        () => DadosDoUsuario({ children: <p>tela</p> }),
        (filho) => <SessaoContexto.Provider value={sessaoDe(id, papel)}>{filho}</SessaoContexto.Provider>,
      );
      expect([provider.type, provider.key, provider.props.papel, provider.props.usuarioId], id).toEqual([DadosProvider, id, papel, id]);
    }
    // A Casca põe a carga do usuário em volta da Moldura, dentro da sessão.
    const carga = elementos(Casca({ children: <p>tela</p> })).filter((el) => el.type === DadosDoUsuario);
    expect(carga).toHaveLength(1);
    expect(elementos(carga[0].props.children).map((el) => el.type)).toContain(Moldura);
  });

  it("SEC-06: com o login de outra pessoa em outra aba, a carga do provider pede carregarTudo com o usuário da tela, não com o da sessão, e devolve a recusa dela", async () => {
    const recusada: Carga = { ok: false, erro: "A sessão mudou.", sessaoMudou: true };
    carregarTudo.mockResolvedValueOnce(recusada);
    expect(await PORTA_DADOS.carregar("admin", "u1")).toBe(recusada);
    expect(carregarTudo.mock.calls).toEqual([["admin", "u1"]]);
  });

  it("DATA-09: duas recargas pelo recarregar do provider, com as respostas fora de ordem: vale a da última pedida", async () => {
    const entregar: Array<(carga: Carga) => void> = [];
    const recarregar = montarProvider("admin", "u1", {
      carregar: () => new Promise<Carga>((resolve) => entregar.push(resolve)),
      avisar: () => undefined,
    });
    const primeira = recarregar();
    const segunda = recarregar();
    const nova = prontaDe();
    entregar[1](nova);
    await segunda;
    // A resposta da primeira chega depois e se descarta.
    entregar[0](prontaDe({ rotas: "resposta velha" }));
    await primeira;
    expect(estadoDoProvider()).toEqual({ atual: nova, erro: null, recarregando: false });
  });

  it("DATA-09: a recarga do provider que falha depois de uma carga mantém o dataset na tela e manda o erro para um toast", async () => {
    const carga = prontaDe();
    const f = portaFalsa([carga, { ok: false, erro: "Failed to fetch" }]);
    const recarregar = montarProvider("admin", "u1", f.porta);
    await recarregar();
    await recarregar();
    expect(estadoDoProvider()).toEqual({ atual: carga, erro: "Failed to fetch", recarregando: false });
    expect(f.chamadas).toEqual([["carregar", "admin", "u1"], ["carregar", "admin", "u1"], ["avisar", "Failed to fetch"]]);
  });

  it("AUTH-08: o provider de quem entra depois nasce sem o dataset de quem saiu: se a 1ª carga dele falha, ele vê o erro, nunca os dados do outro", async () => {
    const doPrimeiro = prontaDe();
    await montarProvider("admin", "u1", portaFalsa([doPrimeiro]).porta)();
    expect(estadoDoProvider().atual).toBe(doPrimeiro);

    const segundo = portaFalsa([{ ok: false, erro: "Failed to fetch" }]);
    await montarProvider("mentor", "u2", segundo.porta)();
    expect(estadoDoProvider()).toEqual({ atual: null, erro: "Failed to fetch", recarregando: false });
    expect(segundo.chamadas).toEqual([["carregar", "mentor", "u2"]]);
  });

  it("DATA-07: AvisoRelacoes troca a tela por EmptyState com 'Tentar de novo' quando uma relação essencial falhou", () => {
    const html = renderToStaticMarkup(
      comErros(
        { rotas: "canceling statement due to statement timeout" },
        <AvisoRelacoes essenciais={["rotas", "canais"]}>
          <p>tela de rotas</p>
        </AvisoRelacoes>,
      ),
    );
    expect(html).not.toContain("tela de rotas");
    expect(html).toContain("rotas: canceling statement due to statement timeout");
    expect(html).toContain(">Tentar de novo</button>");

    let pedidos = 0;
    const recarregar = async () => {
      pedidos += 1;
    };
    const tela = montado(
      () => AvisoRelacoes({ essenciais: ["rotas"], children: <p>tela de rotas</p> }),
      (filho) => comErros({ rotas: "timeout" }, filho, recarregar),
    );
    clicar(tela, "Tentar de novo");
    expect(pedidos).toBe(1);
  });

  it("DATA-07: complementar com falha vira um Alert com o nome dela e o resto renderiza; erro de relação que a tela não usa não muda nada", () => {
    const tela = (erros: ErrosDeCarga) =>
      renderToStaticMarkup(
        comErros(
          erros,
          <AvisoRelacoes complementares={["lia_cobrancas", "nps_respostas"]}>
            <p>dashboard</p>
          </AvisoRelacoes>,
        ),
      );
    const comFalha = tela({ nps_respostas: "permission denied for table nps_respostas", rotas: "timeout" });
    expect(comFalha).toMatch(/^<div role="status"[^>]*>[\s\S]*Parte dos dados não carregou[\s\S]*<p>nps_respostas: permission denied for table nps_respostas<\/p>[\s\S]*<\/div><p>dashboard<\/p>$/);
    expect(comFalha).not.toContain("rotas: timeout");
    expect(comFalha).not.toContain("lia_cobrancas");
    expect(tela({ rotas: "timeout" })).toBe("<p>dashboard</p>");
    expect(tela({})).toBe("<p>dashboard</p>");
  });
});
