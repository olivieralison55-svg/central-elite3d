import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, middleware } from "./middleware";

const pedir = (caminho: string) => middleware(new NextRequest(`http://localhost${caminho}`));

describe("middleware de codificação inválida (NAV-03)", () => {
  it("manda para /dash, com 307, o endereço de ficha que não decodifica", () => {
    for (const caminho of ["/mentorado/%E0%A4%A", "/mentorado/%", "/mentorado/abc/%ZZ"]) {
      const resposta = pedir(caminho);
      expect(resposta.status, caminho).toBe(307);
      expect(resposta.headers.get("location"), caminho).toBe("http://localhost/dash");
    }
  });

  it("deixa seguir o endereço de ficha com codificação válida", () => {
    for (const caminho of ["/mentorado/abc-123", "/mentorado/abc-123/financeiro", "/mentorado/Jo%C3%A3o"]) {
      const resposta = pedir(caminho);
      expect(resposta.headers.get("x-middleware-next"), caminho).toBe("1");
      expect(resposta.headers.get("location"), caminho).toBeNull();
    }
  });

  it("casa só /mentorado/:path* e não lê cookie nem sessão", () => {
    expect(config.matcher).toEqual(["/mentorado/:path*"]);
    const fonte = readFileSync(fileURLToPath(new URL("./middleware.ts", import.meta.url)), "utf8");
    expect(fonte).not.toMatch(/cookie|next\/headers|supabase|lib\/data|\.auth\b/i);
  });
});
