import { describe, expect, it } from "vitest";

import { nextEnabledIndex, type SelectOption } from "./select";

/**
 * `nextEnabledIndex` é a única parte do `Select` que o runner alcança
 * (`vitest.config.ts` coleta `src/**\/*.test.ts`, nunca `.tsx`), e é onde mora
 * a decisão que a opção desabilitada introduz: a navegação por teclado tem de
 * pular o que não é escolhível, nas duas direções, sem entrar em laço quando
 * nada é escolhível.
 */

const options = (...spec: Array<string | [string]>): SelectOption[] =>
  spec.map((entry) =>
    Array.isArray(entry)
      ? { value: entry[0], label: entry[0], disabled: true }
      : { value: entry, label: entry },
  );

describe("nextEnabledIndex", () => {
  it("anda uma posição quando a vizinha é escolhível", () => {
    const list = options("a", "b", "c");
    expect(nextEnabledIndex(list, 0, 1)).toBe(1);
    expect(nextEnabledIndex(list, 2, -1)).toBe(1);
  });

  it("pula as desabilitadas para frente", () => {
    const list = options("a", ["b"], ["c"], "d");
    expect(nextEnabledIndex(list, 0, 1)).toBe(3);
  });

  it("pula as desabilitadas para trás", () => {
    const list = options("a", ["b"], ["c"], "d");
    expect(nextEnabledIndex(list, 3, -1)).toBe(0);
  });

  it("dá a volta na lista nas duas direções", () => {
    const list = options("a", "b");
    expect(nextEnabledIndex(list, 1, 1)).toBe(0);
    expect(nextEnabledIndex(list, 0, -1)).toBe(1);
  });

  it("dá a volta pulando desabilitada na borda", () => {
    const list = options("a", "b", ["c"]);
    expect(nextEnabledIndex(list, 1, 1)).toBe(0);
  });

  it("devolve o índice de partida quando é a única escolhível", () => {
    const list = options(["a"], "b", ["c"]);
    expect(nextEnabledIndex(list, 1, 1)).toBe(1);
    expect(nextEnabledIndex(list, 1, -1)).toBe(1);
  });

  it("devolve o índice de partida quando todas estão desabilitadas", () => {
    const list = options(["a"], ["b"], ["c"]);
    expect(nextEnabledIndex(list, 0, 1)).toBe(0);
  });

  it("não quebra com lista vazia", () => {
    expect(nextEnabledIndex([], 0, 1)).toBe(0);
  });

  it("trata a opção sem o campo `disabled` como escolhível", () => {
    // A garantia de compatibilidade: todo uso atual do Select na plataforma
    // passa opções sem o campo novo.
    const list: SelectOption[] = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ];
    expect(nextEnabledIndex(list, 0, 1)).toBe(1);
  });
});
