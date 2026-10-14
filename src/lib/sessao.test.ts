import { describe, expect, it } from "vitest";

import type { EventoSessao, Perfil, Resultado } from "./data/auth";
import { descarregarPendencias, type EstadoSessao, reduzirSessao, registrarPendencia, SESSAO_INICIAL } from "./sessao";

const ana = { id: "u1", email: "ana@exemplo.com" };
const beto = { id: "u2", email: "beto@exemplo.com" };
const perfilDe = (id: string, role: string | null): Perfil => ({ id, role, nome: "Nome", email: "nome@exemplo.com" });

const auth = (tipo: EventoSessao["tipo"], usuario: EventoSessao["usuario"]): EventoSessao => ({ tipo, usuario });
const perfilLido = (usuarioId: string, resultado: Resultado<Perfil>) => ({ tipo: "PERFIL_LIDO" as const, usuarioId, resultado });

// As fases que já têm usuário, todas da Ana.
const COM_USUARIO: EstadoSessao[] = [
  { fase: "lendoPerfil", usuario: ana },
  { fase: "semPerfil", usuario: ana, encerrarSessao: true },
  { fase: "papelInvalido", usuario: ana, perfil: perfilDe("u1", "gestor") },
  { fase: "pronto", usuario: ana, perfil: perfilDe("u1", "mentor"), papel: "mentor" },
];
const TODAS: EstadoSessao[] = [{ fase: "verificando" }, { fase: "anonimo" }, ...COM_USUARIO];

describe("máquina da sessão (AUTH-01, AUTH-06 a AUTH-08, EDGE-02, SEC-06)", () => {
  it("registrarPendencia e descarregarPendencias: o registrado roda uma vez, e o registro desfeito não roda", async () => {
    const chamadas: string[] = [];
    const gravarNota = async () => {
      await Promise.resolve();
      chamadas.push("nota");
    };
    registrarPendencia(gravarNota);
    registrarPendencia(gravarNota);
    const desfazer = registrarPendencia(() => {
      chamadas.push("desfeita");
    });
    desfazer();

    await descarregarPendencias();
    // Esperou a gravação assíncrona: o sair() só chama o signOut depois (SEC-06).
    expect(chamadas).toEqual(["nota"]);
    await descarregarPendencias();
    expect(chamadas).toEqual(["nota"]);
  });

  it("AUTH-01: começa verificando; INITIAL_SESSION sem sessão → anonimo, com sessão → lendoPerfil", () => {
    expect(SESSAO_INICIAL).toEqual({ fase: "verificando" });
    expect(reduzirSessao(SESSAO_INICIAL, auth("INITIAL_SESSION", null))).toEqual({ fase: "anonimo" });
    expect(reduzirSessao(SESSAO_INICIAL, auth("INITIAL_SESSION", ana))).toEqual({ fase: "lendoPerfil", usuario: ana });
  });

  it("perfil válido → pronto com o papel", () => {
    for (const papel of ["admin", "diretoria", "mentor"] as const) {
      const perfil = perfilDe("u1", papel);
      expect(reduzirSessao({ fase: "lendoPerfil", usuario: ana }, perfilLido("u1", { ok: true, dados: perfil })), papel).toEqual({
        fase: "pronto",
        usuario: ana,
        perfil,
        papel,
      });
    }
  });

  it("AUTH-06: perfil sem linha ou com erro → semPerfil com pedido de signOut", () => {
    const falha = perfilLido("u1", { ok: false, erro: "JSON object requested, multiple (or no) rows returned" });
    expect(reduzirSessao({ fase: "lendoPerfil", usuario: ana }, falha)).toEqual({ fase: "semPerfil", usuario: ana, encerrarSessao: true });
  });

  it("AUTH-07: papel nulo ou desconhecido → papelInvalido", () => {
    for (const role of [null, "", "gestor", "Admin", "constructor"]) {
      const perfil = perfilDe("u1", role);
      expect(reduzirSessao({ fase: "lendoPerfil", usuario: ana }, perfilLido("u1", { ok: true, dados: perfil })), String(role)).toEqual({
        fase: "papelInvalido",
        usuario: ana,
        perfil,
      });
    }
  });

  it("AUTH-08 e EDGE-02: SIGNED_OUT em qualquer fase → anonimo, sem usuário nem perfil", () => {
    for (const estado of TODAS) expect(reduzirSessao(estado, auth("SIGNED_OUT", null)), estado.fase).toEqual({ fase: "anonimo" });
  });

  it("SIGNED_IN de outro usuário → lendoPerfil desse usuário; o do mesmo usuário não muda a fase", () => {
    expect(reduzirSessao({ fase: "anonimo" }, auth("SIGNED_IN", ana))).toEqual({ fase: "lendoPerfil", usuario: ana });
    for (const estado of COM_USUARIO) {
      expect(reduzirSessao(estado, auth("SIGNED_IN", beto)), estado.fase).toEqual({ fase: "lendoPerfil", usuario: beto });
      expect(reduzirSessao(estado, auth("SIGNED_IN", ana)), estado.fase).toBe(estado);
    }
  });

  it("TOKEN_REFRESHED não muda a fase", () => {
    for (const estado of COM_USUARIO) expect(reduzirSessao(estado, auth("TOKEN_REFRESHED", ana)), estado.fase).toBe(estado);
  });

  it("SEC-06: perfil lido de outro usuário, ou fora de lendoPerfil, não muda a fase", () => {
    const deBeto = { fase: "lendoPerfil", usuario: beto } as const;
    expect(reduzirSessao(deBeto, perfilLido("u1", { ok: true, dados: perfilDe("u1", "admin") }))).toBe(deBeto);
    for (const estado of [...COM_USUARIO.slice(1), { fase: "anonimo" } as const]) {
      expect(reduzirSessao(estado, perfilLido("u1", { ok: true, dados: perfilDe("u1", "admin") })), estado.fase).toBe(estado);
    }
  });

  it("AUTH-08: quem entra depois de uma saída fica com o papel dele, não com o de quem saiu", () => {
    const eventos = [
      auth("SIGNED_OUT", null),
      auth("SIGNED_IN", beto),
      perfilLido("u1", { ok: true, dados: perfilDe("u1", "admin") }),
      perfilLido("u2", { ok: true, dados: perfilDe("u2", "mentor") }),
    ];
    const inicio: EstadoSessao = { fase: "pronto", usuario: ana, perfil: perfilDe("u1", "admin"), papel: "admin" };
    expect(eventos.reduce(reduzirSessao, inicio)).toEqual({ fase: "pronto", usuario: beto, perfil: perfilDe("u2", "mentor"), papel: "mentor" });
  });
});
