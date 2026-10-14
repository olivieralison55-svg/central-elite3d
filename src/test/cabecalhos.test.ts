import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

// SEC-04, com os valores da spec.
const SEC_04 = {
  "Content-Security-Policy":
    "frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; connect-src 'self' https://matgynpiscyoshnjzolo.supabase.co",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// Os cabeçalhos de cada `source` da config naquela fase, como nome → valor.
async function cabecalhos(fase: string): Promise<Record<string, Record<string, string>>> {
  const regras = (await nextConfig(fase).headers?.()) ?? [];
  return Object.fromEntries(regras.map((r) => [r.source, Object.fromEntries(r.headers.map((h) => [h.key, h.value]))]));
}

describe("cabeçalhos de segurança (SEC-04)", () => {
  it("manda CSP, X-Content-Type-Options e Referrer-Policy em /:path* no build e no start, e não no next dev", async () => {
    for (const fase of [PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER]) {
      expect((await cabecalhos(fase))["/:path*"], fase).toMatchObject(SEC_04);
    }
    const emDev = Object.values(await cabecalhos(PHASE_DEVELOPMENT_SERVER)).flatMap(Object.keys);
    expect(emDev.filter((nome) => nome in SEC_04)).toEqual([]);
  });

  it("não manda X-Powered-By: poweredByHeader é false", () => {
    for (const fase of [PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER, PHASE_DEVELOPMENT_SERVER]) {
      expect(nextConfig(fase).poweredByHeader, fase).toBe(false);
    }
  });
});
