import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { classeDaFonte, papelDoJwt, segredosNoBuild, verificar } from "./verificar-build.mjs";

// GATE-11 e GATE-12 sobre uma pasta .next falsa.

const pastas = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

const jwt = (payload) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.assinatura`;
// O prefixo em pedaços: o texto inteiro aqui seria o próprio valor que a regra procura.
const PREFIXO = "sb_" + "secret_";

/** Uma .next com `arquivos` ({caminho: conteúdo}) e uma página com a classe da fonte no CSS. */
function build(arquivos = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "build-"));
  pastas.push(raiz);
  const base = {
    "server/app/dash.html": '<!DOCTYPE html><html lang="pt-BR" class="__variable_abc123"><body></body></html>',
    "static/css/app.css": ".__variable_abc123{--font-inter:'Inter'}",
    ...arquivos,
  };
  for (const [caminho, conteudo] of Object.entries(base)) {
    mkdirSync(dirname(join(raiz, caminho)), { recursive: true });
    writeFileSync(join(raiz, caminho), conteudo);
  }
  return raiz;
}

describe("conferência do build (GATE-11, GATE-12)", () => {
  const servico = "service" + "_role";

  it("GATE-11: acha um valor sb_secret_ em static e em server/app, sem imprimir o valor", () => {
    const valor = `${PREFIXO}AbCdEf0123456789xyz`;
    const raiz = build({ "static/chunks/app.js": `const k="${valor}";`, "server/app/dash.rsc": `x:${valor}` });
    const achados = segredosNoBuild(raiz);
    expect([...achados].sort()).toEqual(["server/app/dash.rsc: valor sb_secret_", "static/chunks/app.js: valor sb_secret_"]);
    expect(achados.join("\n")).not.toContain("AbCdEf");
    expect(verificar(raiz).problemas).toHaveLength(2);
    // Fora de static e server/app o build não serve: não é varrido.
    expect(segredosNoBuild(build({ "cache/x.js": `"${valor}"` }))).toEqual([]);
  });

  it("GATE-11: acha um JWT com role service_role", () => {
    const raiz = build({ "static/chunks/a.js": `const s="${jwt({ role: servico, iss: "supabase" })}";` });
    expect(segredosNoBuild(raiz)).toEqual([`static/chunks/a.js: JWT com role ${servico}`]);
    expect(verificar(raiz).problemas).toEqual([`static/chunks/a.js: JWT com role ${servico}`]);
  });

  it("GATE-11: não acusa o JWT anon, a chave que pode ir para o bundle", () => {
    expect(papelDoJwt(jwt({ role: "anon" }))).toBe("anon");
    expect(segredosNoBuild(build({ "static/chunks/b.js": `const p="${jwt({ role: "anon", iss: "supabase" })}";` }))).toEqual([]);
  });

  it("GATE-11: não acusa a palavra solta sb_secret_, sem valor depois", () => {
    expect(segredosNoBuild(build({ "server/app/regra.js": `// a regra proíbe ${PREFIXO} e "${PREFIXO}"; ${PREFIXO}abc` }))).toEqual([]);
  });

  it("GATE-12: acha a classe __variable_ do <html> no CSS de static/css", () => {
    expect(classeDaFonte(build())).toEqual({ classes: ["__variable_abc123"], faltando: [] });
    expect(verificar(build()).problemas).toEqual([]);
  });

  it("GATE-12: classe do <html> ausente do CSS é problema", () => {
    const raiz = build({ "static/css/app.css": ".outra{}" });
    expect(classeDaFonte(raiz)).toEqual({ classes: ["__variable_abc123"], faltando: ["__variable_abc123"] });
    expect(verificar(raiz).problemas).toEqual(["classe __variable_abc123 do <html> ausente do CSS de static/css"]);
  });

  it("GATE-12: <html> sem classe __variable_ é problema", () => {
    expect(verificar(build({ "server/app/dash.html": '<html lang="pt-BR"><body></body></html>' })).problemas).toEqual(["nenhuma classe __variable_ no <html> dos HTML de server/app"]);
  });
});
