import { afterEach, describe, expect, it, vi } from "vitest";

import type { Resultado } from "./data/esquemas";
import type { ResultadoEscrita } from "./data/escritas";
import { comAdocao, type Escrita, executarEscrita } from "./escrita";

// Uma escrita com cada dependência anotada na ordem em que é chamada: escrever, avisar e
// recarregar. A sessão do supabase-js é a do usuário da tela, salvo quando o teste troca.
function escrita(resultado: ResultadoEscrita, extra: Partial<Escrita> = {}) {
  const chamadas: unknown[][] = [];
  const o: Escrita = {
    pode: true,
    ocupado: { current: false },
    usuarioId: "u1",
    usuarioDaSessao: () => Promise.resolve("u1"),
    escrever: () => {
      chamadas.push(["escrever"]);
      return Promise.resolve(resultado);
    },
    avisar: (mensagem, tipo) => {
      chamadas.push(["avisar", mensagem, tipo]);
    },
    recarregar: async () => {
      chamadas.push(["recarregar"]);
    },
    sucesso: "Sessão salva",
    ...extra,
  };
  return { o, chamadas };
}

const vezes = (chamadas: unknown[][], nome: string) => chamadas.filter((c) => c[0] === nome).length;

describe("executor de escrita (WRITE-02, WRITE-04, WRITE-05, WRITE-06, WRITE-07, WRITE-08, DATA-09, SEC-06)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("WRITE-08: sem a capacidade, escrever não é chamado, nada aparece e devolve false", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { o, chamadas } = escrita({ ok: true, linhas: 1 }, { pode: false });
    expect(await executarEscrita(o)).toBe(false);
    expect(chamadas).toEqual([]);
  });

  it("WRITE-04: duas chamadas no mesmo tick gravam uma vez; terminada a escrita, a trava solta", async () => {
    const { o, chamadas } = escrita({ ok: true, linhas: 1 });
    expect(await Promise.all([executarEscrita(o), executarEscrita(o)])).toEqual([true, false]);
    expect(vezes(chamadas, "escrever")).toBe(1);
    expect(o.ocupado.current).toBe(false);
    expect(await executarEscrita(o)).toBe(true);
    expect(vezes(chamadas, "escrever")).toBe(2);
  });

  it("WRITE-05: erro vira toast com a mensagem e devolve false, sem recarregar", async () => {
    const { o, chamadas } = escrita({ ok: false, erro: "new row violates row-level security policy" });
    expect(await executarEscrita(o)).toBe(false);
    expect(chamadas).toEqual([["escrever"], ["avisar", "new row violates row-level security policy", "erro"]]);
  });

  it("WRITE-02: 0 linhas mostra 'Nada foi gravado: sem permissão ou registro não encontrado.', recarrega e devolve false", async () => {
    const { o, chamadas } = escrita({ ok: false, zeroLinhas: true });
    expect(await executarEscrita(o)).toBe(false);
    expect(chamadas).toEqual([["escrever"], ["avisar", "Nada foi gravado: sem permissão ou registro não encontrado.", "erro"], ["recarregar"]]);
  });

  it("WRITE-02: escrita parcial mostra 'N de M gravadas', sem sucesso, recarrega e devolve false", async () => {
    const { o, chamadas } = escrita({ ok: false, linhas: 2, esperadas: 3 });
    expect(await executarEscrita(o)).toBe(false);
    expect(chamadas).toEqual([["escrever"], ["avisar", "2 de 3 gravadas", "erro"], ["recarregar"]]);
  });

  it("SEC-06: sem sessão, ou com a de outro usuário, escrever não é chamado e a escrita se descarta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let sessao: string | null = null;
    const { o, chamadas } = escrita({ ok: true, linhas: 1 }, { usuarioDaSessao: () => Promise.resolve(sessao) });
    for (const outra of [null, "u2"]) {
      sessao = outra;
      expect(await executarEscrita(o), String(outra)).toBe(false);
      expect(chamadas, String(outra)).toEqual([]);
    }
    // Descartada, não adiada: com a sessão de volta, só a escrita nova sai.
    sessao = "u1";
    expect(await executarEscrita(o)).toBe(true);
    expect(vezes(chamadas, "escrever")).toBe(1);
  });

  it("DATA-09: sucesso mostra o toast, recarrega e devolve true; sem texto de sucesso, só recarrega", async () => {
    const com = escrita({ ok: true, linhas: 1 });
    expect(await executarEscrita(com.o)).toBe(true);
    expect(com.chamadas).toEqual([["escrever"], ["avisar", "Sessão salva", "sucesso"], ["recarregar"]]);

    const sem = escrita({ ok: true, linhas: 1 }, { sucesso: undefined });
    expect(await executarEscrita(sem.o)).toBe(true);
    expect(sem.chamadas).toEqual([["escrever"], ["recarregar"]]);
  });

  it("W14: `depois` recebe o resultado do sucesso, com o id, só depois da recarga; erro, 0 linhas e escrita parcial não o chamam", async () => {
    const depois = (gravado: Extract<ResultadoEscrita, { ok: true }>, chamadas: unknown[][]) => chamadas.push(["depois", gravado]);
    const sucesso = escrita({ ok: true, linhas: 1, id: "m9" }, { sucesso: "Mentorado criado" });
    sucesso.o.depois = (gravado) => depois(gravado, sucesso.chamadas);
    expect(await executarEscrita(sucesso.o)).toBe(true);
    expect(sucesso.chamadas).toEqual([["escrever"], ["avisar", "Mentorado criado", "sucesso"], ["recarregar"], ["depois", { ok: true, linhas: 1, id: "m9" }]]);
    for (const falha of [{ ok: false, erro: "falhou" }, { ok: false, zeroLinhas: true }, { ok: false, linhas: 1, esperadas: 2 }] as const) {
      const { o, chamadas } = escrita(falha);
      o.depois = (gravado) => depois(gravado, chamadas);
      expect(await executarEscrita(o), JSON.stringify(falha)).toBe(false);
      expect(chamadas.some(([nome]) => nome === "depois"), JSON.stringify(falha)).toBe(false);
    }
  });

  it("WRITE-06: W11 que grava seguido de W11b que falha mostra 'Cadastro salvo, mas as cobranças da Lia não foram puxadas:' e o erro", async () => {
    const adotar = vi.fn<() => Promise<Resultado<null>>>(() => Promise.resolve({ ok: false, erro: "permission denied for table lia_cobrancas" }));
    const { o, chamadas } = escrita({ ok: true, linhas: 1 }, { sucesso: "Mentorado atualizado" });
    const salvar = o.escrever;
    expect(await executarEscrita({ ...o, escrever: () => comAdocao(salvar, adotar) })).toBe(true);
    expect(chamadas).toEqual([
      ["escrever"],
      ["avisar", "Cadastro salvo, mas as cobranças da Lia não foram puxadas: permission denied for table lia_cobrancas", "erro"],
      ["recarregar"],
    ]);
    expect(adotar).toHaveBeenCalledTimes(1);

    // W11b que dá certo deixa o sucesso; W11 que falha não chama o W11b.
    adotar.mockResolvedValueOnce({ ok: true, dados: null });
    expect(await comAdocao(() => Promise.resolve({ ok: true, linhas: 1 }), adotar)).toEqual({ ok: true, linhas: 1 });
    adotar.mockClear();
    expect(await comAdocao(() => Promise.resolve({ ok: false, erro: "timeout" }), adotar)).toEqual({ ok: false, erro: "timeout" });
    expect(adotar).not.toHaveBeenCalled();
  });

  it("WRITE-07: falha do lia_refletir_financeiro depois da escrita vira toast com o erro, no lugar do sucesso", async () => {
    const { o, chamadas } = escrita({ ok: true, linhas: 1, aviso: "permission denied for table parcelas" }, { sucesso: "Cobrança vinculada" });
    expect(await executarEscrita(o)).toBe(true);
    expect(chamadas).toEqual([["escrever"], ["avisar", "permission denied for table parcelas", "erro"], ["recarregar"]]);
  });
});
