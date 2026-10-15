import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { carregarLegado, indexDoMergeBase } from "./legado.mjs";
import { relacoesDeTeste } from "./snapshot-de-teste";

// GATE-06: o app antigo do merge-base roda sobre os fixtures do harness antigo, servidos pelo
// cliente falso, com o afterLogin e o loadAll reais.

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
let pasta = "";
let arquivo = "";

// Os fixtures com a adesão preenchida e uma linha de mentorados_basic só do mentor: o que o
// app carrega diz de qual relação ele leu.
function relacoes() {
  const r = relacoesDeTeste();
  r.experiencia_adesao = [{ respostas: 3, mentorados_com_sessao: 4 }];
  r.mentorados_basic = [...r.mentorados_basic, { ...r.mentorados_basic[0], id: "so-basic", nome: "Só na view" }];
  return r;
}

beforeAll(() => {
  pasta = mkdtempSync(join(tmpdir(), "legado-"));
  arquivo = indexDoMergeBase({ cwd: RAIZ, destino: join(pasta, "index.html") }).arquivo;
});
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

describe("carregador do app antigo (GATE-06)", () => {
  it("lê o index.html do merge-base, extraído por git show, e o app que roda é o do caminho dado", async () => {
    const sha = execFileSync("git", ["merge-base", "main", "HEAD"], { cwd: RAIZ, encoding: "utf8" }).trim();
    expect(readFileSync(arquivo, "utf8")).toBe(execFileSync("git", ["show", `${sha}:index.html`], { cwd: RAIZ, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
    expect(statSync(arquivo).mode & 0o777).toBe(0o600);
    // Uma cópia alterada no caminho dado: é ela que roda, não um index.html achado por conta própria.
    const outro = join(pasta, "outro.html");
    writeFileSync(outro, readFileSync(arquivo, "utf8").replace("function renderDash(acomp=false){", 'function renderDash(acomp=false){ $("#app").innerHTML = "COPIA-ALTERADA"; return;'));
    expect((await carregarLegado({ arquivo: outro, relacoes: relacoes(), papel: "admin" })).tela()).toBe("COPIA-ALTERADA");
    expect((await carregarLegado({ arquivo, relacoes: relacoes(), papel: "admin" })).tela()).not.toBe("COPIA-ALTERADA");
  });

  it("admin lê mentorados, com as colunas do financeiro, e não a view do mentor", async () => {
    const app = await carregarLegado({ arquivo, relacoes: relacoes(), papel: "admin" });
    const lidas = app.consultas.map((c) => c.relacao);
    expect(lidas).toContain("mentorados");
    expect(lidas).not.toContain("mentorados_basic");
    expect(app.avaliar("M.map(m => m.id)")).toEqual(["m1", "m2", "m3", "m4"]);
    expect(app.avaliar("M[1].contrato_status")).toBe("Ainda não");
    expect(app.avaliar("P.map(p => p.id)")).toEqual(["p1", "p2", "p3"]);
    expect(app.avaliar("myRole")).toBe("admin");
    expect(app.escritas).toEqual([]);
  });

  it("mentor lê mentorados_basic, sem parcelas, cobranças nem STLSeller", async () => {
    const app = await carregarLegado({ arquivo, relacoes: relacoes(), papel: "mentor" });
    const lidas = app.consultas.map((c) => c.relacao);
    expect(lidas).toContain("mentorados_basic");
    for (const relacao of ["mentorados", "parcelas", "lia_cobrancas", "stlseller_mentorados", "nps_respostas"]) expect(lidas, relacao).not.toContain(relacao);
    expect(app.avaliar("M.map(m => m.id)")).toEqual(["m1", "m2", "m3", "m4", "so-basic"]);
    expect(app.avaliar("M[1].contrato_status")).toBeUndefined();
    expect(app.avaliar("P")).toEqual([]);
    expect(app.avaliar("COBRANCAS")).toEqual([]);
  });

  it("as rpcs respondem do snapshot: a adesão para todos, o recorte da IA só para o mentor", async () => {
    const admin = await carregarLegado({ arquivo, relacoes: relacoes(), papel: "admin" });
    expect(admin.consultas.map((c) => c.relacao).filter((r) => r.startsWith("rpc:"))).toEqual(["rpc:experiencia_adesao"]);
    expect(admin.avaliar("ADESAO_EXP")).toEqual({ respostas: 3, mentorados_com_sessao: 4 });
    expect(admin.avaliar("ANALISE.resumo")).toContain("Resumo");
    const mentor = await carregarLegado({ arquivo, relacoes: relacoes(), papel: "mentor" });
    expect(mentor.consultas.map((c) => c.relacao).filter((r) => r.startsWith("rpc:"))).toEqual(["rpc:experiencia_adesao", "rpc:analise_ia_mentor"]);
    expect(mentor.avaliar("ADESAO_EXP")).toEqual({ respostas: 3, mentorados_com_sessao: 4 });
    expect(mentor.avaliar("ANALISE.resumo")).toBeUndefined();
    expect(mentor.avaliar("ANALISE.mentorados.length")).toBe(3);
  });

  it("navegar pelo hash troca o HTML de #app, e o mentor que pede o financeiro volta ao dashboard", async () => {
    const app = await carregarLegado({ arquivo, relacoes: relacoes(), papel: "admin" });
    expect(app.avaliar("view")).toBe("dash");
    const dash = app.tela();
    expect(dash.length).toBeGreaterThan(0);
    app.navegar("#/sessoes");
    expect(app.avaliar("view")).toBe("sessoes");
    expect(app.tela()).not.toBe(dash);
    expect(app.tela()).toBe((app.avaliar("renderSessoes")(), app.tela()));
    app.navegar("#/mentorado/m2/financeiro");
    expect(app.avaliar("[view, fichaId, fichaAba]")).toEqual(["mentorado", "m2", "financeiro"]);
    expect(app.tela()).toContain("Bruno Dias");

    const mentor = await carregarLegado({ arquivo, relacoes: relacoes(), papel: "mentor" });
    mentor.navegar("#/financeiro");
    expect(mentor.avaliar("[view, location.hash]")).toEqual(["dash", "#/dash"]);
  });
});
