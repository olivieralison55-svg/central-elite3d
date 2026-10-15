import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

// O createClient de verdade não sai daqui: o teste confere as opções, sem rede.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

// O singleton é estado do módulo: cada cenário carrega o módulo de novo.
async function carregar() {
  vi.resetModules();
  return import("./cliente");
}

describe("cliente do Supabase (AUTH-09, AUTH-10)", () => {
  beforeEach(() => {
    createClient.mockReset();
    createClient.mockImplementation(() => ({}));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("importar não cria cliente, e fora do browser cliente() lança sem criar", async () => {
    const { cliente } = await carregar();
    expect(createClient).not.toHaveBeenCalled();
    expect(() => cliente()).toThrow("só é criado no browser");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("no browser cria um cliente só, com auth.detectSessionInUrl false e o storage e a chave da sessão padrão", async () => {
    vi.stubGlobal("window", {});
    const { cliente } = await carregar();
    const primeiro = cliente();
    expect(cliente()).toBe(primeiro);
    // A opção inteira: sem `storage` nem `storageKey`, o supabase-js usa os padrões do app de hoje.
    expect(createClient.mock.calls).toEqual([[SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { detectSessionInUrl: false } }]]);
  });
});
