import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validarConfig } from "./config";

const RAIZ = fileURLToPath(new URL("../../..", import.meta.url));
const URL_PRODUCAO = "https://matgynpiscyoshnjzolo.supabase.co";
// index.html:531, a chave publicável que o app de hoje usa.
const CHAVE_PRODUCAO = "sb_publishable_S7cckKfundDsqo-s_qL2-A_lgPkY9Yl";
// Montados em pedaços: o texto inteiro não pode aparecer em src/ (STACK-07).
const PROIBIDOS = ["sb_sec" + "ret_", "service" + "_role", "SUPABASE_SERVICE" + "_ROLE_KEY"];

type Env = { NEXT_PUBLIC_SUPABASE_URL?: string; NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string };

const ler = (arquivo: string) => readFileSync(join(RAIZ, arquivo), "utf8");
const base64url = (valor: object) => Buffer.from(JSON.stringify(valor)).toString("base64url");
const jwt = (payload: object) => [base64url({ alg: "HS256", typ: "JWT" }), base64url(payload), "assinatura"].join(".");

// O módulo lê o ambiente na carga: cada cenário recarrega com o ambiente dele.
function ambiente(env: Env) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

async function carregarConfig(env: Env) {
  ambiente(env);
  return import("./config");
}

async function carregarNextConfig(env: Env) {
  ambiente(env);
  return import("../../../next.config");
}

describe("config pública do Supabase (STACK-05, STACK-06, STACK-07)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("aceita a chave sb_publishable_ de produção e um JWT com role anon", () => {
    expect(validarConfig({ url: URL_PRODUCAO, chave: CHAVE_PRODUCAO })).toBeNull();
    const anon = jwt({ iss: "supabase", ref: "matgynpiscyoshnjzolo", role: "anon" });
    expect(validarConfig({ url: URL_PRODUCAO, chave: anon })).toBeNull();
  });

  it("recusa JWT com role diferente de anon e texto qualquer, com erro que nomeia NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", () => {
    const recusadas = [
      jwt({ role: "authenticated" }),
      jwt({ role: "service" + "_role" }),
      jwt({ ref: "matgynpiscyoshnjzolo" }),
      "sb_sec" + "ret_abc",
      "qualquer-coisa",
      "eyJ.nao-e-base64-json.x",
      "",
    ];
    for (const chave of recusadas) {
      const erro = validarConfig({ url: URL_PRODUCAO, chave });
      expect(erro, chave).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
      expect(erro, chave).not.toContain("NEXT_PUBLIC_SUPABASE_URL");
    }
  });

  it("recusa URL diferente de https://matgynpiscyoshnjzolo.supabase.co, com erro que nomeia NEXT_PUBLIC_SUPABASE_URL", () => {
    const recusadas = [
      "https://outro-projeto.supabase.co",
      "http://matgynpiscyoshnjzolo.supabase.co",
      "https://matgynpiscyoshnjzolo.supabase.co.evil.example",
      "",
    ];
    for (const url of recusadas) {
      const erro = validarConfig({ url, chave: CHAVE_PRODUCAO });
      expect(erro, url).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(erro, url).not.toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }
  });

  it("o next.config.ts chama validarConfig na carga e lança com o nome da variável recusada", async () => {
    await expect(carregarNextConfig({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "qualquer-coisa" })).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
    await expect(carregarNextConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://outro-projeto.supabase.co" })).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
    await expect(carregarNextConfig({})).resolves.toHaveProperty("default");
  });

  it("config.ts e next.config.ts não contêm nenhum dos três textos de chave secreta", () => {
    for (const arquivo of ["src/lib/data/config.ts", "next.config.ts"]) {
      const texto = ler(arquivo);
      expect(PROIBIDOS.filter((p) => texto.includes(p)), arquivo).toEqual([]);
    }
  });

  it("lê só NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, com o padrão de produção quando faltam", async () => {
    const lidas = ["src/lib/data/config.ts", "next.config.ts"].flatMap((arquivo) =>
      [...ler(arquivo).matchAll(/process\.env(?:\.(\w+))?/g)].map((m) => m[1] ?? "(acesso dinâmico)"),
    );
    expect(new Set(lidas)).toEqual(new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]));

    const doEnv = await carregarConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://exemplo.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave-do-env",
    });
    expect([doEnv.SUPABASE_URL, doEnv.SUPABASE_PUBLISHABLE_KEY]).toEqual(["https://exemplo.invalid", "chave-do-env"]);

    const padrao = await carregarConfig({});
    expect([padrao.SUPABASE_URL, padrao.SUPABASE_PUBLISHABLE_KEY]).toEqual([URL_PRODUCAO, CHAVE_PRODUCAO]);
  });
});
