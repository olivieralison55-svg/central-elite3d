import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Caminho relativo: o Next não resolve o alias `@` do tsconfig dentro do next.config.ts.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, validarConfig } from "./src/lib/data/config";

// STACK-06: chave fora da lista de permissão, ou URL que não é a de produção, param o
// `next build`, o `next dev` e o `next start` aqui, na carga da config, fora do bundle do cliente.
const erroDeConfig = validarConfig({ url: SUPABASE_URL, chave: SUPABASE_PUBLISHABLE_KEY });
if (erroDeConfig) throw new Error(erroDeConfig);

// SEC-04. Daqui para baixo o SUPABASE_URL já passou por validarConfig: é a URL de produção.
const CABECALHOS = [
  {
    key: "Content-Security-Policy",
    value: `frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; connect-src 'self' ${SUPABASE_URL}`,
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

// Função em vez de objeto: o Next a chama com a fase de cada comando, e é a fase que
// separa o `next dev` sem ler variável de ambiente.
export default function nextConfig(fase: string): NextConfig {
  return {
    poweredByHeader: false,
    // Fora do `next dev`, para a CSP não bloquear o HMR.
    async headers() {
      return fase === PHASE_DEVELOPMENT_SERVER ? [] : [{ source: "/:path*", headers: CABECALHOS }];
    },
  };
}
