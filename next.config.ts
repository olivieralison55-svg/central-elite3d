import type { NextConfig } from "next";

// Caminho relativo: o Next não resolve o alias `@` do tsconfig dentro do next.config.ts.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, validarConfig } from "./src/lib/data/config";

// STACK-06: chave fora da lista de permissão, ou URL que não é a de produção, param o
// `next build`, o `next dev` e o `next start` aqui, na carga da config, fora do bundle do cliente.
const erroDeConfig = validarConfig({ url: SUPABASE_URL, chave: SUPABASE_PUBLISHABLE_KEY });
if (erroDeConfig) throw new Error(erroDeConfig);

const nextConfig: NextConfig = {};

export default nextConfig;
