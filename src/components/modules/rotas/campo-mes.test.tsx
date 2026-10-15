import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SelectOption } from "@/components/ui/select";

import CampoMes from "./campo-mes";

// O Select desenha o de verdade e anota as props, para o teste chamar o onChange dele.
const vistos = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("@/components/ui/select", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/select")>();
  return { ...original, default: (props: ComponentProps<typeof original.default>) => (vistos.push({ ...props }), createElement(original.default, props)) };
});

function campo(value: string, anos = [2025, 2026, 2027]) {
  vistos.length = 0;
  const onChange = vi.fn<(mes: string) => void>();
  const html = renderToStaticMarkup(<CampoMes id="ft-mes" value={value} onChange={onChange} anos={anos} />);
  const select = (id: string) => {
    const achado = vistos.filter((p) => p.id === id);
    expect(achado, id).toHaveLength(1);
    return achado[0] as { value: string; options: SelectOption[]; onChange(valor: string): void };
  };
  return { html, onChange, mes: select("ft-mes-mes"), ano: select("ft-mes-ano") };
}

describe("campo de mês (UI-06)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T15:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("mostra o mês e o ano do valor AAAA-MM: os 12 meses abreviados e os anos que chegam por prop", () => {
    const { mes, ano } = campo("2026-03", [2024, 2025, 2026]);
    expect([mes.value, ano.value]).toEqual(["03", "2026"]);
    expect(mes.options.map((o) => o.label)).toEqual(["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]);
    expect(mes.options.map((o) => o.value)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]);
    expect(ano.options).toEqual([
      { value: "2024", label: "2024" },
      { value: "2025", label: "2025" },
      { value: "2026", label: "2026" },
    ]);
  });

  it("trocar o mês entrega AAAA-MM com o ano de antes, e trocar o ano entrega com o mês de antes", () => {
    const { mes, ano, onChange } = campo("2026-08");
    mes.onChange("02");
    expect(onChange).toHaveBeenLastCalledWith("2026-02");
    ano.onChange("2025");
    expect(onChange).toHaveBeenLastCalledWith("2025-08");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("sem valor, o padrão é o mês corrente de Brasília, e o que se troca parte dele", () => {
    const { mes, ano, onChange } = campo("");
    expect([mes.value, ano.value]).toEqual(["08", "2026"]);
    mes.onChange("11");
    expect(onChange).toHaveBeenLastCalledWith("2026-11");
    const outro = campo("");
    outro.ano.onChange("2027");
    expect(outro.onChange).toHaveBeenLastCalledWith("2027-08");
    // Virou o dia em Brasília: 02:30 UTC de 01/09 ainda é 31/08 lá.
    vi.setSystemTime(new Date("2026-09-01T02:30:00Z"));
    expect(campo("").mes.value).toBe("08");
    vi.setSystemTime(new Date("2026-09-01T03:30:00Z"));
    expect(campo("").mes.value).toBe("09");
  });

  it("cada Select tem o seu rótulo, ligado pelo id", () => {
    const { html } = campo("2026-08");
    expect(html).toMatch(/<label for="ft-mes-mes" class="sr-only">Mês<\/label>/);
    expect(html).toMatch(/<label for="ft-mes-ano" class="sr-only">Ano<\/label>/);
  });
});
