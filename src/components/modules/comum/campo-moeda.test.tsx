import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChangeEvent, FocusEvent, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { lerBRL } from "@/lib/moeda";

import CampoMoeda from "./campo-moeda";

const RAIZ = fileURLToPath(new URL("../../../..", import.meta.url));

// O que o campo entrega ao digitar (ou colar) e ao sair, como o Input recebe o evento.
function campo(valor = "") {
  const onChange = vi.fn<(texto: string) => void>();
  const el = CampoMoeda({ value: valor, onChange }) as ReactElement<{
    onChange(e: Pick<ChangeEvent<HTMLInputElement>, "target">): void;
    onBlur(e: Pick<FocusEvent<HTMLInputElement>, "target">): void;
  }>;
  const evento = (texto: string) => ({ target: { value: texto } as HTMLInputElement });
  return {
    digitar: (texto: string) => (el.props.onChange(evento(texto)), onChange.mock.calls.at(-1)?.[0]),
    sair: (texto: string) => (el.props.onBlur(evento(texto)), onChange.mock.calls.at(-1)?.[0]),
  };
}

describe("campo de moeda (OPS-20, UI-06)", () => {
  it("OPS-20: colar '2000.50' mostra R$ 2.000,50, que vale 2000,5; '1.234,56' vale 1234,56", () => {
    const { digitar, sair } = campo();
    expect(digitar("2000.50")).toBe("R$ 2.000,50");
    expect(lerBRL(digitar("2000.50"))).toBe(2000.5);
    expect(digitar("1.234,56")).toBe("R$ 1.234,56");
    expect(lerBRL(digitar("1.234,56"))).toBe(1234.56);
    // Digitando, a máscara põe os milhares; ao sair, fecha as duas casas.
    expect(digitar("2000")).toBe("R$ 2.000");
    expect(sair("R$ 2.000")).toBe("R$ 2.000,00");
    expect(sair("2000.5")).toBe("R$ 2.000,50");
    expect(sair("")).toBe("");
  });

  it("é o Input do DS em texto, com teclado decimal, o valor recebido e as props de quem usa", () => {
    const html = renderToStaticMarkup(<CampoMoeda id="valor" placeholder="R$ 0,00" value="R$ 2.000,50" onChange={() => undefined} />);
    expect(html).toMatch(/^<input [^>]*class="h-9 w-full rounded-6 border/);
    for (const atributo of ['type="text"', 'inputMode="decimal"', 'value="R$ 2.000,50"', 'id="valor"', 'placeholder="R$ 0,00"']) {
      expect(html, atributo).toContain(atributo);
    }
  });

  it("UI-06: nenhuma tela usa o NumberInput do DS (dinheiro vai pelo CampoMoeda)", () => {
    const telas = readdirSync(join(RAIZ, "src/components/modules"), { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name))
      .map((d) => relative(RAIZ, join(d.parentPath, d.name)));
    expect(telas).toContain("src/components/modules/comum/campo-moeda.tsx");
    const importaNumberInput = (texto: string) => /["']@\/components\/ui\/number-input["']/.test(texto);
    expect(importaNumberInput('import NumberInput from "@/components/ui/number-input";')).toBe(true);
    expect(telas.filter((caminho) => importaNumberInput(readFileSync(join(RAIZ, caminho), "utf8")))).toEqual([]);
  });
});
