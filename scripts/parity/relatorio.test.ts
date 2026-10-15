import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { indexDoLegado } from "./legado.mjs";
import { relacoesDeTeste } from "./snapshot-de-teste";
import { codigoDeSaida, comparar, type Divergencia, divergenciasDoSnapshot, foraDoSchema, gravarDivergencias, linhasDoRelatorio } from "./relatorio";

// GATE-06, GATE-07, SEC-02: o diff das métricas, o relatório impresso e o arquivo de valores.

const pastas: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

// Valores com o que não pode sair impresso: R$, nome e e-mail de mentorado, comentário.
const ANTIGO = { "m1": { nivel: "Prata", total: 15000 }, nome: "Ana Clara", email: "ana.clara@exemplo.com", comentario: "Ótima mentoria", soAntiga: 1 };
const NOVO = { "m1": { nivel: "Ouro", total: 20000.5 }, nome: "Ana Clara", email: "outra@exemplo.com", comentario: "Ótima mentoria!", soNova: 2 };

describe("relatório da paridade (GATE-06, GATE-07, SEC-02)", () => {
  it("o diff acha falta, sobra e valor diferente por chave, com o papel na chave", () => {
    const d = comparar("PAR-05", "admin", ANTIGO, NOVO);
    expect(d.map(({ chave, tipo }) => [chave, tipo])).toEqual([
      ["admin/comentario", "valor diferente"],
      ["admin/email", "valor diferente"],
      ["admin/m1", "valor diferente"],
      ["admin/soAntiga", "falta"],
      ["admin/soNova", "sobra"],
    ]);
    expect(d.find((x) => x.chave === "admin/m1")).toMatchObject({ antigo: ANTIGO.m1, novo: NOVO.m1 });
    expect(comparar("PAR-05", "admin", { a: [1, 2] }, { a: [1, 2] })).toEqual([]);
    // A ordem conta: lista na ordem da tela é valor diferente quando a ordem muda.
    expect(comparar("PAR-04", "mentor", { proximas: ["a", "b"] }, { proximas: ["b", "a"] })).toHaveLength(1);
  });

  it("o relatório impresso só leva métrica, chave e tipo: nenhum valor nem campo pessoal", () => {
    const d = comparar("PAR-05", "admin", ANTIGO, NOVO);
    const linhas = linhasDoRelatorio(d);
    expect(linhas).toEqual(["PAR-05 | admin/comentario | valor diferente", "PAR-05 | admin/email | valor diferente", "PAR-05 | admin/m1 | valor diferente", "PAR-05 | admin/soAntiga | falta", "PAR-05 | admin/soNova | sobra"]);
    const impresso = linhas.join("\n");
    for (const proibido of ["Ana Clara", "@exemplo.com", "Ótima", "Prata", "Ouro", "15000", "20000"]) expect(impresso, proibido).not.toContain(proibido);
  });

  it("os dois valores vão para divergencias-<data>.json com permissão 0600", () => {
    const pasta = mkdtempSync(join(tmpdir(), "relatorio-"));
    pastas.push(pasta);
    const d = comparar("PAR-05", "admin", ANTIGO, NOVO);
    const arquivo = gravarDivergencias(pasta, "2026-09-25", d);
    expect(arquivo).toBe(join(pasta, "divergencias-2026-09-25.json"));
    expect(statSync(arquivo).mode & 0o777).toBe(0o600);
    const gravado = JSON.parse(readFileSync(arquivo, "utf8")) as Divergencia[];
    expect(gravado.find((x) => x.chave === "admin/m1")).toEqual({ metrica: "PAR-05", chave: "admin/m1", tipo: "valor diferente", antigo: ANTIGO.m1, novo: NOVO.m1 });
  });

  it("o bloco Concluídas de PAR-09 fica fora da comparação; os outros blocos e as outras métricas não", () => {
    const antigo = { concluidas: ["s1", "s5"], agendadas: ["s2"] };
    expect(comparar("PAR-09", "admin", antigo, { concluidas: ["s9"], agendadas: ["s2"] })).toEqual([]);
    expect(comparar("PAR-09", "admin", antigo, { agendadas: ["s2"] })).toEqual([]);
    expect(comparar("PAR-09", "admin", antigo, { concluidas: ["s1", "s5"], agendadas: ["s3"] }).map((d) => d.chave)).toEqual(["admin/agendadas"]);
    expect(comparar("PAR-10", "admin", { concluidas: 1 }, { concluidas: 2 })).toHaveLength(1);
  });

  it("linha do snapshot fora do schema é divergência, sem o valor da linha; e o código de saída segue o diff", () => {
    const limpo = relacoesDeTeste();
    expect(foraDoSchema(limpo)).toEqual([]);
    const sujo = relacoesDeTeste();
    sujo.sessoes[2] = { ...sujo.sessoes[2], etapa_deduzida: "sim" };
    sujo.parcelas[0] = { ...sujo.parcelas[0], id: 42 };
    const d = foraDoSchema(sujo);
    expect(d.map(({ metrica, chave, tipo }) => [metrica, chave, tipo])).toEqual([
      ["SCHEMA", "parcelas#0", "valor diferente"],
      ["SCHEMA", "sessoes#2", "valor diferente"],
    ]);
    expect(JSON.stringify(d)).not.toContain('"sim"');
    expect(d[1].antigo).toEqual(["etapa_deduzida: invalid_type"]);
    expect(codigoDeSaida(d)).toBe(1);
    expect(codigoDeSaida([])).toBe(0);
    expect(codigoDeSaida(comparar("PAR-03", "admin", { ativos: 3 }, { ativos: 3 }))).toBe(0);
    expect(codigoDeSaida(comparar("PAR-03", "admin", { ativos: 3 }, { ativos: 4 }))).toBe(1);
  });

  it("a corrida sobre os fixtures do harness antigo: 0 divergência nos 3 papéis; linha fora do schema numa relação essencial vira SCHEMA e a carga recusada de cada papel", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-25T15:00:00Z"));
    const pasta = mkdtempSync(join(tmpdir(), "corrida-"));
    pastas.push(pasta);
    const { arquivo } = indexDoLegado({ cwd: fileURLToPath(new URL("../..", import.meta.url)), destino: join(pasta, "index.html") });
    expect(await divergenciasDoSnapshot({ relacoes: relacoesDeTeste(), data: "2026-09-25", arquivo })).toEqual([]);
    const sujo = relacoesDeTeste();
    sujo.sessoes[0] = { ...sujo.sessoes[0], ordem: "um" };
    const d = await divergenciasDoSnapshot({ relacoes: sujo, data: "2026-09-25", arquivo });
    expect(d.map(({ metrica, chave }) => `${metrica} ${chave}`)).toEqual(["SCHEMA sessoes#0", "CARGA admin", "CARGA diretoria", "CARGA mentor"]);
    expect(codigoDeSaida(d)).toBe(1);
  });
});
