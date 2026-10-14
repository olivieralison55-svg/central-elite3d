import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

let instancia: SupabaseClient | null = null;

// O cliente do Supabase, criado na primeira chamada e só no browser: nenhum import cria
// cliente, e o servidor do Next não guarda sessão (AD-007). Storage e chave da sessão são os
// padrões do supabase-js, os mesmos do app de hoje, então quem está logado continua logado
// (AUTH-09). Sessão vinda da URL não troca a da aba (AUTH-10, THREAT-10).
export function cliente(): SupabaseClient {
  if (typeof window === "undefined") throw new Error("[central-elite3d] cliente(): o Supabase só é criado no browser");
  instancia ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { detectSessionInUrl: false } });
  return instancia;
}
