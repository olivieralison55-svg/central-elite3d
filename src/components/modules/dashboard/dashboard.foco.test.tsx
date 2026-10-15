import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { UI_INICIAL, type Ui, UiContexto } from "@/components/shell/contexto";
import type { Sessao } from "@/lib/data/esquemas";
import { datasetDeTeste } from "@/test/fixtures";
import { renderTela } from "@/test/render";

import Dashboard from "./dashboard";

// O render no servidor não guarda handler: o falso do Button anota as props e desenha o de verdade.
const vistos = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("@/components/ui/button", async (importOriginal) => {
  const { createElement } = await import("react");
  const original = await importOriginal<typeof import("@/components/ui/button")>();
  return {
    ...original,
    default: (props: ComponentProps<typeof original.default>) => {
      vistos.push({ ...props });
      return createElement(original.default, props);
    },
  };
});

const sessao = (campos: Partial<Sessao> & { id: string }): Sessao => ({
  mentorado_id: "m1",
  etapa: "Checkup 1",
  ordem: 3,
  status: "Concluída",
  mentor: "Luan",
  data: null,
  hora: null,
  link_meet: null,
  link_gravacao: null,
  link_anotacoes: null,
  google_event_id: null,
  etapa_deduzida: false,
  ...campos,
});
// Uma reunião gravada em duas etapas em julho e outra em agosto.
const SESSOES = [
  sessao({ id: "j1", etapa: "Plano de Ação", ordem: 2, mentor: "Evaldo", data: "2026-07-16", hora: "14:00:00", google_event_id: "ev1" }),
  sessao({ id: "j2", etapa: "Checkup 5", ordem: 7, mentor: "Evaldo", data: "2026-07-16", hora: "14:00:00" }),
  sessao({ id: "a1", mentorado_id: "m2", mentor: "Luan", data: "2026-08-04", hora: "10:00:00", google_event_id: "ev2" }),
  sessao({ id: "a2", mentorado_id: "m2", etapa: "Checkup 2", ordem: 4, mentor: "Luan", data: "2026-08-04", hora: "10:00:00" }),
];

// O foco gravado pelo aviso de reuniões dobradas, com a matriz no mês dado.
function focoDasDobradas(mesMatriz: string | null): string[] | undefined {
  const mudancas: Array<Partial<Ui>> = [];
  vistos.length = 0;
  renderTela(
    <UiContexto.Provider value={{ ui: { ...UI_INICIAL, mesMatriz }, mudar: (parcial) => mudancas.push(parcial) }}>
      <Dashboard modo="completo" />
    </UiContexto.Provider>,
    { papel: "admin", dados: { ...datasetDeTeste(), sessoes: SESSOES } },
  );
  const avisos = vistos.filter((p) => p["data-aviso"] === "dobradas");
  expect(avisos, String(mesMatriz)).toHaveLength(1);
  const focar = avisos[0].onClick;
  if (typeof focar !== "function") throw new Error("aviso sem onClick");
  focar();
  expect(mudancas, String(mesMatriz)).toHaveLength(1);
  return mudancas[0].foco?.ids;
}

describe("Dashboard: o foco do aviso segue o mês da matriz (NAV-10)", () => {
  it("NAV-10: escolhido um mês que não é o padrão, o aviso leva a Sessões os ids daquele mês, não os do mês padrão", () => {
    // Sem escolha, a matriz abre no mês mais recente com reunião (OPS-04): agosto.
    expect(focoDasDobradas(null)).toEqual(["a1", "a2"]);
    expect(focoDasDobradas("2026-07")).toEqual(["j1", "j2"]);
  });
});
