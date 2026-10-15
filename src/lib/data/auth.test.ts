import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AuthChangeEvent,
  type AuthError,
  AuthApiError,
  AuthRetryableFetchError,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { classificarErroLogin, entrar, type EventoSessao, lerPerfil, ouvirSessao, sair, usuarioDaSessao } from "./auth";

const RAIZ = fileURLToPath(new URL("../../..", import.meta.url));
const ESTE_ARQUIVO = "src/lib/data/auth.test.ts";

type Resposta = { data: unknown; error: unknown };
interface Respostas {
  login: AuthError | null;
  saida: AuthError | null;
  sessao: Resposta;
  perfil: Resposta;
}
type Ouvinte = (evento: AuthChangeEvent, sessao: Session | null) => void;

// Um cliente falso que anota cada chamada e responde do que o cenário pediu. Nenhuma rede.
function clienteFalso(r: Partial<Respostas> = {}) {
  const chamadas: unknown[][] = [];
  let ouvinte: Ouvinte | null = null;
  const consulta = {
    select(colunas: string) {
      chamadas.push(["select", colunas]);
      return consulta;
    },
    eq(coluna: string, valor: string) {
      chamadas.push(["eq", coluna, valor]);
      return consulta;
    },
    single() {
      chamadas.push(["single"]);
      return Promise.resolve(r.perfil ?? { data: null, error: null });
    },
  };
  const db = {
    from(relacao: string) {
      chamadas.push(["from", relacao]);
      return consulta;
    },
    auth: {
      signInWithPassword(credenciais: { email: string; password: string }) {
        chamadas.push(["signInWithPassword", credenciais]);
        return Promise.resolve({ data: {}, error: r.login ?? null });
      },
      signOut() {
        chamadas.push(["signOut"]);
        return Promise.resolve({ error: r.saida ?? null });
      },
      getSession() {
        chamadas.push(["getSession"]);
        return Promise.resolve(r.sessao ?? { data: { session: null }, error: null });
      },
      onAuthStateChange(cb: Ouvinte) {
        chamadas.push(["onAuthStateChange"]);
        ouvinte = cb;
        return { data: { subscription: { unsubscribe: () => chamadas.push(["unsubscribe"]) } } };
      },
    },
  };
  const emitir = (evento: AuthChangeEvent, sessao: Session | null) => ouvinte?.(evento, sessao);
  return { db: db as unknown as SupabaseClient, chamadas, emitir };
}

const sessaoDe = (id: string, email: string) => ({ user: { id, email } }) as unknown as Session;

describe("autenticação na porta (AUTH-02, AUTH-04 a AUTH-06, AUTH-10, EDGE-02, SEC-06)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AUTH-02: entrar chama signInWithPassword({ email, password }) e devolve null quando entra", async () => {
    const certo = clienteFalso();
    expect(await entrar("ana@exemplo.com", "s3gredo", certo.db)).toBeNull();
    expect(certo.chamadas).toEqual([["signInWithPassword", { email: "ana@exemplo.com", password: "s3gredo" }]]);

    const recusado = clienteFalso({ login: new AuthApiError("Invalid login credentials", 400, "invalid_credentials") });
    expect(await entrar("ana@exemplo.com", "errada", recusado.db)).toBe("E-mail ou senha inválidos.");
  });

  it("AUTH-04: invalid_credentials ou status 400 → 'E-mail ou senha inválidos.'", () => {
    const recusas = [
      new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
      new AuthApiError("Invalid login credentials", 400, undefined),
      new AuthApiError("Invalid login credentials", 401, "invalid_credentials"),
    ];
    for (const erro of recusas) expect(classificarErroLogin(erro), `${erro.status} ${erro.code}`).toBe("E-mail ou senha inválidos.");
  });

  it("AUTH-05: falha de rede (AuthRetryableFetchError) dá a mensagem de conexão, sem falar em senha", () => {
    for (const erro of [new AuthRetryableFetchError("Failed to fetch", 0), new AuthRetryableFetchError("Service Unavailable", 503)]) {
      const mensagem = classificarErroLogin(erro);
      expect(mensagem).toBe("Sem conexão com o servidor. Tente de novo.");
      expect(mensagem).not.toMatch(/senha/i);
    }
  });

  it("AUTH-05: 429 dá a mensagem de limite de tentativas, sem falar em senha", () => {
    const mensagem = classificarErroLogin(new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"));
    expect(mensagem).toBe("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
    expect(mensagem).not.toMatch(/senha/i);
  });

  it("outro erro do Auth: 'Não foi possível entrar: <mensagem>.', sem falar em senha", () => {
    const mensagem = classificarErroLogin(new AuthApiError("Email logins are disabled", 422, "email_provider_disabled"));
    expect(mensagem).toBe("Não foi possível entrar: Email logins are disabled.");
    expect(mensagem).not.toMatch(/senha/i);
  });

  it("AUTH-02 (R01): lerPerfil faz from('profiles').select('*').eq('id', id).single() e devolve o perfil", async () => {
    const linha = { id: "u1", role: "mentor", nome: "Ana", email: "ana@exemplo.com", criado_em: "2026-01-01" };
    const f = clienteFalso({ perfil: { data: linha, error: null } });
    expect(await lerPerfil("u1", f.db)).toEqual({ ok: true, dados: { id: "u1", role: "mentor", nome: "Ana", email: "ana@exemplo.com" } });
    expect(f.chamadas).toEqual([["from", "profiles"], ["select", "*"], ["eq", "id", "u1"], ["single"]]);

    const semPapel = clienteFalso({ perfil: { data: { id: "u2", role: null, nome: null, email: null }, error: null } });
    expect(await lerPerfil("u2", semPapel.db)).toEqual({ ok: true, dados: { id: "u2", role: null, nome: null, email: null } });
  });

  it("AUTH-06: perfil sem linha, com erro ou fora do schema devolve falha e escreve no console", async () => {
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const semLinha = clienteFalso({ perfil: { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } } });
    expect(await lerPerfil("u1", semLinha.db)).toEqual({ ok: false, erro: "JSON object requested, multiple (or no) rows returned" });
    expect(erroNoConsole.mock.calls.at(-1)?.[0]).toBe("[central-elite3d] profiles");

    const foraDoSchema = clienteFalso({ perfil: { data: { id: "u1", role: 7, nome: null, email: null }, error: null } });
    expect(await lerPerfil("u1", foraDoSchema.db)).toEqual({ ok: false, erro: "profiles: schema mismatch" });
    expect(erroNoConsole.mock.calls.at(-1)?.[0]).toBe("[central-elite3d] profiles: schema mismatch");
  });

  it("SEC-06: usuarioDaSessao devolve o id da sessão atual ou null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logado = clienteFalso({ sessao: { data: { session: sessaoDe("u1", "ana@exemplo.com") }, error: null } });
    expect(await usuarioDaSessao(logado.db)).toBe("u1");
    expect(await usuarioDaSessao(clienteFalso().db)).toBeNull();
    const comErro = clienteFalso({ sessao: { data: { session: null }, error: new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found") } });
    expect(await usuarioDaSessao(comErro.db)).toBeNull();
  });

  it("EDGE-02: ouvirSessao repassa cada evento com o usuário, SIGNED_OUT sem usuário, e devolve o cancelamento", () => {
    const f = clienteFalso();
    const recebidos: EventoSessao[] = [];
    const cancelar = ouvirSessao((evento) => recebidos.push(evento), f.db);
    f.emitir("INITIAL_SESSION", sessaoDe("u1", "ana@exemplo.com"));
    f.emitir("TOKEN_REFRESHED", sessaoDe("u1", "ana@exemplo.com"));
    f.emitir("SIGNED_OUT", null);
    expect(recebidos).toEqual([
      { tipo: "INITIAL_SESSION", usuario: { id: "u1", email: "ana@exemplo.com" } },
      { tipo: "TOKEN_REFRESHED", usuario: { id: "u1", email: "ana@exemplo.com" } },
      { tipo: "SIGNED_OUT", usuario: null },
    ]);
    cancelar();
    expect(f.chamadas).toEqual([["onAuthStateChange"], ["unsubscribe"]]);
  });

  it("AUTH-06: sair encerra a sessão com signOut", async () => {
    const f = clienteFalso();
    await sair(f.db);
    expect(f.chamadas).toEqual([["signOut"]]);
  });

  it("AUTH-10: nenhuma chamada a signUp, resetPasswordForEmail, signInWithOtp ou signInWithOAuth em src/", () => {
    const proibida = /\.(?:signUp|resetPasswordForEmail|signInWithOtp|signInWithOAuth)\s*\(/g;
    const ruim = "db.auth.signUp({ email });\ndb.auth.resetPasswordForEmail(email);\ndb.auth.signInWithOtp({ email });\ndb.auth.signInWithOAuth({ provider });";
    expect(ruim.match(proibida)).toHaveLength(4);

    const achados = readdirSync(join(RAIZ, "src"), { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && /\.[cm]?[jt]sx?$/.test(d.name))
      .map((d) => relative(RAIZ, join(d.parentPath, d.name)))
      .filter((caminho) => caminho !== ESTE_ARQUIVO)
      .flatMap((caminho) => (readFileSync(join(RAIZ, caminho), "utf8").match(proibida) ?? []).map((m) => `${caminho}: ${m}`));
    expect(achados).toEqual([]);
  });
});
