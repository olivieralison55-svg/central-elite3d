import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { EventoSessao, Perfil, Resultado } from "@/lib/data/auth";
import { registrarPendencia } from "@/lib/sessao";

import { useSessao, type ValorSessao } from "./contexto";
import { type Acao, assinar, Carregando, ESTADO_INICIAL, type Estado, PortaoSessao, type PortaSessao, reagir, reduzir, sair } from "./sessao";
import TelaLogin from "./tela-login";
import TelaPapel from "./tela-papel";

const ana = { id: "u1", email: "ana@exemplo.com" };
const beto = { id: "u2", email: "beto@exemplo.com" };
const perfilDe = (id: string, role: string | null): Perfil => ({ id, role, nome: "Nome", email: "nome@exemplo.com" });

// Uma porta falsa: anota cada chamada no mesmo registro e responde do cenário. Nenhuma rede.
function portaFalsa(perfis: Record<string, Resultado<Perfil>> = {}) {
  const chamadas: unknown[][] = [];
  let ouvinte: ((evento: EventoSessao) => void) | null = null;
  const porta: PortaSessao = {
    ouvir(cb) {
      chamadas.push(["ouvir"]);
      ouvinte = cb;
      return () => {
        chamadas.push(["cancelar"]);
      };
    },
    async lerPerfil(usuarioId) {
      chamadas.push(["lerPerfil", usuarioId]);
      return perfis[usuarioId] ?? { ok: false, erro: "JSON object requested, multiple (or no) rows returned" };
    },
    async sair() {
      chamadas.push(["signOut"]);
    },
  };
  const emitir = (evento: EventoSessao) => {
    if (!ouvinte) throw new Error("ninguém assinou a sessão");
    ouvinte(evento);
  };
  return { porta, chamadas, emitir };
}

// O que o useReducer do provider faz com a lista de ações.
const rodar = (acoes: Acao[], inicio: Estado = ESTADO_INICIAL) => acoes.reduce(reduzir, inicio);

const sairFalso = () => Promise.resolve();
const html = (estado: Estado, filhos = <p>filhos</p>) => renderToStaticMarkup(<PortaoSessao estado={estado} sair={sairFalso}>{filhos}</PortaoSessao>);
const portao = (estado: Estado) => PortaoSessao({ estado, sair: sairFalso, children: <p>filhos</p> });

const prontoDe = (usuario: typeof ana, role: "admin" | "diretoria" | "mentor"): Estado => ({
  sessao: { fase: "pronto", usuario, perfil: perfilDe(usuario.id, role), papel: role },
  perfilAusente: false,
});

describe("provider da sessão (AUTH-01, AUTH-02, AUTH-06, AUTH-08, EDGE-02, SEC-06)", () => {
  it("o callback do onAuthStateChange só guarda o evento; o R01 sai do efeito separado e leva a pronto", async () => {
    const f = portaFalsa({ u1: { ok: true, dados: perfilDe("u1", "mentor") } });
    const acoes: Acao[] = [];
    const cancelar = assinar((acao) => acoes.push(acao), f.porta);

    f.emitir({ tipo: "INITIAL_SESSION", usuario: ana });
    // Dentro do callback, nenhuma chamada ao cliente: só o evento guardado.
    expect(acoes).toEqual([{ tipo: "INITIAL_SESSION", usuario: ana }]);
    expect(f.chamadas).toEqual([["ouvir"]]);
    expect(rodar(acoes).sessao).toEqual({ fase: "lendoPerfil", usuario: ana });

    await reagir(rodar(acoes).sessao, (acao) => acoes.push(acao), f.porta);
    expect(f.chamadas).toEqual([["ouvir"], ["lerPerfil", "u1"]]);
    expect(rodar(acoes)).toEqual({ sessao: { fase: "pronto", usuario: ana, perfil: perfilDe("u1", "mentor"), papel: "mentor" }, perfilAusente: false });

    cancelar();
    expect(f.chamadas.at(-1)).toEqual(["cancelar"]);
  });

  it("SEC-06: sair() espera descarregarPendencias() e só depois chama o signOut", async () => {
    const f = portaFalsa();
    registrarPendencia(async () => {
      await Promise.resolve();
      await Promise.resolve();
      f.chamadas.push(["nota gravada"]);
    });
    const acoes: Acao[] = [];
    await sair((acao) => acoes.push(acao), f.porta);
    expect(f.chamadas).toEqual([["nota gravada"], ["signOut"]]);
    expect(acoes).toEqual([{ tipo: "SAIR" }]);
  });

  it("render por fase: verificando e lendoPerfil → Skeleton; anonimo → login; semPerfil e papelInvalido → telas da T17; pronto → filhos", () => {
    const skeleton = renderToStaticMarkup(<Carregando />);
    expect(skeleton).toContain('aria-busy="true"');
    expect(html(ESTADO_INICIAL)).toBe(skeleton);
    expect(html({ sessao: { fase: "lendoPerfil", usuario: ana }, perfilAusente: false })).toBe(skeleton);

    expect(portao({ sessao: { fase: "anonimo" }, perfilAusente: false }).type).toBe(TelaLogin);
    const semPerfil = portao({ sessao: { fase: "semPerfil", usuario: ana, encerrarSessao: true }, perfilAusente: true });
    expect([semPerfil.type, semPerfil.props]).toEqual([TelaPapel, { motivo: "semPerfil", sair: sairFalso }]);
    const papelInvalido = portao({ sessao: { fase: "papelInvalido", usuario: ana, perfil: perfilDe("u1", "gestor") }, perfilAusente: false });
    expect([papelInvalido.type, papelInvalido.props]).toEqual([TelaPapel, { motivo: "papelInvalido", sair: sairFalso }]);

    const visto: { valor?: ValorSessao } = {};
    function Sonda() {
      visto.valor = useSessao();
      return <p>filhos</p>;
    }
    expect(html(prontoDe(ana, "diretoria"), <Sonda />)).toBe("<p>filhos</p>");
    expect(visto.valor).toMatchObject({ usuario: ana, perfil: perfilDe("u1", "diretoria"), papel: "diretoria", sair: sairFalso });
    expect([visto.valor?.pode("verFinanceiro"), visto.valor?.pode("excluir")]).toEqual([true, false]);
  });

  it("AUTH-01: nenhuma leitura de dado antes de pronto; sem sessão, nem o perfil é lido", async () => {
    let montados = 0;
    function TelaComDado() {
      montados += 1;
      return <p>dado</p>;
    }
    const antesDePronto: Estado[] = [
      ESTADO_INICIAL,
      { sessao: { fase: "anonimo" }, perfilAusente: false },
      { sessao: { fase: "anonimo" }, perfilAusente: true },
      { sessao: { fase: "lendoPerfil", usuario: ana }, perfilAusente: false },
      { sessao: { fase: "semPerfil", usuario: ana, encerrarSessao: true }, perfilAusente: true },
      { sessao: { fase: "papelInvalido", usuario: ana, perfil: perfilDe("u1", null) }, perfilAusente: false },
    ];
    for (const estado of antesDePronto) expect(html(estado, <TelaComDado />), estado.sessao.fase).not.toContain("dado");
    expect(montados).toBe(0);

    // Sem sessão: o efeito não chama o cliente em nenhuma das fases sem leitura de perfil.
    const f = portaFalsa();
    const anonimo = rodar([{ tipo: "INITIAL_SESSION", usuario: null }]);
    expect(portao(anonimo).type).toBe(TelaLogin);
    for (const estado of [ESTADO_INICIAL, anonimo, antesDePronto[5], prontoDe(ana, "admin")]) await reagir(estado.sessao, () => undefined, f.porta);
    expect(f.chamadas).toEqual([]);
  });

  it("AUTH-06: perfil ausente encerra a sessão, e a tela sobrevive ao SIGNED_OUT até o Sair", async () => {
    const f = portaFalsa();
    const acoes: Acao[] = [{ tipo: "INITIAL_SESSION", usuario: ana }];
    await reagir(rodar(acoes).sessao, (acao) => acoes.push(acao), f.porta);
    const semPerfil = rodar(acoes);
    expect(semPerfil).toEqual({ sessao: { fase: "semPerfil", usuario: ana, encerrarSessao: true }, perfilAusente: true });

    await reagir(semPerfil.sessao, (acao) => acoes.push(acao), f.porta);
    expect(f.chamadas).toEqual([["lerPerfil", "u1"], ["signOut"]]);

    // O signOut emite o SIGNED_OUT: reduz tudo o que os efeitos despacharam de fato, e ele no fim.
    acoes.push({ tipo: "SIGNED_OUT", usuario: null });
    const depoisDaSaida = rodar(acoes);
    expect(depoisDaSaida).toEqual({ sessao: { fase: "anonimo" }, perfilAusente: true });
    expect(portao(depoisDaSaida).props).toEqual({ motivo: "semPerfil", sair: sairFalso });

    // O Sair leva ao login; uma sessão nova também descarta o motivo.
    expect(portao(reduzir(depoisDaSaida, { tipo: "SAIR" })).type).toBe(TelaLogin);
    expect(reduzir(depoisDaSaida, { tipo: "SIGNED_IN", usuario: beto })).toEqual({ sessao: { fase: "lendoPerfil", usuario: beto }, perfilAusente: false });
  });

  it("AUTH-08 e EDGE-02: a saída volta ao login, e quem entra depois ganha a árvore montada do zero (key = id)", () => {
    const daAna = prontoDe(ana, "admin");
    expect(portao(daAna).key).toBe("u1");
    expect(portao(reduzir(daAna, { tipo: "SIGNED_OUT", usuario: null })).type).toBe(TelaLogin);

    const doBeto = rodar(
      [
        { tipo: "SIGNED_OUT", usuario: null },
        { tipo: "SIGNED_IN", usuario: beto },
        { tipo: "PERFIL_LIDO", usuarioId: "u2", resultado: { ok: true, dados: perfilDe("u2", "mentor") } },
      ],
      daAna,
    );
    expect(doBeto.sessao).toMatchObject({ fase: "pronto", usuario: beto, papel: "mentor" });
    expect(portao(doBeto).key).toBe("u2");
  });
});
